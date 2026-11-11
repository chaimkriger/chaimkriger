-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RECRUITER', 'OFFSHORE_RECRUITER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PersonKind" AS ENUM ('APPLICANT', 'STAFF');

-- CreateEnum
CREATE TYPE "Certification" AS ENUM ('CERTIFIED', 'IN_PROGRESS', 'NOT_CERTIFIED');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('APPLIED', 'FORM_COMPLETED', 'SCREENED', 'APPLICATION_SENT', 'IN_SERVICES_SENT', 'PAPERWORK_COMPLETE', 'READY_TO_PLACE', 'PLACED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NEEDS_STAFFING', 'STAFFED', 'RESTAFFING', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('PRIMARY', 'BACKUP');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('SENT', 'YES', 'NO', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "kind" "PersonKind" NOT NULL DEFAULT 'APPLICANT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "certification" "Certification" NOT NULL DEFAULT 'NOT_CERTIFIED',
    "availability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxTravelMinutes" INTEGER NOT NULL DEFAULT 30,
    "hasCar" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "earliestStart" TIMESTAMP(3),
    "stage" "Stage" NOT NULL DEFAULT 'APPLIED',
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formCompletedAt" TIMESTAMP(3),
    "screenedAt" TIMESTAMP(3),
    "applicationSentAt" TIMESTAMP(3),
    "inServicesSentAt" TIMESTAMP(3),
    "hiredAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'apploi-hubspot',
    "hubspotContactId" TEXT,
    "apploiId" TEXT,
    "workdayEmployeeId" TEXT,
    "recruiterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientLabel" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "slots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 10,
    "languageRequired" TEXT,
    "ageGroup" TEXT,
    "rbtRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEEDS_STAFFING',
    "assessmentCompletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waitingSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffedAt" TIMESTAMP(3),
    "dischargedAt" TIMESTAMP(3),
    "hubspotId" TEXT,
    "hubspotSyncStatus" TEXT,
    "hubspotSyncedAt" TIMESTAMP(3),
    "hubspotSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "createdById" TEXT,
    "via" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "RecipientStatus" NOT NULL DEFAULT 'SENT',
    "proposedRole" "AssignmentRole",
    "confirmedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" TIMESTAMP(3),
    "replyText" TEXT,

    CONSTRAINT "OutreachRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "direction" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'general',
    "campaignId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockHubspotObject" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockHubspotObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Person_mobile_key" ON "Person"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Person_hubspotContactId_key" ON "Person"("hubspotContactId");

-- CreateIndex
CREATE INDEX "Person_kind_stage_idx" ON "Person"("kind", "stage");

-- CreateIndex
CREATE INDEX "Person_state_idx" ON "Person"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Case_code_key" ON "Case"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Case_hubspotId_key" ON "Case"("hubspotId");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Assignment_caseId_status_idx" ON "Assignment"("caseId", "status");

-- CreateIndex
CREATE INDEX "Assignment_personId_status_idx" ON "Assignment"("personId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachRecipient_campaignId_personId_key" ON "OutreachRecipient"("campaignId", "personId");

-- CreateIndex
CREATE INDEX "Message_personId_idx" ON "Message"("personId");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE INDEX "MockHubspotObject_objectType_idx" ON "MockHubspotObject"("objectType");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachRecipient" ADD CONSTRAINT "OutreachRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachRecipient" ADD CONSTRAINT "OutreachRecipient_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
