ALTER TABLE "Organization" ADD COLUMN "monthlyEquipmentTarget" DECIMAL NOT NULL DEFAULT 80000000;
ALTER TABLE "Organization" ADD COLUMN "monthlyServicePartsTarget" DECIMAL NOT NULL DEFAULT 50000000;

ALTER TABLE "Lead" ADD COLUMN "customerType" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "Lead" ADD COLUMN "requestType" TEXT NOT NULL DEFAULT 'new_equipment';
ALTER TABLE "Lead" ADD COLUMN "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD COLUMN "equipmentQuantity" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "Lead_organizationId_customerType_idx" ON "Lead"("organizationId", "customerType");

ALTER TABLE "Opportunity" ADD COLUMN "quotedAt" DATETIME;

CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL DEFAULT 1,
    "invoiceDate" DATETIME NOT NULL,
    "customerEmail" TEXT,
    "customerName" TEXT NOT NULL,
    "salesOwner" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "equipmentQuantity" INTEGER NOT NULL DEFAULT 0,
    "customerType" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesInvoice_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SalesInvoice_organizationId_invoiceNumber_lineNumber_key"
  ON "SalesInvoice"("organizationId", "invoiceNumber", "lineNumber");
CREATE INDEX "SalesInvoice_organizationId_invoiceDate_idx"
  ON "SalesInvoice"("organizationId", "invoiceDate");
CREATE INDEX "SalesInvoice_organizationId_salesOwner_invoiceDate_idx"
  ON "SalesInvoice"("organizationId", "salesOwner", "invoiceDate");
CREATE INDEX "SalesInvoice_organizationId_businessUnit_invoiceDate_idx"
  ON "SalesInvoice"("organizationId", "businessUnit", "invoiceDate");
CREATE INDEX "SalesInvoice_organizationId_customerEmail_invoiceDate_idx"
  ON "SalesInvoice"("organizationId", "customerEmail", "invoiceDate");
