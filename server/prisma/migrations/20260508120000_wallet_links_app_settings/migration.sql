-- CreateTable
CREATE TABLE "WalletLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" TEXT,
    "provider" TEXT,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletLink_userId_address_key" ON "WalletLink"("userId", "address");

-- CreateIndex
CREATE INDEX "WalletLink_userId_isPrimary_idx" ON "WalletLink"("userId", "isPrimary");

-- AddForeignKey
ALTER TABLE "WalletLink" ADD CONSTRAINT "WalletLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing User.walletAddress becomes a primary WalletLink.
INSERT INTO "WalletLink" ("id", "userId", "address", "chainId", "provider", "isPrimary", "linkedAt")
SELECT
    'wl_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    "id",
    LOWER("walletAddress"),
    "walletChainId",
    "walletProvider",
    true,
    COALESCE("walletLinkedAt", CURRENT_TIMESTAMP)
FROM "User"
WHERE "walletAddress" IS NOT NULL;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
