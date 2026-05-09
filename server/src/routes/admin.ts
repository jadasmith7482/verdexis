import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { getHistoricalPrice, getCurrentCryptoPrice } from '../historicalPrice.js'
import { generateInvestmentId } from '../investmentId.js'
import { idempotency } from '../idempotency.js'

const router = Router()

// Admin endpoints get a stricter limiter — these are operator-only.
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(adminLimiter)
router.use(requireAuth)
router.use(requireAdmin)

// --- helpers --------------------------------------------------------------

function publicUser(u: {
  id: string; email: string; name: string; avatar: string | null; prefs: string | null;
  twoFactor: boolean; role: string; suspended: boolean; suspendedReason: string | null;
  holdActive: boolean; holdType: string | null; holdReason: string | null; holdNote: string | null; holdAt: Date | null;
  kycStatus: string; kycNotes: string | null; kycReviewedAt: Date | null; kycReviewedBy: string | null;
  dailyWithdrawLimit: number | null; monthlyWithdrawLimit: number | null;
  dailyTransferLimit: number | null; monthlyTransferLimit: number | null;
  ipAllowlist: string | null;
  investmentId?: string | null;
  tokenVersion: number; createdAt: Date; updatedAt: Date;
}) {
  let prefs: Record<string, unknown> = {}
  try { if (u.prefs) prefs = JSON.parse(u.prefs) } catch { prefs = {} }
  return {
    id: u.id, email: u.email, name: u.name, avatar: u.avatar,
    twoFactor: u.twoFactor, role: u.role, suspended: u.suspended,
    suspendedReason: u.suspendedReason,
    holdActive: u.holdActive, holdType: u.holdType, holdReason: u.holdReason,
    holdNote: u.holdNote, holdAt: u.holdAt,
    kycStatus: u.kycStatus, kycNotes: u.kycNotes, kycReviewedAt: u.kycReviewedAt, kycReviewedBy: u.kycReviewedBy,
    dailyWithdrawLimit: u.dailyWithdrawLimit, monthlyWithdrawLimit: u.monthlyWithdrawLimit,
    dailyTransferLimit: u.dailyTransferLimit, monthlyTransferLimit: u.monthlyTransferLimit,
    ipAllowlist: u.ipAllowlist,
    investmentId: u.investmentId ?? null,
    tokenVersion: u.tokenVersion,
    createdAt: u.createdAt, updatedAt: u.updatedAt, prefs,
  }
}

async function audit(actorId: string, action: string, targetUserId: string | null, payload: unknown) {
  try {
    await prisma.adminAudit.create({
      data: {
        actorId,
        action,
        targetUserId: targetUserId ?? undefined,
        payload: payload === undefined ? null : JSON.stringify(payload).slice(0, 4000),
      },
    })
  } catch (e) {
    console.error('[admin audit] failed:', e)
  }
}

// --- stats ---------------------------------------------------------------

router.get('/stats', async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits, lastBroadcast] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { suspended: true } }),
    prisma.holding.count(),
    prisma.trade.count(),
    prisma.priceAlert.count({ where: { active: true } }),
    prisma.transaction.count({ where: { kind: 'deposit', createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { holdActive: true } }),
    prisma.user.count({ where: { kycStatus: 'pending' } }),
    prisma.transaction.count({ where: { kind: 'withdraw', createdAt: { gte: since } } }),
    prisma.transaction.count({ where: { kind: 'deposit', status: 'pending' } }),
    prisma.adminAudit.findFirst({ where: { action: 'notification.broadcast' }, orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true } } } }),
  ])
  const recentSignups = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }, take: 8,
    select: { id: true, email: true, name: true, createdAt: true, role: true, suspended: true },
  })
  const recentTx = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' }, take: 10,
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.json({
    stats: { users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits },
    lastBroadcast: lastBroadcast ? { at: lastBroadcast.createdAt, by: lastBroadcast.actor?.email ?? null, payload: lastBroadcast.payload } : null,
    recentSignups, recentTx,
  })
})

// --- users list / search -------------------------------------------------

const listSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  role: z.enum(['user', 'admin', 'all']).default('all'),
  suspended: z.enum(['true', 'false', 'all']).default('all'),
})

router.get('/users', async (req, res) => {
  const parsed = listSchema.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return }
  const { q, page, limit, role, suspended } = parsed.data
  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { name: { contains: q } },
      { id: { equals: q } },
      { investmentId: { equals: q } },
    ]
  }
  if (role !== 'all') where.role = role
  if (suspended !== 'all') where.suspended = suspended === 'true'
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
      select: {
        id: true, email: true, name: true, role: true, suspended: true,
        twoFactor: true, createdAt: true, updatedAt: true, investmentId: true,
        _count: { select: { holdings: true, trades: true, transactions: true, alerts: true } },
      },
    }),
  ])
  res.json({ users, total, page, limit })
})

// --- create user ---------------------------------------------------------

const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/, 'Username must be 3-40 chars: letters, numbers, _, ., -').toLowerCase().optional(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(200),
  role: z.enum(['user', 'admin']).default('user'),
  initialUsdBalance: z.number().nonnegative().optional(),
})

router.post('/users', async (req: AuthedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (exists) { res.status(409).json({ error: 'A user with that email already exists' }); return }
  if (parsed.data.username) {
    const u2 = await prisma.user.findUnique({ where: { username: parsed.data.username } })
    if (u2) { res.status(409).json({ error: 'That username is already taken' }); return }
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  try {
    const investmentId = await generateInvestmentId()
    const u = await prisma.user.create({
      data: {
        email: parsed.data.email,
        username: parsed.data.username ?? null,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        investmentId,
      },
    })
    if (parsed.data.initialUsdBalance && parsed.data.initialUsdBalance > 0) {
      await prisma.walletBalance.create({
        data: { userId: u.id, currency: 'USD', symbol: '$', balance: parsed.data.initialUsdBalance, available: parsed.data.initialUsdBalance },
      })
      await prisma.transaction.create({
        data: { userId: u.id, kind: 'deposit', currency: 'USD', amount: parsed.data.initialUsdBalance, status: 'completed', reference: 'Opening balance' },
      })
    }
    await audit(req.userId!, 'user.create', u.id, { email: parsed.data.email, role: parsed.data.role, investmentId: u.investmentId, initialUsdBalance: parsed.data.initialUsdBalance ?? 0 })
    res.status(201).json({ user: publicUser(u) })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- single user (full profile) -----------------------------------------

router.get('/users/:id', async (req, res) => {
  const id = req.params.id
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) { res.status(404).json({ error: 'Not found' }); return }
  const [holdings, walletBalances, transactions, trades, watchlist, alerts, notifications] = await Promise.all([
    prisma.holding.findMany({ where: { userId: id }, orderBy: { symbol: 'asc' } }),
    prisma.walletBalance.findMany({ where: { userId: id }, orderBy: { currency: 'asc' } }),
    prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.trade.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.watchlist.findMany({ where: { userId: id }, orderBy: { symbol: 'asc' } }),
    prisma.priceAlert.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ])
  res.json({
    user: publicUser(user),
    holdings, walletBalances, transactions, trades, watchlist, alerts, notifications,
  })
})

// --- update profile ------------------------------------------------------

const patchUserSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().toLowerCase().optional(),
  avatar: z.string().nullable().optional(),
  role: z.enum(['user', 'admin']).optional(),
  suspended: z.boolean().optional(),
  suspendedReason: z.string().max(500).nullable().optional(),
  twoFactor: z.boolean().optional(),
  prefs: z.record(z.unknown()).optional(),
  // Allow admins to backdate (or post-date) the join date for an account.
  createdAt: z.string().datetime().optional(),
})

router.patch('/users/:id', async (req: AuthedRequest, res) => {
  const id = req.params.id
  const parsed = patchUserSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const data: Record<string, unknown> = { ...parsed.data }
  if ('prefs' in data) data.prefs = JSON.stringify(data.prefs ?? {})
  if (typeof parsed.data.createdAt === 'string') data.createdAt = new Date(parsed.data.createdAt)
  // Don't let admin demote themselves to last-admin and lock everyone out.
  if (parsed.data.role === 'user' && id === req.userId!) {
    const otherAdmins = await prisma.user.count({ where: { role: 'admin', NOT: { id } } })
    if (otherAdmins === 0) { res.status(400).json({ error: 'Cannot demote the last admin' }); return }
  }
  // Don't let admin suspend their own account either.
  if (parsed.data.suspended === true && id === req.userId!) {
    res.status(400).json({ error: 'Cannot suspend your own account' }); return
  }
  // Suspending a user revokes their sessions.
  if (parsed.data.suspended === true) (data as { tokenVersion?: number }).tokenVersion = { increment: 1 } as never
  try {
    const updated = await prisma.user.update({ where: { id }, data: data as never })
    await audit(req.userId!, 'user.update', id, parsed.data)
    res.json({ user: publicUser(updated) })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- force-set password --------------------------------------------------

router.post('/users/:id/password', async (req: AuthedRequest, res) => {
  const schema = z.object({ password: z.string().min(8).max(200), revokeSessions: z.boolean().default(true) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const data: { passwordHash: string; tokenVersion?: { increment: number } } = { passwordHash }
  if (parsed.data.revokeSessions) data.tokenVersion = { increment: 1 }
  await prisma.user.update({ where: { id: req.params.id }, data })
  await audit(req.userId!, 'user.password.reset', req.params.id, { revokeSessions: parsed.data.revokeSessions })
  res.json({ ok: true })
})

// --- revoke sessions only -----------------------------------------------

router.post('/users/:id/revoke', async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { tokenVersion: { increment: 1 } } })
  await audit(req.userId!, 'user.sessions.revoke', req.params.id, null)
  res.json({ ok: true })
})

// --- delete user ---------------------------------------------------------

router.delete('/users/:id', async (req: AuthedRequest, res) => {
  if (req.params.id === req.userId) { res.status(400).json({ error: 'Cannot delete yourself' }); return }
  await prisma.user.delete({ where: { id: req.params.id } })
  await audit(req.userId!, 'user.delete', req.params.id, null)
  res.json({ ok: true })
})

// --- holdings ------------------------------------------------------------

const holdingSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(100),
  amount: z.number().nonnegative(),
  avgPrice: z.number().nonnegative(),
  type: z.enum(['crypto', 'stock', 'etf']).default('crypto'),
})

router.post('/users/:id/holdings', async (req: AuthedRequest, res) => {
  const parsed = holdingSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const userId = req.params.id
  const h = await prisma.holding.upsert({
    where: { userId_symbol: { userId, symbol: parsed.data.symbol } },
    create: { userId, ...parsed.data },
    update: parsed.data,
  })
  await audit(req.userId!, 'holding.upsert', userId, parsed.data)
  res.json({ holding: h })
})

router.patch('/holdings/:hid', async (req: AuthedRequest, res) => {
  const partial = holdingSchema.partial().safeParse(req.body)
  if (!partial.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const h = await prisma.holding.update({ where: { id: req.params.hid }, data: partial.data })
  await audit(req.userId!, 'holding.update', h.userId, partial.data)
  res.json({ holding: h })
})

router.delete('/holdings/:hid', async (req: AuthedRequest, res) => {
  const h = await prisma.holding.delete({ where: { id: req.params.hid } })
  await audit(req.userId!, 'holding.delete', h.userId, { id: h.id, symbol: h.symbol })
  res.json({ ok: true })
})

// --- wallet balances -----------------------------------------------------

const walletSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  symbol: z.string().min(1).max(10),
  balance: z.number(),
  available: z.number(),
})

router.post('/users/:id/wallet', async (req: AuthedRequest, res) => {
  const parsed = walletSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const userId = req.params.id
  const w = await prisma.walletBalance.upsert({
    where: { userId_currency: { userId, currency: parsed.data.currency } },
    create: { userId, ...parsed.data },
    update: parsed.data,
  })
  await audit(req.userId!, 'wallet.set', userId, parsed.data)
  res.json({ balance: w })
})

router.delete('/wallet/:wid', async (req: AuthedRequest, res) => {
  const w = await prisma.walletBalance.delete({ where: { id: req.params.wid } })
  await audit(req.userId!, 'wallet.delete', w.userId, { currency: w.currency })
  res.json({ ok: true })
})

// --- deposit / deduct (atomic balance + transaction in one call) --------

// Canonical reason codes the UI offers. Free-form `note` is also stored.
const DEPOSIT_REASONS = [
  'manual_bank_wire', 'manual_crypto', 'promo_credit', 'refund', 'chargeback_reversal',
  'bonus_referral', 'compensation', 'correction_undercharge', 'other',
] as const
const DEDUCT_REASONS = [
  'manual_bank_wire', 'manual_crypto', 'fee', 'chargeback', 'fraud_reversal',
  'compliance_sanctions', 'correction_overcharge', 'court_order', 'other',
] as const

const depositSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  symbol: z.string().min(1).max(10).optional(),
  amount: z.number().positive(),
  reason: z.enum(DEPOSIT_REASONS).default('manual_bank_wire'),
  note: z.string().max(500).optional(),
  status: z.enum(['pending', 'completed']).default('completed'),
  notify: z.boolean().default(true),
  // ISO-8601 timestamp the deposit should be recorded as having occurred.
  // Lets admin backdate. Defaults to now. Cannot be in the future.
  occurredAt: z.string().datetime().optional(),
  // Optional: instead of crediting the wallet as cash, treat the deposit as
  // having been used to buy this asset on `occurredAt`. The server fetches
  // the historical spot price for that date and creates/updates a Holding
  // sized at amount/historicalPrice with avgPrice = historicalPrice. The
  // dashboard then computes profit/loss naturally from current price.
  investAs: z
    .object({
      symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
      name: z.string().min(1).max(100),
      type: z.enum(['crypto', 'stock', 'etf']).default('crypto'),
    })
    .optional(),
})

router.post('/users/:id/deposit', idempotency(), async (req: AuthedRequest, res) => {
  const parsed = depositSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!exists) { res.status(404).json({ error: 'User not found' }); return }
  const symbol = parsed.data.symbol ?? (parsed.data.currency === 'USD' ? '$' : parsed.data.currency)

  // Resolve and validate the backdate. Cap at "now" so admin cannot create
  // future-dated deposits (which would break PnL math).
  const now = new Date()
  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : now
  if (isNaN(occurredAt.getTime())) {
    res.status(400).json({ error: 'occurredAt is not a valid date' }); return
  }
  if (occurredAt.getTime() > now.getTime() + 60_000) {
    res.status(400).json({ error: 'occurredAt cannot be in the future' }); return
  }

  // --- Path A: invest the deposit into a real asset at the historical price.
  if (parsed.data.investAs) {
    const { symbol: assetSymbol, name: assetName, type: assetType } = parsed.data.investAs
    const histPrice = await getHistoricalPrice(assetSymbol, assetType, occurredAt)
    if (!histPrice || histPrice <= 0) {
      res.status(422).json({
        error: `Could not fetch historical price for ${assetSymbol} on ${occurredAt.toISOString().slice(0, 10)}. Try a different date or asset.`,
      })
      return
    }
    const quantity = parsed.data.amount / histPrice
    const currentPrice = assetType === 'crypto' ? await getCurrentCryptoPrice(assetSymbol) : null
    const reference = `Deposit invested as ${quantity.toFixed(8)} ${assetSymbol} @ $${histPrice.toFixed(2)} on ${occurredAt.toISOString().slice(0, 10)}${parsed.data.note ? ' — ' + parsed.data.note : ''}`

    const result = await prisma.$transaction(async (tx) => {
      const existingHolding = await tx.holding.findUnique({ where: { userId_symbol: { userId, symbol: assetSymbol } } })
      // Weighted-average-cost merge if a holding already exists for this symbol.
      const newQty = (existingHolding?.amount ?? 0) + quantity
      const newAvg = existingHolding && existingHolding.amount > 0
        ? ((existingHolding.amount * existingHolding.avgPrice) + (quantity * histPrice)) / newQty
        : histPrice
      const holding = await tx.holding.upsert({
        where: { userId_symbol: { userId, symbol: assetSymbol } },
        create: { userId, symbol: assetSymbol, name: assetName, amount: newQty, avgPrice: newAvg, type: assetType, createdAt: occurredAt },
        update: { amount: newQty, avgPrice: newAvg, name: assetName, type: assetType },
      })
      const transaction = await tx.transaction.create({
        data: {
          userId,
          kind: 'deposit',
          currency: parsed.data.currency,
          amount: parsed.data.amount,
          status: parsed.data.status,
          reference,
          createdAt: occurredAt,
        },
      })
      return { holding, transaction }
    })

    if (parsed.data.notify) {
      const pnl = currentPrice ? (currentPrice - histPrice) * quantity : null
      const pnlNote = pnl !== null ? ` Current value: $${(currentPrice! * quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}).` : ''
      await prisma.notification.create({
        data: {
          userId,
          kind: 'deposit',
          title: `${symbol}${parsed.data.amount.toLocaleString()} ${parsed.data.currency} invested as ${quantity.toFixed(6)} ${assetSymbol}`,
          body: `Position opened at $${histPrice.toFixed(2)} on ${occurredAt.toISOString().slice(0, 10)}.${pnlNote}`,
        },
      }).catch(() => { /* best-effort */ })
    }
    await audit(req.userId!, 'wallet.deposit.invested', userId, {
      ...parsed.data,
      occurredAt: occurredAt.toISOString(),
      historicalPrice: histPrice,
      quantity,
      currentPrice,
    })
    res.status(201).json({
      holding: result.holding,
      transaction: result.transaction,
      historicalPrice: histPrice,
      quantity,
      currentPrice,
      unrealizedPnl: currentPrice ? (currentPrice - histPrice) * quantity : null,
      unrealizedPnlPct: currentPrice ? ((currentPrice - histPrice) / histPrice) * 100 : null,
    })
    return
  }

  // --- Path B: classic cash deposit (credit the wallet balance).
  const reference = `Account credit${parsed.data.note ? ' — ' + parsed.data.note : ''}${parsed.data.occurredAt ? ` (effective ${occurredAt.toISOString().slice(0, 10)})` : ''}`
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletBalance.findUnique({ where: { userId_currency: { userId, currency: parsed.data.currency } } })
    const nextBalance = (existing?.balance ?? 0) + parsed.data.amount
    const nextAvailable = (existing?.available ?? 0) + (parsed.data.status === 'completed' ? parsed.data.amount : 0)
    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId, currency: parsed.data.currency } },
      create: { userId, currency: parsed.data.currency, symbol, balance: nextBalance, available: nextAvailable },
      update: { balance: nextBalance, available: nextAvailable, symbol },
    })
    const transaction = await tx.transaction.create({
      data: {
        userId,
        kind: 'deposit',
        currency: parsed.data.currency,
        amount: parsed.data.amount,
        status: parsed.data.status,
        reference,
        createdAt: occurredAt,
      },
    })
    return { balance, transaction }
  })
  if (parsed.data.notify) {
    await prisma.notification.create({
      data: { userId, kind: 'deposit', title: `${symbol}${parsed.data.amount.toLocaleString()} ${parsed.data.currency} credited`, body: reference },
    }).catch(() => { /* notification is best-effort */ })
  }
  await audit(req.userId!, 'wallet.deposit', userId, { ...parsed.data, occurredAt: occurredAt.toISOString() })
  res.status(201).json(result)
})

const deductSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  symbol: z.string().min(1).max(10).optional(),
  amount: z.number().positive(),
  reason: z.enum(DEDUCT_REASONS).default('fee'),
  note: z.string().max(500).optional(),
  status: z.enum(['pending', 'completed', 'reversed']).default('completed'),
  allowNegative: z.boolean().default(false),
  notify: z.boolean().default(true),
})

router.post('/users/:id/deduct', async (req: AuthedRequest, res) => {
  const parsed = deductSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!exists) { res.status(404).json({ error: 'User not found' }); return }
  const symbol = parsed.data.symbol ?? (parsed.data.currency === 'USD' ? '$' : parsed.data.currency)
  const reference = `Account adjustment${parsed.data.note ? ' — ' + parsed.data.note : ''}`
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletBalance.findUnique({ where: { userId_currency: { userId, currency: parsed.data.currency } } })
    const currentAvail = existing?.available ?? 0
    if (!parsed.data.allowNegative && currentAvail < parsed.data.amount) {
      throw Object.assign(new Error(`Insufficient available balance (${currentAvail} ${parsed.data.currency})`), { status: 400 })
    }
    const nextBalance = (existing?.balance ?? 0) - parsed.data.amount
    const nextAvailable = currentAvail - parsed.data.amount
    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId, currency: parsed.data.currency } },
      create: { userId, currency: parsed.data.currency, symbol, balance: nextBalance, available: nextAvailable },
      update: { balance: nextBalance, available: nextAvailable, symbol },
    })
    const transaction = await tx.transaction.create({
      data: { userId, kind: 'withdraw', currency: parsed.data.currency, amount: parsed.data.amount, status: parsed.data.status, reference },
    })
    return { balance, transaction }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))
  if ('error' in result) { res.status(result.status || 500).json({ error: result.error }); return }
  if (parsed.data.notify) {
    await prisma.notification.create({
      data: { userId, kind: 'system', title: `${symbol}${parsed.data.amount.toLocaleString()} ${parsed.data.currency} debited`, body: reference },
    }).catch(() => { /* best-effort */ })
  }
  await audit(req.userId!, 'wallet.deduct', userId, parsed.data)
  res.status(201).json(result)
})

// --- account hold (less drastic than suspend) ----------------------------

const HOLD_REASONS = [
  'aml_kyc_review', 'suspected_fraud', 'document_verification', 'court_order',
  'sanctions_screening', 'chargeback_investigation', 'compliance_review',
  'suspicious_activity', 'user_requested_freeze', 'pending_transfer_review', 'other',
] as const
const HOLD_TYPES = ['all', 'withdraw', 'transfer'] as const

const holdSchema = z.object({
  holdType: z.enum(HOLD_TYPES).default('all'),
  reason: z.enum(HOLD_REASONS).default('compliance_review'),
  note: z.string().max(500).optional(),
  notify: z.boolean().default(true),
})

router.post('/users/:id/hold', async (req: AuthedRequest, res) => {
  const parsed = holdSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  if (userId === req.userId) { res.status(400).json({ error: 'Cannot place a hold on your own account' }); return }
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      holdActive: true,
      holdType: parsed.data.holdType,
      holdReason: parsed.data.reason,
      holdNote: parsed.data.note ?? null,
      holdAt: new Date(),
    },
  })
  if (parsed.data.notify) {
    await prisma.notification.create({
      data: { userId, kind: 'system', title: 'Account hold placed', body: `Scope: ${parsed.data.holdType}. Reason: ${parsed.data.reason}.${parsed.data.note ? ' Note: ' + parsed.data.note : ''}` },
    }).catch(() => { /* best-effort */ })
  }
  await audit(req.userId!, 'user.hold.place', userId, parsed.data)
  res.json({ user: publicUser(u) })
})

router.post('/users/:id/unhold', async (req: AuthedRequest, res) => {
  const userId = req.params.id
  const u = await prisma.user.update({
    where: { id: userId },
    data: { holdActive: false, holdType: null, holdReason: null, holdNote: null, holdAt: null },
  })
  await prisma.notification.create({
    data: { userId, kind: 'system', title: 'Account hold released', body: 'Your account is no longer subject to a hold.' },
  }).catch(() => { /* best-effort */ })
  await audit(req.userId!, 'user.hold.release', userId, null)
  res.json({ user: publicUser(u) })
})

const txSchema = z.object({
  kind: z.enum(['deposit', 'withdraw', 'transfer', 'dividend', 'interest']),
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  amount: z.number(),
  status: z.enum(['pending', 'completed', 'failed', 'reversed']).default('completed'),
  reference: z.string().max(200).optional(),
  // Admin-editable timestamp. Lets ops backdate / correct deposit dates so
  // history reflects the real banking date instead of the keystroke time.
  createdAt: z.string().datetime().optional(),
})

router.post('/users/:id/transactions', async (req: AuthedRequest, res) => {
  const parsed = txSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const { createdAt, ...rest } = parsed.data
  const userId = req.params.id

  // Determine the cash-flow direction this transaction should have on the
  // wallet balance. Credits add, debits subtract. We only move money when
  // status === 'completed' (pending/failed/reversed don't change the
  // ledger). Sign on `amount` is normalised: admins enter a positive
  // number for both credit and debit kinds.
  const credits = new Set(['deposit', 'dividend', 'interest'])
  const debits = new Set(['withdraw', 'transfer'])
  const magnitude = Math.abs(rest.amount)
  const delta = rest.status === 'completed'
    ? (credits.has(rest.kind) ? magnitude : debits.has(rest.kind) ? -magnitude : 0)
    : 0
  const symbol = rest.currency === 'USD' ? '$' : rest.currency

  const result = await prisma.$transaction(async (db) => {
    let balance = null as Awaited<ReturnType<typeof db.walletBalance.upsert>> | null
    if (delta !== 0) {
      const existing = await db.walletBalance.findUnique({
        where: { userId_currency: { userId, currency: rest.currency } },
      })
      const nextBalance = (existing?.balance ?? 0) + delta
      const nextAvailable = (existing?.available ?? 0) + delta
      balance = await db.walletBalance.upsert({
        where: { userId_currency: { userId, currency: rest.currency } },
        create: { userId, currency: rest.currency, symbol, balance: nextBalance, available: nextAvailable },
        update: { balance: nextBalance, available: nextAvailable, symbol },
      })
    }
    const transaction = await db.transaction.create({
      data: {
        userId,
        ...rest,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    })
    return { balance, transaction }
  })

  // Fire a notification so the end-user's NotificationBell poll triggers
  // a portfolio refresh in the SPA. Best-effort; failures shouldn't break
  // the admin action.
  if (delta !== 0) {
    const verb = delta > 0 ? 'credited' : 'debited'
    await prisma.notification.create({
      data: {
        userId,
        kind: rest.kind,
        title: `${symbol}${magnitude.toLocaleString()} ${rest.currency} ${verb}`,
        body: rest.reference || `Admin ${rest.kind} (${rest.status})`,
      },
    }).catch(() => { /* notification is best-effort */ })
  }

  await audit(req.userId!, 'transaction.create', userId, { ...parsed.data, walletDelta: delta })
  res.json({ transaction: result.transaction, balance: result.balance })
})

router.patch('/transactions/:tid', async (req: AuthedRequest, res) => {
  const partial = txSchema.partial().safeParse(req.body)
  if (!partial.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const { createdAt, ...rest } = partial.data
  const data: Record<string, unknown> = { ...rest }
  if (createdAt) data.createdAt = new Date(createdAt)
  const t = await prisma.transaction.update({ where: { id: req.params.tid }, data })
  await audit(req.userId!, 'transaction.update', t.userId, partial.data)
  res.json({ transaction: t })
})

router.delete('/transactions/:tid', async (req: AuthedRequest, res) => {
  const t = await prisma.transaction.delete({ where: { id: req.params.tid } })
  await audit(req.userId!, 'transaction.delete', t.userId, { id: t.id })
  res.json({ ok: true })
})

// --- pending deposit approval queue --------------------------------------
// Regular users can only file deposit *requests* (POST /api/wallet/transactions
// with kind='deposit'). Those land here with status='pending' and DO NOT
// credit the wallet. An admin must explicitly approve before funds are
// available.

router.get('/deposits/pending', async (_req, res) => {
  const items = await prisma.transaction.findMany({
    where: { kind: 'deposit', status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true, kycStatus: true, suspended: true } } },
  })
  res.json({ deposits: items })
})

router.post('/deposits/:tid/approve', idempotency(), async (req: AuthedRequest, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.tid } })
  if (!tx) { res.status(404).json({ error: 'Deposit request not found' }); return }
  if (tx.kind !== 'deposit') { res.status(400).json({ error: 'Not a deposit transaction' }); return }
  if (tx.status !== 'pending') { res.status(409).json({ error: `Already ${tx.status}` }); return }
  const symbol = tx.currency === 'USD' ? '$' : tx.currency

  const result = await prisma.$transaction(async (db) => {
    const existing = await db.walletBalance.findUnique({ where: { userId_currency: { userId: tx.userId, currency: tx.currency } } })
    const nextBalance = (existing?.balance ?? 0) + tx.amount
    const nextAvailable = (existing?.available ?? 0) + tx.amount
    const balance = await db.walletBalance.upsert({
      where: { userId_currency: { userId: tx.userId, currency: tx.currency } },
      create: { userId: tx.userId, currency: tx.currency, symbol, balance: nextBalance, available: nextAvailable },
      update: { balance: nextBalance, available: nextAvailable, symbol },
    })
    const updated = await db.transaction.update({
      where: { id: tx.id },
      data: { status: 'completed', reference: (tx.reference || 'Deposit').replace(/\s*\((?:awaiting admin approval|pending review)\)$/i, '') + ' (approved)' },
    })
    return { balance, transaction: updated }
  })
  await prisma.notification.create({
    data: {
      userId: tx.userId,
      kind: 'deposit',
      title: `Deposit approved: ${symbol}${tx.amount.toLocaleString()} ${tx.currency}`,
      body: 'Your deposit request has been approved and credited to your wallet.',
    },
  }).catch(() => { /* best-effort */ })
  await audit(req.userId!, 'deposit.approve', tx.userId, { id: tx.id, currency: tx.currency, amount: tx.amount })
  res.json(result)
})

router.post('/deposits/:tid/reject', async (req: AuthedRequest, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : ''
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.tid } })
  if (!tx) { res.status(404).json({ error: 'Deposit request not found' }); return }
  if (tx.kind !== 'deposit') { res.status(400).json({ error: 'Not a deposit transaction' }); return }
  if (tx.status !== 'pending') { res.status(409).json({ error: `Already ${tx.status}` }); return }
  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      status: 'failed',
      reference: (tx.reference || 'Deposit').replace(/\s*\((?:awaiting admin approval|pending review)\)$/i, '') + (reason ? ` (rejected: ${reason})` : ' (rejected)'),
    },
  })
  await prisma.notification.create({
    data: {
      userId: tx.userId,
      kind: 'deposit',
      title: `Deposit rejected: ${tx.currency === 'USD' ? '$' : tx.currency}${tx.amount.toLocaleString()} ${tx.currency}`,
      body: reason || 'Your deposit request was not approved. Contact support for details.',
    },
  }).catch(() => { /* best-effort */ })
  await audit(req.userId!, 'deposit.reject', tx.userId, { id: tx.id, reason })
  res.json({ transaction: updated })
})

// --- trades --------------------------------------------------------------

const tradeSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().nonnegative(),
})

router.post('/users/:id/trades', async (req: AuthedRequest, res) => {
  const parsed = tradeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const total = parsed.data.amount * parsed.data.price
  const t = await prisma.trade.create({ data: { userId: req.params.id, ...parsed.data, total } })
  await audit(req.userId!, 'trade.create', req.params.id, parsed.data)
  res.json({ trade: t })
})

router.delete('/trades/:tid', async (req: AuthedRequest, res) => {
  const t = await prisma.trade.delete({ where: { id: req.params.tid } })
  await audit(req.userId!, 'trade.delete', t.userId, { id: t.id })
  res.json({ ok: true })
})

// --- alerts --------------------------------------------------------------

const alertSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(100),
  direction: z.enum(['above', 'below']),
  target: z.number().positive(),
  active: z.boolean().default(true),
})

router.post('/users/:id/alerts', async (req: AuthedRequest, res) => {
  const parsed = alertSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const a = await prisma.priceAlert.create({ data: { userId: req.params.id, ...parsed.data } })
  await audit(req.userId!, 'alert.create', req.params.id, parsed.data)
  res.json({ alert: a })
})

router.delete('/alerts/:aid', async (req: AuthedRequest, res) => {
  const a = await prisma.priceAlert.delete({ where: { id: req.params.aid } })
  await audit(req.userId!, 'alert.delete', a.userId, { id: a.id })
  res.json({ ok: true })
})

// --- watchlist -----------------------------------------------------------

router.delete('/watchlist/:wid', async (req: AuthedRequest, res) => {
  const w = await prisma.watchlist.delete({ where: { id: req.params.wid } })
  await audit(req.userId!, 'watchlist.delete', w.userId, { symbol: w.symbol })
  res.json({ ok: true })
})

// --- notifications -------------------------------------------------------

const notifSchema = z.object({
  kind: z.enum(['alert', 'trade', 'deposit', 'system']).default('system'),
  title: z.string().min(1).max(120),
  body: z.string().max(2000).optional(),
})

router.post('/users/:id/notifications', async (req: AuthedRequest, res) => {
  const parsed = notifSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const n = await prisma.notification.create({ data: { userId: req.params.id, ...parsed.data } })
  await audit(req.userId!, 'notification.create', req.params.id, parsed.data)
  res.json({ notification: n })
})

router.delete('/notifications/:nid', async (req: AuthedRequest, res) => {
  const n = await prisma.notification.delete({ where: { id: req.params.nid } })
  await audit(req.userId!, 'notification.delete', n.userId, { id: n.id })
  res.json({ ok: true })
})

// --- broadcast notification to all (or filtered) users -------------------

router.post('/broadcast', async (req: AuthedRequest, res) => {
  const parsed = notifSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const users = await prisma.user.findMany({ where: { suspended: false }, select: { id: true } })
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, ...parsed.data })),
  })
  await audit(req.userId!, 'notification.broadcast', null, { count: users.length, ...parsed.data })
  res.json({ ok: true, count: users.length })
})

// --- audit log -----------------------------------------------------------

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(100),
  actorId: z.string().optional(),
  targetUserId: z.string().optional(),
  action: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  q: z.string().optional(),
})

router.get('/audit', async (req, res) => {
  const parsed = auditQuerySchema.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return }
  const { limit, actorId, targetUserId, action, since, until, q } = parsed.data
  const where: Record<string, unknown> = {}
  if (actorId) where.actorId = actorId
  if (targetUserId) where.targetUserId = targetUserId
  if (action) where.action = { contains: action }
  if (since || until) {
    const range: Record<string, Date> = {}
    if (since) { const d = new Date(since); if (!isNaN(d.getTime())) range.gte = d }
    if (until) { const d = new Date(until); if (!isNaN(d.getTime())) range.lte = d }
    if (Object.keys(range).length) where.createdAt = range
  }
  if (q) where.payload = { contains: q }
  const logs = await prisma.adminAudit.findMany({
    where, orderBy: { createdAt: 'desc' }, take: limit,
    include: {
      actor: { select: { id: true, email: true, name: true } },
      target: { select: { id: true, email: true, name: true } },
    },
  })
  res.json({ audit: logs })
})

// CSV export of audit log (uses the same filters)
router.get('/audit.csv', async (req, res) => {
  const parsed = auditQuerySchema.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return }
  const { limit, actorId, targetUserId, action, since, until, q } = parsed.data
  const where: Record<string, unknown> = {}
  if (actorId) where.actorId = actorId
  if (targetUserId) where.targetUserId = targetUserId
  if (action) where.action = { contains: action }
  if (since || until) {
    const range: Record<string, Date> = {}
    if (since) { const d = new Date(since); if (!isNaN(d.getTime())) range.gte = d }
    if (until) { const d = new Date(until); if (!isNaN(d.getTime())) range.lte = d }
    if (Object.keys(range).length) where.createdAt = range
  }
  if (q) where.payload = { contains: q }
  const logs = await prisma.adminAudit.findMany({
    where, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 5000),
    include: {
      actor: { select: { email: true, name: true } },
      target: { select: { email: true, name: true } },
    },
  })
  const esc = (v: string | null | undefined) => {
    const s = (v ?? '').toString().replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const header = 'createdAt,actorEmail,actorName,action,targetEmail,targetName,payload'
  const rows = logs.map((l) => [
    l.createdAt.toISOString(),
    l.actor?.email ?? '',
    l.actor?.name ?? '',
    l.action,
    l.target?.email ?? '',
    l.target?.name ?? '',
    l.payload ?? '',
  ].map(esc).join(','))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send([header, ...rows].join('\n'))
})

// Per-user audit timeline (both as actor and target)
router.get('/users/:id/audit', async (req, res) => {
  const id = req.params.id
  const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1000)
  const logs = await prisma.adminAudit.findMany({
    where: { OR: [{ targetUserId: id }, { actorId: id }] },
    orderBy: { createdAt: 'desc' }, take: limit,
    include: {
      actor: { select: { id: true, email: true, name: true } },
      target: { select: { id: true, email: true, name: true } },
    },
  })
  res.json({ audit: logs })
})

// --- bulk actions on users ----------------------------------------------

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(['hold', 'release', 'suspend', 'unsuspend', 'delete', 'revoke']),
  reason: z.string().max(500).optional(),
  holdType: z.enum(['all', 'withdraw', 'transfer']).optional(),
  notify: z.boolean().default(true),
})

router.post('/users/bulk', async (req: AuthedRequest, res) => {
  const parsed = bulkSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const { ids, action, reason, holdType, notify } = parsed.data
  // Self-protection: never let admin act on themselves through bulk.
  const targets = ids.filter((id) => id !== req.userId)
  if (!targets.length) { res.status(400).json({ error: 'No valid targets (cannot bulk-act on yourself)' }); return }
  let touched = 0
  if (action === 'delete') {
    const r = await prisma.user.deleteMany({ where: { id: { in: targets } } })
    touched = r.count
  } else if (action === 'suspend') {
    const r = await prisma.user.updateMany({ where: { id: { in: targets } }, data: { suspended: true, suspendedReason: reason ?? 'Bulk suspended', tokenVersion: { increment: 1 } } })
    touched = r.count
  } else if (action === 'unsuspend') {
    const r = await prisma.user.updateMany({ where: { id: { in: targets } }, data: { suspended: false, suspendedReason: null } })
    touched = r.count
  } else if (action === 'revoke') {
    const r = await prisma.user.updateMany({ where: { id: { in: targets } }, data: { tokenVersion: { increment: 1 } } })
    touched = r.count
  } else if (action === 'hold') {
    const r = await prisma.user.updateMany({ where: { id: { in: targets } }, data: { holdActive: true, holdType: holdType ?? 'all', holdReason: reason ?? 'compliance_review', holdAt: new Date() } })
    touched = r.count
    if (notify) await prisma.notification.createMany({ data: targets.map((userId) => ({ userId, kind: 'system', title: 'Account hold placed', body: `Reason: ${reason ?? 'compliance_review'}` })) }).catch(() => {})
  } else if (action === 'release') {
    const r = await prisma.user.updateMany({ where: { id: { in: targets } }, data: { holdActive: false, holdType: null, holdReason: null, holdNote: null, holdAt: null } })
    touched = r.count
  }
  await audit(req.userId!, `users.bulk.${action}`, null, { ids: targets, count: touched, reason, holdType })
  res.json({ ok: true, count: touched })
})

// --- impersonate user ----------------------------------------------------
// Issues a short-lived (15 min) token for the target user with an `imp` claim
// pointing back to the admin. The client banner shows "viewing as <email>".

router.post('/users/:id/impersonate', async (req: AuthedRequest, res) => {
  const id = req.params.id
  if (id === req.userId) { res.status(400).json({ error: 'Cannot impersonate yourself' }); return }
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true, suspended: true, tokenVersion: true } })
  if (!target) { res.status(404).json({ error: 'User not found' }); return }
  if (target.suspended) { res.status(400).json({ error: 'Target is suspended' }); return }
  // Minted directly so we can attach a custom `imp` claim and a 15-minute TTL.
  const token = jwt.sign(
    { sub: target.id, email: target.email, v: target.tokenVersion, imp: req.userId },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  )
  await audit(req.userId!, 'user.impersonate', id, { ttl: '15m' })
  res.json({ token, user: { id: target.id, email: target.email, name: target.name, role: target.role }, expiresInSec: 15 * 60 })
})

// --- adjust holdings (buy / sell on user's behalf) -----------------------

const HOLDING_REASONS = ['admin_correction', 'manual_purchase', 'manual_sale', 'gift', 'airdrop', 'compensation', 'court_order', 'other'] as const
const adjustHoldingSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['crypto', 'stock', 'etf']).default('crypto'),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().nonnegative(),
  reason: z.enum(HOLDING_REASONS).default('admin_correction'),
  note: z.string().max(500).optional(),
  notify: z.boolean().default(true),
})

router.post('/users/:id/holdings/adjust', async (req: AuthedRequest, res) => {
  const parsed = adjustHoldingSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  const { symbol, side, amount, price, reason, note } = parsed.data
  const reference = `Position ${side}${note ? ' — ' + note : ''}`
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.holding.findUnique({ where: { userId_symbol: { userId, symbol } } })
    if (side === 'buy') {
      const newAmount = (existing?.amount ?? 0) + amount
      const newAvg = newAmount > 0
        ? (((existing?.amount ?? 0) * (existing?.avgPrice ?? 0)) + (amount * price)) / newAmount
        : price
      const holding = await tx.holding.upsert({
        where: { userId_symbol: { userId, symbol } },
        create: { userId, symbol, name: parsed.data.name ?? symbol, type: parsed.data.type, amount: newAmount, avgPrice: newAvg },
        update: { amount: newAmount, avgPrice: newAvg, name: parsed.data.name ?? existing?.name ?? symbol, type: parsed.data.type },
      })
      const trade = await tx.trade.create({ data: { userId, symbol, side: 'buy', amount, price, total: amount * price } })
      return { holding, trade }
    } else {
      if (!existing || existing.amount < amount) {
        throw Object.assign(new Error(`Insufficient holdings (${existing?.amount ?? 0} ${symbol})`), { status: 400 })
      }
      const newAmount = existing.amount - amount
      const holding = newAmount === 0
        ? await tx.holding.delete({ where: { id: existing.id } }).then(() => null).catch(() => null)
        : await tx.holding.update({ where: { id: existing.id }, data: { amount: newAmount } })
      const trade = await tx.trade.create({ data: { userId, symbol, side: 'sell', amount, price, total: amount * price } })
      return { holding, trade, reference }
    }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))
  if ('error' in result) { res.status(result.status || 500).json({ error: result.error }); return }
  if (parsed.data.notify) {
    await prisma.notification.create({
      data: { userId, kind: 'trade', title: `${side === 'buy' ? 'Bought' : 'Sold'} ${amount} ${symbol} @ ${price}`, body: reference },
    }).catch(() => {})
  }
  await audit(req.userId!, `holding.${side}`, userId, parsed.data)
  res.status(201).json(result)
})

// --- reverse a transaction ----------------------------------------------
// Creates an offsetting transaction and adjusts the wallet balance accordingly.

router.post('/transactions/:tid/reverse', async (req: AuthedRequest, res) => {
  const reasonSchema = z.object({ reason: z.string().max(500).optional(), notify: z.boolean().default(true) })
  const parsed = reasonSchema.safeParse(req.body ?? {})
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const tid = req.params.tid
  const original = await prisma.transaction.findUnique({ where: { id: tid } })
  if (!original) { res.status(404).json({ error: 'Transaction not found' }); return }
  if (original.status === 'reversed') { res.status(400).json({ error: 'Already reversed' }); return }
  // Direction of money in the original
  const credited = original.kind === 'deposit' || original.kind === 'dividend' || original.kind === 'interest'
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: original.userId, currency: original.currency } } })
    const sign = credited ? -1 : 1 // reversal moves opposite direction
    const nextBalance = (existing?.balance ?? 0) + sign * original.amount
    const nextAvailable = (existing?.available ?? 0) + sign * original.amount
    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId: original.userId, currency: original.currency } },
      create: { userId: original.userId, currency: original.currency, symbol: original.currency === 'USD' ? '$' : original.currency, balance: nextBalance, available: nextAvailable },
      update: { balance: nextBalance, available: nextAvailable },
    })
    const reversal = await tx.transaction.create({
      data: {
        userId: original.userId,
        kind: 'reversal',
        currency: original.currency,
        amount: original.amount,
        status: 'completed',
        reference: `Reversal of ${original.id}${parsed.data.reason ? ' — ' + parsed.data.reason : ''}`,
        reversedFromId: original.id,
      },
    })
    await tx.transaction.update({ where: { id: original.id }, data: { status: 'reversed' } })
    return { balance, reversal }
  })
  if (parsed.data.notify) {
    await prisma.notification.create({
      data: { userId: original.userId, kind: 'system', title: `Transaction reversed`, body: `Your ${original.kind} of ${original.amount} ${original.currency} has been reversed.${parsed.data.reason ? ' Reason: ' + parsed.data.reason : ''}` },
    }).catch(() => {})
  }
  await audit(req.userId!, 'transaction.reverse', original.userId, { transactionId: tid, reason: parsed.data.reason })
  res.status(201).json(result)
})

// --- admin transfer between two users -----------------------------------

const transferSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  amount: z.number().positive(),
  reason: z.enum([
    'court_order', 'dispute_resolution', 'fraud_recovery', 'gift', 'family_transfer',
    'compliance_directive', 'merger_consolidation', 'manual_correction', 'other',
  ]).default('manual_correction'),
  note: z.string().max(500).optional(),
  allowNegative: z.boolean().default(false),
  notify: z.boolean().default(true),
})

router.post('/transfer', idempotency(), async (req: AuthedRequest, res) => {
  const parsed = transferSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const { fromUserId, toUserId, currency, amount, reason, note, allowNegative } = parsed.data
  if (fromUserId === toUserId) { res.status(400).json({ error: 'From and To must differ' }); return }
  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, email: true, name: true } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, email: true, name: true } }),
  ])
  if (!from || !to) { res.status(404).json({ error: 'One or both users not found' }); return }
  // User-facing references avoid admin/operator jargon. The full audit trail
  // (actor, reason code, note) is still recorded via `audit(...)` below.
  const fromLabel = to.name?.trim() || to.email
  const toLabel = from.name?.trim() || from.email
  const outRef = note?.trim() ? `Transfer to ${fromLabel} \u2014 ${note.trim()}` : `Transfer to ${fromLabel}`
  const inRef = note?.trim() ? `Transfer from ${toLabel} \u2014 ${note.trim()}` : `Transfer from ${toLabel}`
  const reference = `Internal transfer${note ? ' — ' + note : ''}`
  const symbol = currency === 'USD' ? '$' : currency
  const result = await prisma.$transaction(async (tx) => {
    const fromBal = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: fromUserId, currency } } })
    const toBal = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: toUserId, currency } } })
    const fromAvail = fromBal?.available ?? 0
    if (!allowNegative && fromAvail < amount) {
      throw Object.assign(new Error(`Insufficient available balance on source (${fromAvail} ${currency})`), { status: 400 })
    }
    const fromBalance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId: fromUserId, currency } },
      create: { userId: fromUserId, currency, symbol, balance: -amount, available: -amount },
      update: { balance: (fromBal?.balance ?? 0) - amount, available: fromAvail - amount },
    })
    const toBalance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId: toUserId, currency } },
      create: { userId: toUserId, currency, symbol, balance: amount, available: amount },
      update: { balance: (toBal?.balance ?? 0) + amount, available: (toBal?.available ?? 0) + amount },
    })
    const fromTx = await tx.transaction.create({ data: { userId: fromUserId, kind: 'transfer', currency, amount, status: 'completed', reference: outRef } })
    const toTx = await tx.transaction.create({ data: { userId: toUserId, kind: 'transfer', currency, amount, status: 'completed', reference: inRef } })
    return { fromBalance, toBalance, fromTx, toTx }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))
  if ('error' in result) { res.status(result.status || 500).json({ error: result.error }); return }
  if (parsed.data.notify) {
    await prisma.notification.createMany({
      data: [
        { userId: fromUserId, kind: 'system', title: `Outgoing transfer: ${symbol}${amount} ${currency}`, body: reference },
        { userId: toUserId, kind: 'system', title: `Incoming transfer: ${symbol}${amount} ${currency}`, body: reference },
      ],
    }).catch(() => {})
  }
  await audit(req.userId!, 'wallet.transfer.admin', toUserId, { fromUserId, toUserId, currency, amount, reason })
  res.status(201).json(result)
})

// --- fee charge (specialised deduction) ---------------------------------

const FEE_TYPES = ['wire', 'inactivity', 'custody', 'maintenance', 'late_payment', 'currency_conversion', 'withdrawal', 'admin_fee', 'other'] as const
const feeSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  amount: z.number().positive(),
  feeType: z.enum(FEE_TYPES).default('admin_fee'),
  note: z.string().max(500).optional(),
  allowNegative: z.boolean().default(false),
  notify: z.boolean().default(true),
})

router.post('/users/:id/fee', idempotency(), async (req: AuthedRequest, res) => {
  const parsed = feeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  const { currency, amount, feeType, note, allowNegative } = parsed.data
  const symbol = currency === 'USD' ? '$' : currency
  const reference = `Fee (${feeType})${note ? ': ' + note : ''}`
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletBalance.findUnique({ where: { userId_currency: { userId, currency } } })
    const currentAvail = existing?.available ?? 0
    if (!allowNegative && currentAvail < amount) {
      throw Object.assign(new Error(`Insufficient available balance (${currentAvail} ${currency})`), { status: 400 })
    }
    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, symbol, balance: -amount, available: -amount },
      update: { balance: (existing?.balance ?? 0) - amount, available: currentAvail - amount },
    })
    const transaction = await tx.transaction.create({
      data: { userId, kind: 'fee', currency, amount, status: 'completed', reference, subType: feeType },
    })
    return { balance, transaction }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))
  if ('error' in result) { res.status(result.status || 500).json({ error: result.error }); return }
  if (parsed.data.notify) {
    await prisma.notification.create({
      data: { userId, kind: 'system', title: `${symbol}${amount} ${currency} fee charged`, body: reference },
    }).catch(() => {})
  }
  await audit(req.userId!, 'wallet.fee', userId, parsed.data)
  res.status(201).json(result)
})

// --- KYC review --------------------------------------------------------

const kycSchema = z.object({
  status: z.enum(['none', 'pending', 'approved', 'rejected']),
  notes: z.string().max(2000).optional(),
  notify: z.boolean().default(true),
})

router.post('/users/:id/kyc', async (req: AuthedRequest, res) => {
  const parsed = kycSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: parsed.data.status,
      kycNotes: parsed.data.notes ?? null,
      kycReviewedAt: parsed.data.status === 'none' ? null : new Date(),
      kycReviewedBy: parsed.data.status === 'none' ? null : req.userId!,
    },
  })
  if (parsed.data.notify && parsed.data.status !== 'none') {
    await prisma.notification.create({
      data: { userId, kind: 'system', title: `KYC ${parsed.data.status}`, body: parsed.data.notes ?? `Your KYC review is now ${parsed.data.status}.` },
    }).catch(() => {})
  }
  await audit(req.userId!, 'user.kyc.update', userId, parsed.data)
  res.json({ user: publicUser(u) })
})

// --- limits ------------------------------------------------------------

const limitsSchema = z.object({
  dailyWithdrawLimit: z.number().nonnegative().nullable().optional(),
  monthlyWithdrawLimit: z.number().nonnegative().nullable().optional(),
  dailyTransferLimit: z.number().nonnegative().nullable().optional(),
  monthlyTransferLimit: z.number().nonnegative().nullable().optional(),
})

router.patch('/users/:id/limits', async (req: AuthedRequest, res) => {
  const parsed = limitsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const u = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data })
  await audit(req.userId!, 'user.limits.update', req.params.id, parsed.data)
  res.json({ user: publicUser(u) })
})

// --- IP allowlist ------------------------------------------------------

const ipSchema = z.object({ ipAllowlist: z.string().max(2000).nullable() })

router.patch('/users/:id/ip-allowlist', async (req: AuthedRequest, res) => {
  const parsed = ipSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { ipAllowlist: parsed.data.ipAllowlist || null } })
  await audit(req.userId!, 'user.ipAllowlist.update', req.params.id, parsed.data)
  res.json({ user: publicUser(u) })
})

// --- email user (delivered as a system notification with kind='email') --

const emailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  template: z.enum(['none', 'welcome', 'verification_required', 'kyc_request', 'password_reset_offer', 'security_alert', 'custom']).default('none'),
})

router.post('/users/:id/email', async (req: AuthedRequest, res) => {
  const parsed = emailSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const userId = req.params.id
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!exists) { res.status(404).json({ error: 'User not found' }); return }
  // We don't have an SMTP backend wired in here — record as a system
  // notification (kind='email') so the user sees it in-app and the admin
  // gets an audit trail. Hooking up real email is a 5-line swap later.
  const n = await prisma.notification.create({
    data: { userId, kind: 'email', title: parsed.data.subject, body: parsed.data.body },
  })
  await audit(req.userId!, 'user.email', userId, { subject: parsed.data.subject, template: parsed.data.template, length: parsed.data.body.length })
  res.status(201).json({ notification: n, deliveredVia: 'in_app' })
})

// --- on-chain pending deposits -------------------------------------------
// Admins triage deposits that users initiated from their linked self-custody
// wallet. The frontend submitted the tx hash on send; admin verifies the tx
// on a block explorer (link returned in payload), then `approve` credits the
// user's WalletBalance + creates a Transaction, or `reject` marks it dead.

const ETHERSCAN_BY_CHAIN: Record<string, string> = {
  '0x1': 'https://etherscan.io/tx/',
  '0x5': 'https://goerli.etherscan.io/tx/',
  '0xaa36a7': 'https://sepolia.etherscan.io/tx/',
  '0x89': 'https://polygonscan.com/tx/',
  '0xa4b1': 'https://arbiscan.io/tx/',
  '0xa': 'https://optimistic.etherscan.io/tx/',
  '0x2105': 'https://basescan.org/tx/',
  '0x38': 'https://bscscan.com/tx/',
  '0xa86a': 'https://snowtrace.io/tx/',
}

router.get('/pending-deposits', async (req, res) => {
  const status = String(req.query.status ?? 'pending')
  const rows = await prisma.pendingDeposit.findMany({
    where: status === 'all' ? {} : { status },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true, investmentId: true } } },
  })
  const decorated = rows.map((r) => ({
    ...r,
    explorerUrl: (ETHERSCAN_BY_CHAIN[r.chainId.toLowerCase()] ?? '') + r.txHash,
  }))
  res.json({ pendingDeposits: decorated })
})

const approvePendingSchema = z.object({
  // Currency to credit on the Verdexis side. Defaults to the asset symbol
  // the user submitted (e.g. ETH credits the ETH balance), but admin can
  // override (e.g. credit USD if pricing was agreed off-chain).
  currency: z.string().min(1).max(10).optional(),
  // Override the credited amount. Defaults to the on-chain amount the user
  // claimed. Useful when the asset price moved or the user sent a different
  // amount than expected.
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
})

router.post('/pending-deposits/:id/approve', async (req: AuthedRequest, res) => {
  const parsed = approvePendingSchema.safeParse(req.body ?? {})
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }

  const pending = await prisma.pendingDeposit.findUnique({ where: { id: req.params.id } })
  if (!pending) { res.status(404).json({ error: 'Pending deposit not found' }); return }
  if (pending.status === 'credited') { res.status(409).json({ error: 'Already credited' }); return }
  if (pending.status === 'rejected') { res.status(409).json({ error: 'Already rejected' }); return }

  const currency = (parsed.data.currency ?? pending.asset).toUpperCase()
  const amount = parsed.data.amount ?? pending.amount
  const symbol = currency === 'USD' ? '$' : currency

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: pending.userId, currency } } })
    const nextBalance = (existing?.balance ?? 0) + amount
    const nextAvailable = (existing?.available ?? 0) + amount
    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId: pending.userId, currency } },
      create: { userId: pending.userId, currency, symbol, balance: nextBalance, available: nextAvailable },
      update: { balance: nextBalance, available: nextAvailable, symbol },
    })
    const transaction = await tx.transaction.create({
      data: {
        userId: pending.userId,
        kind: 'deposit',
        currency,
        amount,
        status: 'completed',
        reference: `On-chain deposit ${pending.txHash.slice(0, 12)}… from ${pending.fromAddress.slice(0, 8)}…${parsed.data.note ? ' — ' + parsed.data.note : ''}`,
      },
    })
    const updated = await tx.pendingDeposit.update({
      where: { id: pending.id },
      data: { status: 'credited', creditedTxId: transaction.id, note: parsed.data.note ?? null },
    })
    return { balance, transaction, pending: updated }
  })

  await prisma.notification.create({
    data: {
      userId: pending.userId,
      kind: 'deposit',
      title: `Deposit credited: ${amount} ${currency}`,
      body: `Your on-chain deposit (${pending.txHash.slice(0, 14)}…) has been verified and credited.`,
    },
  }).catch(() => {})

  await audit(req.userId!, 'pendingDeposit.approve', pending.userId, {
    pendingDepositId: pending.id, txHash: pending.txHash, currency, amount,
  })
  res.json(result)
})

const rejectPendingSchema = z.object({ note: z.string().max(500).optional() })

router.post('/pending-deposits/:id/reject', async (req: AuthedRequest, res) => {
  const parsed = rejectPendingSchema.safeParse(req.body ?? {})
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const pending = await prisma.pendingDeposit.findUnique({ where: { id: req.params.id } })
  if (!pending) { res.status(404).json({ error: 'Not found' }); return }
  if (pending.status === 'credited') { res.status(409).json({ error: 'Already credited' }); return }
  const updated = await prisma.pendingDeposit.update({
    where: { id: pending.id },
    data: { status: 'rejected', note: parsed.data.note ?? null },
  })
  await prisma.notification.create({
    data: {
      userId: pending.userId,
      kind: 'deposit',
      title: 'Deposit rejected',
      body: parsed.data.note ?? `On-chain deposit ${pending.txHash.slice(0, 14)}… could not be verified and was not credited.`,
    },
  }).catch(() => {})
  await audit(req.userId!, 'pendingDeposit.reject', pending.userId, { pendingDepositId: pending.id, txHash: pending.txHash, note: parsed.data.note })
  res.json({ pendingDeposit: updated })
})

// --- audit log -----------------------------------------------------------

router.get('/audit-old', async (_req, res) => {
  res.status(404).json({ error: 'use /audit' })
})

export default router
