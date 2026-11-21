ALTER TABLE "Customer" ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'person';
ALTER TABLE "Customer" ADD COLUMN "bejermanId" TEXT;
UPDATE "Customer"
SET "entityType" = CASE
  WHEN "companyName" IS NOT NULL AND trim("companyName") <> '' THEN 'company'
  ELSE 'person'
END;

CREATE TABLE "CustomerContact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "title" TEXT,
  "relationship" TEXT NOT NULL DEFAULT 'other',
  "email" TEXT,
  "phone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CustomerContact_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CustomerContact_organizationId_customerId_idx"
  ON "CustomerContact"("organizationId", "customerId");
CREATE INDEX "CustomerContact_organizationId_email_idx"
  ON "CustomerContact"("organizationId", "email");

INSERT INTO "CustomerContact" (
  "id", "organizationId", "customerId", "fullName", "title", "relationship",
  "email", "phone", "isPrimary", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))), "organizationId", "id", "fullName", "contactTitle",
  'other', COALESCE("corporateEmail", "email"), "phone", true, "createdAt", "updatedAt"
FROM "Customer"
WHERE "entityType" = 'company' AND trim("fullName") <> '';

ALTER TABLE "Lead" ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'company';
ALTER TABLE "Lead" ADD COLUMN "contactRelationship" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Lead" ADD COLUMN "customerId" TEXT REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD COLUMN "contactId" TEXT REFERENCES "CustomerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "Lead"
SET "entityType" = CASE
  WHEN "companyName" IS NOT NULL AND trim("companyName") <> '' THEN 'company'
  ELSE 'person'
END;

ALTER TABLE "ManualFollowUp" ADD COLUMN "customerId" TEXT REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualFollowUp" ADD COLUMN "contactId" TEXT REFERENCES "CustomerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualFollowUp" ADD COLUMN "originalDueAt" DATETIME;
ALTER TABLE "ManualFollowUp" ADD COLUMN "outcome" TEXT;
ALTER TABLE "ManualFollowUp" ADD COLUMN "nextAction" TEXT;
ALTER TABLE "ManualFollowUp" ADD COLUMN "cadenceId" TEXT;
ALTER TABLE "ManualFollowUp" ADD COLUMN "cadenceStep" INTEGER;
ALTER TABLE "ManualFollowUp" ADD COLUMN "cadenceOffsetDays" INTEGER;
UPDATE "ManualFollowUp" SET "originalDueAt" = "dueAt";

CREATE TABLE "ManualFollowUpScheduleChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "followUpId" TEXT NOT NULL,
  "changedByUserId" TEXT,
  "changeGroupId" TEXT NOT NULL,
  "previousDueAt" DATETIME NOT NULL,
  "newDueAt" DATETIME NOT NULL,
  "changeReason" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualFollowUpScheduleChange_followUpId_fkey"
    FOREIGN KEY ("followUpId") REFERENCES "ManualFollowUp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ManualFollowUpScheduleChange_changedByUserId_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ManualFollowUpScheduleChange_organizationId_followUpId_createdAt_idx"
  ON "ManualFollowUpScheduleChange"("organizationId", "followUpId", "createdAt");
CREATE INDEX "ManualFollowUpScheduleChange_changeGroupId_idx"
  ON "ManualFollowUpScheduleChange"("changeGroupId");
CREATE INDEX "Customer_organizationId_entityType_documentNumber_idx"
  ON "Customer"("organizationId", "entityType", "documentNumber");
CREATE INDEX "Lead_organizationId_customerId_idx"
  ON "Lead"("organizationId", "customerId");
CREATE INDEX "ManualFollowUp_organizationId_cadenceId_cadenceStep_idx"
  ON "ManualFollowUp"("organizationId", "cadenceId", "cadenceStep");
