-- CreateTable: the tenant root
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "address" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Backfill: every row that already exists in this database belongs to your
-- original company. Create that Organization now so existing data has
-- somewhere to attach before organizationId becomes required below.
INSERT INTO "Organization" ("id", "name", "gstin", "address", "email")
VALUES (
  'org_default_alphamarkex',
  'ALPHAMARKEX LLP',
  '09ACMFA9676Q1Z5',
  'Oro Dental Clinic, Mahuwaria, Mirzapur, Uttar Pradesh',
  'alphamarkex@gmail.com'
);

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
UPDATE "User" SET "organizationId" = 'org_default_alphamarkex' WHERE "organizationId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

-- employeeId moves from globally-unique to unique-per-organization
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_employeeId_key";
CREATE UNIQUE INDEX "User_organizationId_employeeId_key" ON "User"("organizationId", "employeeId");

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Client
ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;
UPDATE "Client" SET "organizationId" = 'org_default_alphamarkex' WHERE "organizationId" IS NULL;
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Invoice
ALTER TABLE "Invoice" ADD COLUMN "organizationId" TEXT;
UPDATE "Invoice" SET "organizationId" = 'org_default_alphamarkex' WHERE "organizationId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET NOT NULL;

-- invoiceNo moves from globally-unique to unique-per-organization
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_invoiceNo_key";
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNo_key" ON "Invoice"("organizationId", "invoiceNo");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Task
ALTER TABLE "Task" ADD COLUMN "organizationId" TEXT;
UPDATE "Task" SET "organizationId" = 'org_default_alphamarkex' WHERE "organizationId" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
