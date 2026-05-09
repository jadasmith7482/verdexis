import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router: Router = Router()

// Reviews are user-generated content shown publicly on the homepage. Throttle
// writes hard so a compromised account can't spam the marketing page.
const reviewWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const upsertSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(400),
})

// GET /api/reviews — public. Returns the most recent approved reviews so the
// homepage can render real social proof. We cap at 50 so the marketing page
// stays light and the carousel fits in memory.
router.get('/', async (_req, res) => {
  const reviews = await prisma.review.findMany({
    where: { approved: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      rating: true,
      text: true,
      authorName: true,
      authorAvatar: true,
      createdAt: true,
    },
  })
  res.json({ reviews })
})

// GET /api/reviews/me — what the signed-in user has on file (so the form can
// prefill the existing rating + text instead of pretending it's a fresh post).
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const review = await prisma.review.findUnique({
    where: { userId: req.userId! },
    select: { id: true, rating: true, text: true, authorName: true, authorAvatar: true, approved: true, createdAt: true, updatedAt: true },
  })
  res.json({ review })
})

// POST /api/reviews — upsert. Pins the user's current name+avatar so renaming
// later doesn't silently rewrite the homepage testimonial.
router.post('/', requireAuth, reviewWriteLimiter, async (req: AuthedRequest, res) => {
  const parse = upsertSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { name: true, avatar: true, suspended: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  if (user.suspended) { res.status(403).json({ error: 'Account suspended' }); return }

  const review = await prisma.review.upsert({
    where: { userId: req.userId! },
    create: {
      userId: req.userId!,
      rating: parse.data.rating,
      text: parse.data.text,
      authorName: user.name,
      authorAvatar: user.avatar,
    },
    update: {
      rating: parse.data.rating,
      text: parse.data.text,
      authorName: user.name,
      authorAvatar: user.avatar,
    },
    select: { id: true, rating: true, text: true, authorName: true, authorAvatar: true, approved: true, createdAt: true, updatedAt: true },
  })
  res.status(201).json({ review })
})

// DELETE /api/reviews/me — let the user retract their own review.
router.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.review.deleteMany({ where: { userId: req.userId! } })
  res.json({ ok: true })
})

export default router
