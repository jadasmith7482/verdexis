-- Add account-hold fields to User. SQLite supports ADD COLUMN one at a time.
ALTER TABLE "User" ADD COLUMN "holdActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "holdType" TEXT;
ALTER TABLE "User" ADD COLUMN "holdReason" TEXT;
ALTER TABLE "User" ADD COLUMN "holdNote" TEXT;
ALTER TABLE "User" ADD COLUMN "holdAt" DATETIME;
