import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router: Router = Router()

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const unread = notifications.filter((n) => !n.read).length
  res.json({ notifications, unread })
})

router.post('/read', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, read: false },
    data: { read: true },
  })
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!n || n.userId !== req.userId) { res.status(404).json({ error: 'Not found' }); return }
    await prisma.notification.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

export default router
