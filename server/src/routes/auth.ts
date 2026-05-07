import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { generateInvestmentId } from '../investmentId.js'

const router = Router()

const ADMIN_EMAILS = env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).trim(),
})

const loginSchema = z.object({
  // Accepts either an email or a username (3+ chars).
  identifier: z.string().min(3).max(200).trim().toLowerCase().optional(),
  email: z.string().min(3).max(200).trim().toLowerCase().optional(),
  password: z.string().min(1).max(200),
}).refine((d) => !!(d.identifier || d.email), { message: 'identifier or email required' })

const forgotSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
})

const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200),
})

function publicUser(u: { id: string; email: string; username?: string | null; name: string; avatar: string | null; prefs: string | null; twoFactor: boolean; role?: string; suspended?: boolean; investmentId?: string | null }) {
  let prefs: Record<string, unknown> = {}
  try {
    if (u.prefs) prefs = JSON.parse(u.prefs)
  } catch {
    prefs = {}
  }
  return {
    id: u.id,
    email: u.email,
    username: u.username ?? null,
    name: u.name,
    avatar: u.avatar,
    twoFactor: u.twoFactor,
    role: (u.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
    suspended: !!u.suspended,
    investmentId: u.investmentId ?? null,
    prefs,
  }
}

// Admins are seeded with a treasury balance they can disburse to users via
// the Admin → Transfer flow. Currently 1 trillion USD.
const ADMIN_TREASURY_USD = 1_000_000_000_000

async function ensureAdminTreasury(userId: string): Promise<void> {
  const existing = await prisma.walletBalance.findFirst({ where: { userId, currency: 'USD' } })
  if (!existing) {
    await prisma.walletBalance.create({
      data: { userId, currency: 'USD', symbol: '$', balance: ADMIN_TREASURY_USD, available: ADMIN_TREASURY_USD },
    })
    return
  }
  if (existing.balance >= ADMIN_TREASURY_USD) return
  await prisma.walletBalance.update({
    where: { id: existing.id },
    data: { balance: ADMIN_TREASURY_USD, available: ADMIN_TREASURY_USD },
  })
}

export async function autoPromoteIfAdminEmail(userId: string, email: string, currentRole: string): Promise<string> {
  if (currentRole === 'admin') {
    await ensureAdminTreasury(userId)
    return 'admin'
  }
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) return currentRole
  await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
  await ensureAdminTreasury(userId)
  return 'admin'
}

router.post('/signup', authLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const { email, password, name } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const investmentId = await generateInvestmentId()
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      investmentId,
      // First user signed up with an admin-listed email starts as admin.
      role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user',
      // Seed a USD wallet so the user can deposit immediately.
      walletBalances: {
        create: [{ currency: 'USD', symbol: '$', balance: 0, available: 0 }],
      },
    },
  })
  if (user.role === 'admin') await ensureAdminTreasury(user.id)
  const token = signToken({ sub: user.id, email: user.email, v: user.tokenVersion })
  res.status(201).json({ token, user: publicUser(user) })
})

router.post('/login', authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' })
      return
    }
    const { password } = parsed.data
    const id = (parsed.data.identifier || parsed.data.email || '').trim().toLowerCase()
    // If it parses as an email, look up by email; otherwise treat as username.
    const isEmail = /.+@.+\..+/.test(id)
    const user = isEmail
      ? await prisma.user.findUnique({ where: { email: id } })
      : await prisma.user.findUnique({ where: { username: id } })
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    if (user.suspended) {
      res.status(403).json({ error: 'Account suspended' })
      return
    }
    let role = user.role
    try {
      role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
    } catch (promoteErr) {
      // Don't block login if promotion fails (e.g. treasury seed write race);
      // log it so we can see it in Render logs.
      console.error('[verdexis-api] autoPromote failed for', user.email, promoteErr)
    }
    const token = signToken({ sub: user.id, email: user.email, v: user.tokenVersion })
    res.json({ token, user: publicUser({ ...user, role }) })
  } catch (err) {
    console.error('[verdexis-api] /login crashed:', err)
    res.status(500).json({
      error: 'Login failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

router.post('/forgot', authLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { email } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  // Always return ok to avoid user enumeration.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    })
    const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/reset?token=${rawToken}`
    // Real email integration would go here. For dev: log it.
    console.log(`[verdexis] password reset for ${email}: ${resetUrl}`)
  }
  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })
})

router.post('/reset', authLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } })
  if (!record || record.used || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invalid or expired token' })
    return
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } }),
  ])
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  // Re-check admin promotion on every /me — covers the case where ADMIN_EMAILS
  // was set after the user already signed up/logged in (so role would otherwise
  // be stuck at 'user' until next login).
  const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
  res.json({ user: publicUser({ ...user, role }) })
})

// One-time bootstrap: promote any user matching ADMIN_EMAILS to admin and
// seed their treasury. Safe to run repeatedly. Called from server boot.
export async function promoteAllAdminEmails(): Promise<void> {
  if (!ADMIN_EMAILS.length) return
  for (const email of ADMIN_EMAILS) {
    try {
      const u = await prisma.user.findUnique({ where: { email } })
      if (!u) continue
      await autoPromoteIfAdminEmail(u.id, u.email, u.role)
      // eslint-disable-next-line no-console
      console.log(`[verdexis-api] ensured admin role for ${email}`)
    } catch (e) {
      console.error(`[verdexis-api] failed to promote ${email}:`, (e as Error).message)
    }
  }
}

router.post('/logout', (_req, res) => {
  // Token storage is client-side (Bearer); just clear the legacy cookie if
  // any client still has it lying around.
  res.clearCookie('verdexis_token')
  res.json({ ok: true })
})

// Authenticated password change (requires current password).
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
})
router.post('/change-password', requireAuth, authLimiter, async (req: AuthedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) { res.status(404).json({ error: 'Not found' }); return }
  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!ok) { res.status(401).json({ error: 'Current password is incorrect' }); return }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  // Bump tokenVersion so all other sessions are invalidated.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  })
  // Issue a fresh token for the current session so the user stays signed in here.
  const token = signToken({ sub: updated.id, email: updated.email, v: updated.tokenVersion })
  res.json({ ok: true, token })
})

// Sign out of every other device by bumping tokenVersion.
router.post('/logout-all', requireAuth, async (req: AuthedRequest, res) => {
  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: { tokenVersion: { increment: 1 } },
  })
  const token = signToken({ sub: updated.id, email: updated.email, v: updated.tokenVersion })
  res.json({ ok: true, token })
})

// Full data export for the authenticated user (GDPR-style).
router.get('/export', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.userId!
  const [user, holdings, walletBalances, transactions, trades, watchlist, alerts, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.holding.findMany({ where: { userId: id } }),
    prisma.walletBalance.findMany({ where: { userId: id } }),
    prisma.transaction.findMany({ where: { userId: id } }),
    prisma.trade.findMany({ where: { userId: id } }),
    prisma.watchlist.findMany({ where: { userId: id } }),
    prisma.priceAlert.findMany({ where: { userId: id } }),
    prisma.notification.findMany({ where: { userId: id } }),
  ])
  if (!user) { res.status(404).json({ error: 'Not found' }); return }
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="verdexis-export-${id}.json"`)
  res.json({
    exportedAt: new Date().toISOString(),
    user: publicUser(user),
    holdings, walletBalances, transactions, trades, watchlist, alerts, notifications,
  })
})

export default router
