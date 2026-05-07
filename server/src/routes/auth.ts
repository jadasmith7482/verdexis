import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'

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
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(200),
})

const forgotSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
})

const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200),
})

function publicUser(u: { id: string; email: string; name: string; avatar: string | null; prefs: string | null; twoFactor: boolean; role?: string; suspended?: boolean }) {
  let prefs: Record<string, unknown> = {}
  try {
    if (u.prefs) prefs = JSON.parse(u.prefs)
  } catch {
    prefs = {}
  }
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    twoFactor: u.twoFactor,
    role: (u.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
    suspended: !!u.suspended,
    prefs,
  }
}

async function autoPromoteIfAdminEmail(userId: string, email: string, currentRole: string): Promise<string> {
  if (currentRole === 'admin') return 'admin'
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) return currentRole
  await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
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
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      // First user signed up with an admin-listed email starts as admin.
      role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user',
      // Seed a USD wallet so the user can deposit immediately.
      walletBalances: {
        create: [{ currency: 'USD', symbol: '$', balance: 0, available: 0 }],
      },
    },
  })
  const token = signToken({ sub: user.id, email: user.email, v: user.tokenVersion })
  res.status(201).json({ token, user: publicUser(user) })
})

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
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
  const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
  const token = signToken({ sub: user.id, email: user.email, v: user.tokenVersion })
  res.json({ token, user: publicUser({ ...user, role }) })
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
  res.json({ user: publicUser(user) })
})

router.post('/logout', (_req, res) => {
  // Token storage is client-side (Bearer); just clear the legacy cookie if
  // any client still has it lying around.
  res.clearCookie('verdexis_token')
  res.json({ ok: true })
})

export default router
