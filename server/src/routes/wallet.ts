import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'

const router = Router()

// Money-mutation endpoints get a tighter limiter. 30/min/user is well above
// any real human use but blocks scripted abuse.
const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip || 'anon',
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const [balances, transactions] = await Promise.all([
    prisma.walletBalance.findMany({ where: { userId: req.userId! } }),
    prisma.transaction.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])
  res.json({ balances, transactions })
})

const txSchema = z.object({
  kind: z.enum(['deposit', 'withdraw', 'transfer', 'dividend', 'interest']),
  currency: z.string().min(1).max(20),
  symbol: z.string().min(1).max(8).default('$'),
  amount: z.number().positive(),
  reference: z.string().max(200).optional(),
})

router.post('/transactions', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = txSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { kind, currency, symbol, amount, reference } = parsed.data

  // Account-hold gate: even though `requireAuth` lets the user in, an admin
  // may have placed a hold on money-movement. Block the relevant kinds.
  if (kind === 'withdraw' || kind === 'transfer') {
    const u = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        holdActive: true, holdType: true, holdReason: true, holdNote: true,
        ipAllowlist: true,
        dailyWithdrawLimit: true, monthlyWithdrawLimit: true,
        dailyTransferLimit: true, monthlyTransferLimit: true,
      },
    })
    if (u?.holdActive) {
      const blocks =
        u.holdType === 'all' ||
        (u.holdType === 'withdraw' && kind === 'withdraw') ||
        (u.holdType === 'transfer' && kind === 'transfer')
      if (blocks) {
        res.status(423).json({
          error: 'Account on hold',
          reason: u.holdReason,
          note: u.holdNote,
          scope: u.holdType,
        })
        return
      }
    }
    // IP allowlist (simple substring-match against comma-separated entries).
    if (u?.ipAllowlist && u.ipAllowlist.trim()) {
      const allowed = u.ipAllowlist.split(',').map((s) => s.trim()).filter(Boolean)
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || ''
      const ok = allowed.some((entry) => ip === entry || ip.startsWith(entry))
      if (!ok) {
        res.status(403).json({ error: 'Source IP not in allowlist for this account', ip })
        return
      }
    }
    // Per-user money-movement caps.
    const dailyCap = kind === 'withdraw' ? u?.dailyWithdrawLimit : u?.dailyTransferLimit
    const monthlyCap = kind === 'withdraw' ? u?.monthlyWithdrawLimit : u?.monthlyTransferLimit
    if (dailyCap || monthlyCap) {
      const now = Date.now()
      const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
      const recent = await prisma.transaction.findMany({
        where: { userId: req.userId!, kind, status: 'completed', createdAt: { gte: monthAgo } },
        select: { amount: true, createdAt: true },
      })
      const monthSum = recent.reduce((s, t) => s + t.amount, 0)
      const daySum = recent.filter((t) => t.createdAt >= dayAgo).reduce((s, t) => s + t.amount, 0)
      if (dailyCap && daySum + amount > dailyCap) {
        res.status(429).json({ error: `Daily ${kind} cap exceeded`, limit: dailyCap, used: daySum, attempted: amount })
        return
      }
      if (monthlyCap && monthSum + amount > monthlyCap) {
        res.status(429).json({ error: `Monthly ${kind} cap exceeded`, limit: monthlyCap, used: monthSum, attempted: amount })
        return
      }
    }
  }

  // Atomically apply to balance + record transaction.
  // SECURITY: A regular user submitting a `deposit` only files a *request* —
  // it stays `pending` and does NOT credit the wallet until an admin
  // approves it from the admin console. Admins can self-deposit immediately.
  // Other kinds (withdraw / transfer / dividend / interest) keep the
  // existing immediate semantics.
  const isAdmin = req.userRole === 'admin'
  const userDepositRequiresApproval = kind === 'deposit' && !isAdmin

  const result = await prisma.$transaction(async (tx) => {
    if (userDepositRequiresApproval) {
      // Just record the pending transaction; do not touch balances.
      const transaction = await tx.transaction.create({
        data: {
          userId: req.userId!,
          kind,
          currency,
          amount,
          reference: reference ? `${reference} (pending review)` : 'Deposit request (pending review)',
          status: 'pending',
        },
      })
      // Make sure a wallet row exists at zero so the user sees the currency.
      const balance = await tx.walletBalance.upsert({
        where: { userId_currency: { userId: req.userId!, currency } },
        create: { userId: req.userId!, currency, symbol, balance: 0, available: 0 },
        update: { symbol },
      })
      return { balance, transaction, pendingApproval: true as const }
    }

    const existing = await tx.walletBalance.findUnique({
      where: { userId_currency: { userId: req.userId!, currency } },
    })
    const current = existing?.available ?? 0
    let nextBalance = existing?.balance ?? 0
    let nextAvailable = current

    if (kind === 'deposit' || kind === 'dividend' || kind === 'interest') {
      nextBalance += amount
      nextAvailable += amount
    } else {
      // withdraw or transfer both decrement
      if (current < amount) {
        throw Object.assign(new Error('Insufficient funds'), { status: 400 })
      }
      nextBalance -= amount
      nextAvailable -= amount
    }

    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId: req.userId!, currency } },
      create: {
        userId: req.userId!,
        currency,
        symbol,
        balance: nextBalance,
        available: nextAvailable,
      },
      update: { balance: nextBalance, available: nextAvailable, symbol },
    })

    const transaction = await tx.transaction.create({
      data: {
        userId: req.userId!,
        kind,
        currency,
        amount,
        reference,
        status: 'completed',
      },
    })

    return { balance, transaction }
  }).catch((err: Error & { status?: number }) => {
    return { error: err.message, status: err.status || 500 }
  })

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  res.status(201).json(result)
})

// --- User-to-user transfer ---------------------------------------------
// Lets a regular user send funds from one of their balances to another
// user identified by email. Subject to the same hold / IP / cap gates as a
// withdraw or transfer transaction. Atomic: either both sides update or
// neither does.
const userTransferSchema = z.object({
  recipientEmail: z.string().email(),
  currency: z.string().min(1).max(20),
  amount: z.number().positive(),
  note: z.string().max(200).optional(),
})

router.post('/transfer', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = userTransferSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { recipientEmail, currency, amount, note } = parsed.data

  const recipient = await prisma.user.findUnique({
    where: { email: recipientEmail.toLowerCase() },
    select: { id: true, email: true, name: true },
  })
  if (!recipient) {
    res.status(404).json({ error: 'No Verdexis user with that email' })
    return
  }
  if (recipient.id === req.userId) {
    res.status(400).json({ error: "You can't send to yourself" })
    return
  }

  // Same gating as a transfer transaction.
  const sender = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      email: true, name: true,
      holdActive: true, holdType: true, holdReason: true, holdNote: true,
      ipAllowlist: true,
      dailyTransferLimit: true, monthlyTransferLimit: true,
    },
  })
  if (sender?.holdActive && (sender.holdType === 'all' || sender.holdType === 'transfer')) {
    res.status(423).json({ error: 'Account on hold', reason: sender.holdReason, note: sender.holdNote, scope: sender.holdType })
    return
  }
  if (sender?.ipAllowlist && sender.ipAllowlist.trim()) {
    const allowed = sender.ipAllowlist.split(',').map((s) => s.trim()).filter(Boolean)
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || ''
    if (!allowed.some((entry) => ip === entry || ip.startsWith(entry))) {
      res.status(403).json({ error: 'Source IP not in allowlist for this account', ip })
      return
    }
  }
  if (sender?.dailyTransferLimit || sender?.monthlyTransferLimit) {
    const now = Date.now()
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const recent = await prisma.transaction.findMany({
      where: { userId: req.userId!, kind: 'transfer', status: 'completed', createdAt: { gte: monthAgo } },
      select: { amount: true, createdAt: true },
    })
    const monthSum = recent.reduce((s, t) => s + t.amount, 0)
    const daySum = recent.filter((t) => t.createdAt >= dayAgo).reduce((s, t) => s + t.amount, 0)
    if (sender.dailyTransferLimit && daySum + amount > sender.dailyTransferLimit) {
      res.status(429).json({ error: 'Daily transfer cap exceeded', limit: sender.dailyTransferLimit, used: daySum, attempted: amount })
      return
    }
    if (sender.monthlyTransferLimit && monthSum + amount > sender.monthlyTransferLimit) {
      res.status(429).json({ error: 'Monthly transfer cap exceeded', limit: sender.monthlyTransferLimit, used: monthSum, attempted: amount })
      return
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const senderBal = await tx.walletBalance.findUnique({
      where: { userId_currency: { userId: req.userId!, currency } },
    })
    if (!senderBal || senderBal.available < amount) {
      throw Object.assign(new Error('Insufficient funds'), { status: 400 })
    }
    const symbol = senderBal.symbol

    await tx.walletBalance.update({
      where: { userId_currency: { userId: req.userId!, currency } },
      data: { balance: senderBal.balance - amount, available: senderBal.available - amount },
    })
    await tx.walletBalance.upsert({
      where: { userId_currency: { userId: recipient.id, currency } },
      create: { userId: recipient.id, currency, symbol, balance: amount, available: amount },
      update: { balance: { increment: amount }, available: { increment: amount } },
    })

    const recipientLabel = recipient.name?.trim() || recipient.email
    const senderLabel = sender?.name?.trim() || sender?.email || 'a Verdexis user'
    const ref = `Transfer to ${recipientLabel}${note ? ' — ' + note : ''}`
    const incomingRef = `Transfer from ${senderLabel}${note ? ' — ' + note : ''}`
    const out = await tx.transaction.create({
      data: { userId: req.userId!, kind: 'transfer', currency, amount, reference: ref, status: 'completed' },
    })
    const incoming = await tx.transaction.create({
      data: { userId: recipient.id, kind: 'deposit', currency, amount, reference: incomingRef, status: 'completed', subType: 'user_transfer' },
    })
    await tx.notification.create({
      data: {
        userId: recipient.id,
        kind: 'transfer',
        title: `You received ${amount} ${currency}`,
        body: `${senderLabel} sent you ${amount} ${currency}${note ? ' — ' + note : ''}.`,
      },
    })
    return { out, incoming, recipient: { email: recipient.email, name: recipient.name } }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  res.status(201).json(result)
})

// Lightweight recipient lookup so the client can confirm the email is valid
// before showing the confirm step. Returns minimal info; does not leak whether
// the user exists for unauth callers (requireAuth required).
router.get('/lookup-recipient', requireAuth, async (req: AuthedRequest, res) => {
  const email = String(req.query.email ?? '').toLowerCase().trim()
  if (!email) { res.status(400).json({ error: 'email required' }); return }
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } })
  if (!u || u.id === req.userId) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ user: { email: u.email, name: u.name } })
})

export default router
