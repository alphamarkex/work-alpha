-- AlterTable: Meeting gets an optional external meeting link (Zoom/Meet/Teams)
ALTER TABLE "Meeting" ADD COLUMN "meetingLink" TEXT;

-- AlterTable: Invoice gets reminder tracking + an unguessable public token
ALTER TABLE "Invoice" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "publicToken" TEXT;

-- Backfill existing rows with a random token before enforcing NOT NULL/unique
UPDATE "Invoice" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
