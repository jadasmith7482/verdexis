import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { brokerEnabled, submitPaperOrder } from '../broker.js'

const router = Router()

const tradeSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(120).optional(),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().positive(),
  type: z.enum(['crypto', 'stock', 'etf']).default('crypto'),
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const trades = await prisma.trade.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ trades })
})

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = tradeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  let { symbol, name, side, amount, price, type } = parsed.data

  // Optional: forward to Alpaca paper. If it fills, use the actual fill
  // price/qty so the local books match the broker. Failures fall through
  // silently to the existing local-only path.
  let brokerOrderId: string | null = null
  if (brokerEnabled()) {
    const fill = await submitPaperOrder({ symbol, side, qty: amount, type })
    if (fill) {
      brokerOrderId = fill.id
      if (fill.filledQty > 0) amount = fill.filledQty
      if (fill.filledPrice && fill.filledPrice > 0) price = fill.filledPrice
    }
  }
  const total = amount * price

  const result = await prisma.$transaction(async (tx) => {
    // 1. Adjust USD balance
    const usd = await tx.walletBalance.findUnique({
      where: { userId_currency: { userId: req.userId!, currency: 'USD' } },
    })
    const currentUsd = usd?.available ?? 0
    if (side === 'buy' && currentUsd < total) {
      throw Object.assign(new Error('Insufficient USD'), { status: 400 })
    }
    const nextUsd = side === 'buy' ? currentUsd - total : currentUsd + total
    await tx.walletBalance.upsert({
      where: { userId_currency: { userId: req.userId!, currency: 'USD' } },
      create: {
        userId: req.userId!,
        currency: 'USD',
        symbol: '$',
        balance: nextUsd,
        available: nextUsd,
      },
      update: { balance: nextUsd, available: nextUsd },
    })

    // 2. Adjust holding
    const existing = await tx.holding.findUnique({
      where: { userId_symbol: { userId: req.userId!, symbol } },
    })
    const currentAmt = existing?.amount ?? 0
    if (side === 'sell' && currentAmt < amount) {
      throw Object.assign(new Error(`Insufficient ${symbol}`), { status: 400 })
    }
    const nextAmt = side === 'buy' ? currentAmt + amount : currentAmt - amount
    // Weighted-average cost basis on buys; preserve avg on sells.
    const nextAvg = side === 'buy' && nextAmt > 0
      ? ((existing?.avgPrice ?? price) * currentAmt + price * amount) / nextAmt
      : existing?.avgPrice ?? price

    if (nextAmt > 0) {
      await tx.holding.upsert({
        where: { userId_symbol: { userId: req.userId!, symbol } },
        create: {
          userId: req.userId!,
          symbol,
          name: name || symbol,
          amount: nextAmt,
          avgPrice: nextAvg,
          type,
        },
        update: { amount: nextAmt, avgPrice: nextAvg, name: name || existing?.name || symbol },
      })
    } else if (existing) {
      await tx.holding.delete({ where: { id: existing.id } })
    }

    const trade = await tx.trade.create({
      data: { userId: req.userId!, symbol, side, amount, price, total },
    })
    return { trade }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  res.status(201).json({ ...result, broker: brokerOrderId ? { id: brokerOrderId, venue: 'alpaca-paper' } : null })
})

export default router
