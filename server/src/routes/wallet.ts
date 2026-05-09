import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import type { Prisma } from '@prisma/client'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
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

// --- Self-custody wallet linking --------------------------------------
// Persist the user's connected EIP-1193 / WalletConnect address on their
// profile. Address is normalized to lowercase. We don't verify ownership
// here (no signature challenge yet) — that's a follow-up; for now this
// just gives admins/audit a record of which wallet a user claims is theirs.

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const CHAIN_HEX = /^0x[a-fA-F0-9]{1,16}$/

const linkWalletSchema = z.object({
  address: z.string().regex(ETH_ADDRESS, 'Not a valid 0x EVM address'),
  chainId: z.string().regex(CHAIN_HEX, 'chainId must be 0x-prefixed hex').optional(),
  provider: z.string().min(1).max(60).optional(),
})

router.get('/link', requireAuth, async (req: AuthedRequest, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { walletAddress: true, walletChainId: true, walletProvider: true, walletLinkedAt: true },
  })
  res.json({ wallet: u ?? null })
})

router.post('/link', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = linkWalletSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const address = parsed.data.address.toLowerCase()
  const chainId = parsed.data.chainId?.toLowerCase() ?? null
  const provider = parsed.data.provider ?? null

  // Add to the per-user list (dedupes by [userId, address]). New links land
  // primary only when the user has no other wallet yet \u2014 otherwise we
  // keep their existing primary so connecting a fresh wallet doesn't
  // silently change deposit attribution.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.walletLink.findUnique({
      where: { userId_address: { userId: req.userId!, address } },
    })
    const otherCount = await tx.walletLink.count({
      where: { userId: req.userId!, NOT: { address } },
    })
    const shouldBePrimary = existing?.isPrimary || otherCount === 0
    await tx.walletLink.upsert({
      where: { userId_address: { userId: req.userId!, address } },
      create: { userId: req.userId!, address, chainId, provider, isPrimary: shouldBePrimary },
      update: { chainId, provider, ...(shouldBePrimary ? { isPrimary: true } : {}) },
    })
    if (shouldBePrimary) {
      await mirrorPrimaryToUser(tx, req.userId!, { address, chainId, provider })
    }
  })

  const u = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { walletAddress: true, walletChainId: true, walletProvider: true, walletLinkedAt: true },
  })
  res.json({ wallet: u })
})

router.delete('/link', requireAuth, async (req: AuthedRequest, res) => {
  // Legacy "disconnect everything" endpoint \u2014 wipes ALL linked wallets.
  // The new picker uses DELETE /links/:id for surgical removal.
  await prisma.$transaction([
    prisma.walletLink.deleteMany({ where: { userId: req.userId! } }),
    prisma.user.update({
      where: { id: req.userId! },
      data: { walletAddress: null, walletChainId: null, walletProvider: null, walletLinkedAt: null },
    }),
  ])
  res.json({ ok: true })
})

// --- Multi-wallet API --------------------------------------------------
// Lets a user attach multiple self-custody addresses, pick one primary
// (mirrored back into User.walletAddress for legacy code paths), and
// remove individual entries without disconnecting all of them.

const walletLinkBodySchema = z.object({
  address: z.string().regex(ETH_ADDRESS, 'Not a valid 0x EVM address'),
  chainId: z.string().regex(CHAIN_HEX, 'chainId must be 0x-prefixed hex').optional(),
  provider: z.string().min(1).max(60).optional(),
  label: z.string().min(1).max(60).optional(),
  setPrimary: z.boolean().optional(),
})

async function mirrorPrimaryToUser(
  tx: Prisma.TransactionClient,
  userId: string,
  primary: { address: string | null; chainId: string | null; provider: string | null },
) {
  await (tx.user.update as (args: unknown) => Promise<unknown>)({
    where: { id: userId },
    data: {
      walletAddress: primary.address,
      walletChainId: primary.chainId,
      walletProvider: primary.provider,
      walletLinkedAt: primary.address ? new Date() : null,
    },
  })
}

router.get('/links', requireAuth, async (req: AuthedRequest, res) => {
  const links = await prisma.walletLink.findMany({
    where: { userId: req.userId! },
    orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'desc' }],
  })
  res.json({ links })
})

router.post('/links', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = walletLinkBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const address = parsed.data.address.toLowerCase()
  const chainId = parsed.data.chainId?.toLowerCase() ?? null
  const provider = parsed.data.provider ?? null
  const label = parsed.data.label ?? null

  const link = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletLink.findUnique({
      where: { userId_address: { userId: req.userId!, address } },
    })
    const otherCount = await tx.walletLink.count({
      where: { userId: req.userId!, NOT: { address } },
    })
    const wantsPrimary = parsed.data.setPrimary === true || otherCount === 0 || existing?.isPrimary === true
    if (wantsPrimary) {
      // Demote any other primary first \u2014 we enforce single-primary in app
      // logic rather than a db constraint to keep migrations simple.
      await tx.walletLink.updateMany({
        where: { userId: req.userId!, isPrimary: true, NOT: { address } },
        data: { isPrimary: false },
      })
    }
    const row = await tx.walletLink.upsert({
      where: { userId_address: { userId: req.userId!, address } },
      create: { userId: req.userId!, address, chainId, provider, label, isPrimary: wantsPrimary },
      update: {
        chainId, provider,
        ...(label !== null ? { label } : {}),
        ...(wantsPrimary ? { isPrimary: true } : {}),
      },
    })
    if (wantsPrimary) {
      await mirrorPrimaryToUser(tx, req.userId!, { address, chainId, provider })
    }
    return row
  })

  res.status(201).json({ link })
})

router.delete('/links/:id', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.walletLink.findFirst({ where: { id, userId: req.userId! } })
    if (!row) return { ok: false as const }
    await tx.walletLink.delete({ where: { id } })
    if (row.isPrimary) {
      // Promote the most recently-linked remaining wallet to primary so the
      // user always has a sensible default deposit destination.
      const next = await tx.walletLink.findFirst({
        where: { userId: req.userId! },
        orderBy: { linkedAt: 'desc' },
      })
      if (next) {
        await tx.walletLink.update({ where: { id: next.id }, data: { isPrimary: true } })
        await mirrorPrimaryToUser(tx, req.userId!, {
          address: next.address, chainId: next.chainId, provider: next.provider,
        })
      } else {
        await mirrorPrimaryToUser(tx, req.userId!, { address: null, chainId: null, provider: null })
      }
    }
    return { ok: true as const }
  })
  if (!result.ok) {
    res.status(404).json({ error: 'Wallet link not found' })
    return
  }
  res.json({ ok: true })
})

router.post('/links/:id/primary', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.walletLink.findFirst({ where: { id, userId: req.userId! } })
    if (!row) return { ok: false as const }
    await tx.walletLink.updateMany({
      where: { userId: req.userId!, isPrimary: true, NOT: { id } },
      data: { isPrimary: false },
    })
    await tx.walletLink.update({ where: { id }, data: { isPrimary: true } })
    await mirrorPrimaryToUser(tx, req.userId!, {
      address: row.address, chainId: row.chainId, provider: row.provider,
    })
    return { ok: true as const }
  })
  if (!result.ok) {
    res.status(404).json({ error: 'Wallet link not found' })
    return
  }
  res.json({ ok: true })
})

// --- On-chain pending deposits ----------------------------------------
// User completes a `sendTransaction` from their linked wallet to the admin
// treasury address. The frontend POSTs the resulting tx hash + chain here
// IMMEDIATELY (before confirmations). The row stays `pending` until an admin
// (or a future chain-watcher job) verifies the transaction on a block
// explorer and credits the user's WalletBalance via /admin endpoint.
//
// The unique index on txHash dedupes the same submit being fired twice.

const pendingDepositSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Not a valid 32-byte tx hash'),
  chainId: z.string().regex(CHAIN_HEX),
  toAddress: z.string().regex(ETH_ADDRESS),
  fromAddress: z.string().regex(ETH_ADDRESS),
  asset: z.string().min(1).max(12),
  amount: z.number().positive().max(1_000_000),
})

router.post('/pending-deposits', requireAuth, moneyLimiter, async (req: AuthedRequest, res) => {
  const parsed = pendingDepositSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const data = {
    userId: req.userId!,
    txHash: parsed.data.txHash.toLowerCase(),
    chainId: parsed.data.chainId.toLowerCase(),
    toAddress: parsed.data.toAddress.toLowerCase(),
    fromAddress: parsed.data.fromAddress.toLowerCase(),
    asset: parsed.data.asset.toUpperCase(),
    amount: parsed.data.amount,
    status: 'pending',
  }
  try {
    const row = await prisma.pendingDeposit.create({ data })
    // Fire a notification so the user sees the pending state in the bell.
    await prisma.notification.create({
      data: {
        userId: req.userId!,
        kind: 'deposit',
        title: `Deposit submitted: ${data.amount} ${data.asset}`,
        body: `On-chain transfer sent. Awaiting confirmations and admin review. Tx: ${data.txHash.slice(0, 14)}…`,
      },
    })
    res.status(201).json({ pendingDeposit: row })
  } catch (err) {
    // Most likely the unique tx-hash collision (user retried).
    const code = (err as { code?: string }).code
    if (code === 'P2002') {
      const existing = await prisma.pendingDeposit.findUnique({ where: { txHash: data.txHash } })
      res.status(200).json({ pendingDeposit: existing, deduped: true })
      return
    }
    throw err
  }
})

router.get('/pending-deposits', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.pendingDeposit.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json({ pendingDeposits: rows })
})

// --- Deposit instructions (admin-managed, all users read) -------------
// One JSON blob keyed `'deposit_instructions'` in AppSetting that stores:
//   { wires: [...], cryptos: [...], web3: { [chainIdHex]: {...} } }
// Admin writes from /admin pages, all signed-in users read.

const DEPOSIT_KEY = 'deposit_instructions'

router.get('/deposit-instructions', requireAuth, async (_req, res) => {
  const row = await prisma.appSetting.findUnique({ where: { key: DEPOSIT_KEY } })
  let data: unknown = null
  if (row?.value) {
    try { data = JSON.parse(row.value) } catch { data = null }
  }
  res.json({ instructions: data, updatedAt: row?.updatedAt ?? null })
})

router.put('/deposit-instructions', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const body = req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Body must be a JSON object' })
    return
  }
  const json = JSON.stringify(body)
  if (json.length > 64_000) {
    res.status(413).json({ error: 'Deposit instructions blob too large' })
    return
  }
  const row = await prisma.appSetting.upsert({
    where: { key: DEPOSIT_KEY },
    create: { key: DEPOSIT_KEY, value: json, updatedBy: req.userId! },
    update: { value: json, updatedBy: req.userId! },
  })
  // Audit so we know who changed deposit destinations and when.
  try {
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        action: 'deposit_instructions.update',
        payload: json.slice(0, 4000),
      },
    })
  } catch { /* don't fail the write because audit logging hiccupped */ }
  res.json({ instructions: body, updatedAt: row.updatedAt })
})

export default router
