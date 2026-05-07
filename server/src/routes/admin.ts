import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

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
  tokenVersion: number; createdAt: Date; updatedAt: Date;
}) {
  let prefs: Record<string, unknown> = {}
  try { if (u.prefs) prefs = JSON.parse(u.prefs) } catch { prefs = {} }
  return {
    id: u.id, email: u.email, name: u.name, avatar: u.avatar,
    twoFactor: u.twoFactor, role: u.role, suspended: u.suspended,
    suspendedReason: u.suspendedReason, tokenVersion: u.tokenVersion,
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
  const [users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { suspended: true } }),
    prisma.holding.count(),
    prisma.trade.count(),
    prisma.priceAlert.count({ where: { active: true } }),
    prisma.transaction.count({ where: { kind: 'deposit', createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
  ])
  const recentSignups = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }, take: 8,
    select: { id: true, email: true, name: true, createdAt: true, role: true, suspended: true },
  })
  const recentTx = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' }, take: 10,
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.json({ stats: { users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h }, recentSignups, recentTx })
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
        twoFactor: true, createdAt: true, updatedAt: true,
        _count: { select: { holdings: true, trades: true, transactions: true, alerts: true } },
      },
    }),
  ])
  res.json({ users, total, page, limit })
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
})

router.patch('/users/:id', async (req: AuthedRequest, res) => {
  const id = req.params.id
  const parsed = patchUserSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
  const data: Record<string, unknown> = { ...parsed.data }
  if ('prefs' in data) data.prefs = JSON.stringify(data.prefs ?? {})
  // Don't let admin demote themselves to last-admin and lock everyone out.
  if (parsed.data.role === 'user' && id === req.userId!) {
    const otherAdmins = await prisma.user.count({ where: { role: 'admin', NOT: { id } } })
    if (otherAdmins === 0) { res.status(400).json({ error: 'Cannot demote the last admin' }); return }
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

// --- transactions --------------------------------------------------------

const txSchema = z.object({
  kind: z.enum(['deposit', 'withdraw', 'transfer', 'dividend', 'interest']),
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  amount: z.number(),
  status: z.enum(['pending', 'completed', 'failed', 'reversed']).default('completed'),
  reference: z.string().max(200).optional(),
})

router.post('/users/:id/transactions', async (req: AuthedRequest, res) => {
  const parsed = txSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const t = await prisma.transaction.create({ data: { userId: req.params.id, ...parsed.data } })
  await audit(req.userId!, 'transaction.create', req.params.id, parsed.data)
  res.json({ transaction: t })
})

router.patch('/transactions/:tid', async (req: AuthedRequest, res) => {
  const partial = txSchema.partial().safeParse(req.body)
  if (!partial.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const t = await prisma.transaction.update({ where: { id: req.params.tid }, data: partial.data })
  await audit(req.userId!, 'transaction.update', t.userId, partial.data)
  res.json({ transaction: t })
})

router.delete('/transactions/:tid', async (req: AuthedRequest, res) => {
  const t = await prisma.transaction.delete({ where: { id: req.params.tid } })
  await audit(req.userId!, 'transaction.delete', t.userId, { id: t.id })
  res.json({ ok: true })
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

router.get('/audit', async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500)
  const logs = await prisma.adminAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: { select: { id: true, email: true, name: true } },
      target: { select: { id: true, email: true, name: true } },
    },
  })
  res.json({ audit: logs })
})

export default router
