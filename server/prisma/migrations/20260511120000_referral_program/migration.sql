-- Add referral fields to User table
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referrerId" TEXT;

-- Create unique index for referral code
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- Add foreign key for referrer
ALTER TABLE "User" ADD CONSTRAINT "User_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable Referral
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "refereeEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firstDepositAt" TIMESTAMP(3),
    "firstDepositAmount" DOUBLE PRECISION,
    "referrerBonusUsd" DOUBLE PRECISION,
    "refereeBonusUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Referral
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");
CREATE INDEX "Referral_refereeEmail_idx" ON "Referral"("refereeEmail");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- Add foreign key for Referral.referrerId
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ReferralBonus
CREATE TABLE "ReferralBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bonusType" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'trading_credit',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "creditedAt" TIMESTAMP(3),
    "creditedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for ReferralBonus
CREATE INDEX "ReferralBonus_userId_createdAt_idx" ON "ReferralBonus"("userId", "createdAt");
CREATE INDEX "ReferralBonus_status_idx" ON "ReferralBonus"("status");

-- Add foreign key for ReferralBonus.userId
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
