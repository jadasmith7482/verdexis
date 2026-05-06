import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router: Router = Router()

const watchSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.enum(['crypto', 'stock', 'etf']).default('crypto'),
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const items = await prisma.watchlist.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ watchlist: items })
})

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parse = watchSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() }); return }
  try {
    const item = await prisma.watchlist.upsert({
      where: { userId_symbol: { userId: req.userId!, symbol: parse.data.symbol } },
      create: { ...parse.data, userId: req.userId! },
      update: { name: parse.data.name, type: parse.data.type },
    })
    res.json({ item })
  } catch (e) {
    res.status(500).json({ error: 'Could not save watchlist item' })
  }
})

router.delete('/:symbol', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await prisma.watchlist.delete({
      where: { userId_symbol: { userId: req.userId!, symbol: req.params.symbol } },
    })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

export default router
