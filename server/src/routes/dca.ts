import { Router } from 'express'

const router = Router()

// Minimal stub router for DCA endpoints. Implement business logic as needed.
router.get('/', (_req, res) => {
  res.json({ ok: true, message: 'DCA routes placeholder' })
})

export default router
