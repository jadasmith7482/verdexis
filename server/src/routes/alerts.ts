import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router: Router = Router()

const alertSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  direction: z.enum(['above', 'below']),
  target: z.number().positive(),
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const alerts = await prisma.priceAlert.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ alerts })
})

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parse = alertSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() }); return }
  const alert = await prisma.priceAlert.create({
    data: { ...parse.data, userId: req.userId! },
  })
  res.json({ alert })
})

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const a = await prisma.priceAlert.findUnique({ where: { id: req.params.id } })
    if (!a || a.userId !== req.userId) { res.status(404).json({ error: 'Not found' }); return }
    await prisma.priceAlert.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

// Client-side check-in: client sends current symbol prices, server triggers any matching alerts
// and creates a Notification + flips alert state.
const checkSchema = z.object({
  prices: z.array(z.object({ symbol: z.string(), price: z.number() })),
})

router.post('/check', requireAuth, async (req: AuthedRequest, res) => {
  const parse = checkSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const userId = req.userId!
  const active = await prisma.priceAlert.findMany({ where: { userId, active: true, triggered: false } })
  const triggered: typeof active = []
  for (const alert of active) {
    const tick = parse.data.prices.find((p) => p.symbol.toUpperCase() === alert.symbol.toUpperCase())
    if (!tick) continue
    const hit = alert.direction === 'above' ? tick.price >= alert.target : tick.price <= alert.target
    if (hit) {
      // Atomically flip the alert AND create the notification so we never
      // end up with a "triggered" alert that the user was never notified
      // about (or vice-versa) when one of the two writes fails.
      try {
        await prisma.$transaction([
          prisma.priceAlert.update({
            where: { id: alert.id },
            data: { triggered: true, triggeredAt: new Date(), active: false },
          }),
          prisma.notification.create({
            data: {
              userId,
              kind: 'alert',
              title: `${alert.name} ${alert.direction} $${alert.target}`,
              body: `Current price: $${tick.price.toFixed(2)}`,
            },
          }),
        ])
        triggered.push(alert)
      } catch (e) {
        console.warn('[alerts] failed to trigger', alert.id, (e as Error).message)
      }
    }
  }
  res.json({ triggered: triggered.length })
})

export default router
