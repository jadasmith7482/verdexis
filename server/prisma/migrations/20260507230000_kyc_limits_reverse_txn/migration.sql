-- KYC review queue
ALTER TABLE "User" ADD COLUMN "kycStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN "kycNotes" TEXT;
ALTER TABLE "User" ADD COLUMN "kycReviewedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "kycReviewedBy" TEXT;

-- Per-user limits (USD-equivalent). NULL = unlimited.
ALTER TABLE "User" ADD COLUMN "dailyWithdrawLimit" REAL;
ALTER TABLE "User" ADD COLUMN "monthlyWithdrawLimit" REAL;
ALTER TABLE "User" ADD COLUMN "dailyTransferLimit" REAL;
ALTER TABLE "User" ADD COLUMN "monthlyTransferLimit" REAL;

-- IP allowlist (comma-separated)
ALTER TABLE "User" ADD COLUMN "ipAllowlist" TEXT;

-- Transaction back-reference for reversals + fee sub-type
ALTER TABLE "Transaction" ADD COLUMN "reversedFromId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "subType" TEXT;
CREATE INDEX "Transaction_reversedFromId_idx" ON "Transaction"("reversedFromId");
