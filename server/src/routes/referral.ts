import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import {
  getReferralSummary,
  getUserReferrals,
  creditReferralBonus,
  activateReferralOnDeposit,
} from '../referrals.js'

const router = Router()

/**
 * GET /api/referrals/me
 * Get current user's referral summary (code, earnings, counts)
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const summary = await getReferralSummary(req.userId!)
    res.json(summary)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch referral summary' })
  }
})

/**
 * GET /api/referrals/list
 * Get all referrals for the current user with details
 */
router.get('/list', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const referrals = await getUserReferrals(req.userId!)
    res.json({
      referrals,
      count: referrals.length,
    })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch referrals' })
  }
})

/**
 * POST /api/referrals/confirm-deposit
 * Called when a referee makes their first deposit.
 * Activates the referral and creates bonus records.
 * NOTE: In production, this would be called by the backend when processing
 * a deposit transaction, not exposed to the client directly.
 */
router.post('/confirm-deposit', requireAuth, async (req: AuthedRequest, res) => {
  const { amount } = req.body as { amount?: number }

  if (!amount || amount < 50) {
    res.status(400).json({ error: 'Deposit amount must be at least $50' })
    return
  }

  try {
    await activateReferralOnDeposit(req.userId!, amount)
    res.json({ success: true, message: 'Referral activated and bonuses created' })
  } catch (e) {
    res.status(500).json({ error: 'Failed to activate referral' })
  }
})

/**
 * GET /api/referrals/bonuses
 * Get all pending and credited bonuses for the current user
 */
router.get('/bonuses', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const bonuses = await prisma.referralBonus.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    })

    const stats = {
      pending: bonuses
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + b.amount, 0),
      credited: bonuses
        .filter((b) => b.status === 'credited')
        .reduce((sum, b) => sum + b.amount, 0),
    }

    res.json({ bonuses, stats })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bonuses' })
  }
})

/**
 * POST /api/referrals/claim-bonus
 * Claims a pending bonus and credits it to the user's account.
 * In production, admins would call this, or it would be done automatically.
 */
router.post('/claim-bonus', requireAuth, async (req: AuthedRequest, res) => {
  const { bonusId, paymentMethod } = req.body as {
    bonusId?: string
    paymentMethod?: 'trading_credit' | 'cash_deposit'
  }

  if (!bonusId) {
    res.status(400).json({ error: 'bonusId required' })
    return
  }

  // Verify the bonus belongs to this user
  const bonus = await prisma.referralBonus.findUnique({ where: { id: bonusId } })
  if (!bonus || bonus.userId !== req.userId!) {
    res.status(403).json({ error: 'Bonus not found or access denied' })
    return
  }

  if (bonus.status !== 'pending') {
    res.status(400).json({ error: 'Bonus already claimed or cancelled' })
    return
  }

  try {
    const result = await creditReferralBonus(bonusId, paymentMethod || 'trading_credit')
    res.json({ success: true, result })
  } catch (e) {
    res.status(500).json({ error: 'Failed to claim bonus' })
  }
})

export default router
