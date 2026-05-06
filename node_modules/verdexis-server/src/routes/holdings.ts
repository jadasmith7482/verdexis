import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

const upsertSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  amount: z.number().nonnegative(),
  avgPrice: z.number().nonnegative(),
  type: z.enum(['crypto', 'stock', 'etf']),
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const holdings = await prisma.holding.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: 'desc' },
  })
  res.json({ holdings })
})

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { symbol, name, amount, avgPrice, type } = parsed.data
  const holding = await prisma.holding.upsert({
    where: { userId_symbol: { userId: req.userId!, symbol } },
    create: { userId: req.userId!, symbol, name, amount, avgPrice, type },
    update: { name, amount, avgPrice, type },
  })
  res.json({ holding })
})

router.delete('/:symbol', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.holding.deleteMany({ where: { userId: req.userId!, symbol: req.params.symbol } })
  res.json({ ok: true })
})

export default router
