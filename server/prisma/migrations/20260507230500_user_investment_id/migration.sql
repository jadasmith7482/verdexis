-- AlterTable: add nullable investmentId column
ALTER TABLE "User" ADD COLUMN "investmentId" TEXT;

-- Backfill existing rows with a unique VDX-XXXXXXXX identifier.
-- sqlite's randomblob/hex give us 8 uppercase hex chars per row.
UPDATE "User"
   SET "investmentId" = 'VDX-' || upper(substr(hex(randomblob(4)), 1, 8))
 WHERE "investmentId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_investmentId_key" ON "User"("investmentId");
