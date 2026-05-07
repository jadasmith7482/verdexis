import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

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

router.post('/transactions', requireAuth, moneyLimiter, async (req: AuthedRequest, res) => {
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
  const result = await prisma.$transaction(async (tx) => {
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

export default router
