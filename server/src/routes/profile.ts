import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).toLowerCase().nullable().optional(),
  avatar: z.string().nullable().optional(), // data URL or null to remove
  prefs: z.record(z.unknown()).optional(),
  twoFactor: z.boolean().optional(),
})

router.patch('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const data: {
    name?: string
    username?: string | null
    avatar?: string | null
    prefs?: string
    twoFactor?: boolean
  } = {}

  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.username !== undefined) {
    if (parsed.data.username) {
      const taken = await prisma.user.findFirst({ where: { username: parsed.data.username, NOT: { id: req.userId! } } })
      if (taken) { res.status(409).json({ error: 'That username is already taken' }); return }
    }
    data.username = parsed.data.username
  }
  if (parsed.data.avatar !== undefined) {
    if (parsed.data.avatar && parsed.data.avatar.length > 1_000_000) {
      res.status(413).json({ error: 'Avatar too large (>1 MB encoded)' })
      return
    }
    data.avatar = parsed.data.avatar
  }
  if (parsed.data.prefs !== undefined) data.prefs = JSON.stringify(parsed.data.prefs)
  if (parsed.data.twoFactor !== undefined) data.twoFactor = parsed.data.twoFactor

  const user = await prisma.user.update({ where: { id: req.userId! }, data })
  let prefs: unknown = {}
  try {
    prefs = user.prefs ? JSON.parse(user.prefs) : {}
  } catch {
    prefs = {}
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      twoFactor: user.twoFactor,
      prefs,
    },
  })
})

router.delete('/', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.delete({ where: { id: req.userId! } })
  res.json({ ok: true })
})

export default router
