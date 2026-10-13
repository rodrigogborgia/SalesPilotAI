-- Extend roles for authenticated plant-floor operators.
ALTER TYPE "UserRole" ADD VALUE 'CLIENT_OPERATOR';

-- Add QR access and in-plant location to installed assets.
ALTER TABLE "InstalledEquipment"
ADD COLUMN "qrToken" TEXT,
ADD COLUMN "locationInPlant" TEXT;

UPDATE "InstalledEquipment"
SET "qrToken" = gen_random_uuid()::TEXT
WHERE "qrToken" IS NULL;

ALTER TABLE "InstalledEquipment"
ALTER COLUMN "qrToken" SET NOT NULL;

CREATE UNIQUE INDEX "InstalledEquipment_qrToken_key"
ON "InstalledEquipment"("qrToken");

-- Product technical documentation.
CREATE TYPE "TechnicalDocumentType" AS ENUM ('MANUAL', 'SCHEMA', 'DATASHEET');

CREATE TABLE "TechnicalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" "TechnicalDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TechnicalDocument_organizationId_productId_idx"
ON "TechnicalDocument"("organizationId", "productId");

CREATE INDEX "TechnicalDocument_productId_documentType_idx"
ON "TechnicalDocument"("productId", "documentType");

ALTER TABLE "TechnicalDocument"
ADD CONSTRAINT "TechnicalDocument_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TechnicalDocument"
ADD CONSTRAINT "TechnicalDocument_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer assistance tickets reported against installed equipment.
CREATE TYPE "SupportTicketStatus" AS ENUM (
    'RECEIVED',
    'DIAGNOSING',
    'SCHEDULED',
    'REPAIRING',
    'RESOLVED'
);

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "installedEquipmentId" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_organizationId_status_idx"
ON "SupportTicket"("organizationId", "status");

CREATE INDEX "SupportTicket_organizationId_installedEquipmentId_idx"
ON "SupportTicket"("organizationId", "installedEquipmentId");

ALTER TABLE "SupportTicket"
ADD CONSTRAINT "SupportTicket_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
ADD CONSTRAINT "SupportTicket_installedEquipmentId_fkey"
FOREIGN KEY ("installedEquipmentId") REFERENCES "InstalledEquipment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
