import crypto from 'node:crypto'
import { prisma } from './db.js'

const REFERRAL_BONUS_REFERRER_USD = 250  // $250 to referrer
const REFERRAL_BONUS_REFEREE_USD = 10   // $10 to referee
const MIN_DEPOSIT_FOR_BONUS_USD = 50    // Minimum deposit to trigger bonus

/**
 * Generates a unique referral code for a user. Format: VERDX-XXXXXX
 * where XXXXXX is 6 random hex characters.
 */
export async function generateReferralCode(): Promise<string> {
  let code = ''
  let existing: any = { referralCode: 'taken' }
  
  // Keep trying until we generate a unique code
  while (existing) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
    code = `VERDX-${randomHex}`
    existing = await prisma.user.findUnique({ where: { referralCode: code } })
  }
  
  return code
}

/**
 * Links a new user to their referrer based on a referral code.
 * Called during signup if a ref= query parameter was provided.
 */
export async function linkReferrer(newUserId: string, newUserEmail: string, referralCode?: string): Promise<void> {
  if (!referralCode) return

  // Find the referrer by code
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true },
  })

  if (!referrer) return // Invalid code, ignore

  // Create a Referral record
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId: newUserId,
      refereeEmail: newUserEmail,
      status: 'pending',
    },
  })
}

/**
 * Activates a referral when the referee makes their first deposit.
 * Awards bonuses to both referrer and referee.
 */
export async function activateReferralOnDeposit(
  refereeUserId: string,
  depositAmountUsd: number
): Promise<void> {
  if (depositAmountUsd < MIN_DEPOSIT_FOR_BONUS_USD) return

  // Find the pending referral
  const referral = await prisma.referral.findFirst({
    where: {
      refereeId: refereeUserId,
      status: 'pending',
    },
  })

  if (!referral) return // No pending referral

  // Update referral status to 'active'
  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: 'active',
      firstDepositAt: new Date(),
      firstDepositAmount: depositAmountUsd,
      referrerBonusUsd: REFERRAL_BONUS_REFERRER_USD,
      refereeBonusUsd: REFERRAL_BONUS_REFEREE_USD,
    },
  })

  // Create bonus records (will be credited asynchronously or on-demand)
  await prisma.referralBonus.createMany({
    data: [
      {
        userId: referral.referrerId,
        amount: REFERRAL_BONUS_REFERRER_USD,
        bonusType: 'referrer_bonus',
        paymentMethod: 'trading_credit', // default to trading credit
        status: 'pending',
      },
      {
        userId: refereeUserId,
        amount: REFERRAL_BONUS_REFEREE_USD,
        bonusType: 'referee_bonus',
        paymentMethod: 'trading_credit', // default to trading credit
        status: 'pending',
      },
    ],
  })
}

/**
 * Gets the current user's referral summary.
 */
export async function getReferralSummary(userId: string): Promise<{
  referralCode: string | null
  totalEarned: number
  activeReferrals: number
  pendingReferrals: number
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: { status: true, referrerBonusUsd: true },
  })

  const bonuses = await prisma.referralBonus.findMany({
    where: {
      userId,
      bonusType: 'referrer_bonus',
      status: 'credited',
    },
    select: { amount: true },
  })

  const activeCount = referrals.filter((r) => r.status === 'active').length
  const pendingCount = referrals.filter((r) => r.status === 'pending').length
  const totalEarned = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0)

  return {
    referralCode: user?.referralCode ?? null,
    totalEarned,
    activeReferrals: activeCount,
    pendingReferrals: pendingCount,
  }
}

/**
 * Gets all referrals for a user.
 */
export async function getUserReferrals(userId: string): Promise<
  Array<{
    id: string
    refereeEmail: string
    status: string
    firstDepositAt: Date | null
    firstDepositAmount: number | null
    referrerBonusUsd: number | null
  }>
> {
  return prisma.referral.findMany({
    where: { referrerId: userId },
    select: {
      id: true,
      refereeEmail: true,
      status: true,
      firstDepositAt: true,
      firstDepositAmount: true,
      referrerBonusUsd: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Credits a pending referral bonus to a user's account.
 * This can be called manually or automatically after verification.
 */
export async function creditReferralBonus(bonusId: string, paymentMethod: 'trading_credit' | 'cash_deposit' = 'trading_credit'): Promise<{
  bonusId: string
  userId: string
  amount: number
  transactionId?: string
}> {
  const bonus = await prisma.referralBonus.findUnique({
    where: { id: bonusId },
    select: { userId: true, amount: true, status: true },
  })

  if (!bonus || bonus.status !== 'pending') {
    throw new Error(`Bonus not found or already credited`)
  }

  // Create a transaction to credit the user
  const transaction = await prisma.transaction.create({
    data: {
      userId: bonus.userId,
      kind: 'deposit',
      currency: 'USD',
      amount: bonus.amount,
      status: 'completed',
      subType: 'referral_bonus',
      reference: `referral_bonus:${bonusId}`,
    },
  })

  // Update the user's USD wallet balance
  const wallet = await prisma.walletBalance.findUnique({
    where: { userId_currency: { userId: bonus.userId, currency: 'USD' } },
    select: { id: true, balance: true, available: true },
  })

  if (wallet) {
    await prisma.walletBalance.update({
      where: { id: wallet.id },
      data: {
        balance: wallet.balance + bonus.amount,
        available: wallet.available + bonus.amount,
      },
    })
  }

  // Mark bonus as credited
  await prisma.referralBonus.update({
    where: { id: bonusId },
    data: {
      status: 'credited',
      creditedAt: new Date(),
      creditedTransactionId: transaction.id,
    },
  })

  return {
    bonusId,
    userId: bonus.userId,
    amount: bonus.amount,
    transactionId: transaction.id,
  }
}
