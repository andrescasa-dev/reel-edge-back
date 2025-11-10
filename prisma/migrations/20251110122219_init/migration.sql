-- CreateTable
CREATE TABLE "casinos" (
    "id" TEXT NOT NULL,
    "casinodb_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "website" TEXT,
    "regulatoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missing_casinos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "website" TEXT,
    "regulatoryId" TEXT,
    "promotionsFound" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missing_casinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_comparisons" (
    "id" TEXT NOT NULL,
    "casinoId" TEXT NOT NULL,
    "currentOfferName" TEXT,
    "currentOfferType" TEXT,
    "currentExpectedDeposit" DOUBLE PRECISION,
    "currentExpectedBonus" DOUBLE PRECISION,
    "currentTermsAndConditions" TEXT,
    "currentWageringRequirements" TEXT,
    "discoveredOfferName" TEXT NOT NULL,
    "discoveredOfferType" TEXT NOT NULL,
    "discoveredExpectedDeposit" DOUBLE PRECISION NOT NULL,
    "discoveredExpectedBonus" DOUBLE PRECISION NOT NULL,
    "discoveredTermsAndConditions" TEXT,
    "discoveredWageringRequirements" TEXT,
    "discoveredValidFrom" TIMESTAMP(3),
    "discoveredValidUntil" TIMESTAMP(3),
    "comparisonType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sources" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_jobs" (
    "id" TEXT NOT NULL,
    "states" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "results" JSONB,
    "errors" JSONB,

    CONSTRAINT "research_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "casinos_casinodb_id_key" ON "casinos"("casinodb_id");

-- CreateIndex
CREATE INDEX "casinos_state_idx" ON "casinos"("state");

-- CreateIndex
CREATE INDEX "casinos_name_idx" ON "casinos"("name");

-- CreateIndex
CREATE INDEX "missing_casinos_state_idx" ON "missing_casinos"("state");

-- CreateIndex
CREATE INDEX "missing_casinos_name_idx" ON "missing_casinos"("name");

-- CreateIndex
CREATE INDEX "promotion_comparisons_status_comparisonType_idx" ON "promotion_comparisons"("status", "comparisonType");

-- CreateIndex
CREATE INDEX "promotion_comparisons_casinoId_idx" ON "promotion_comparisons"("casinoId");

-- CreateIndex
CREATE INDEX "promotion_comparisons_discoveredOfferType_idx" ON "promotion_comparisons"("discoveredOfferType");

-- CreateIndex
CREATE INDEX "research_jobs_startedAt_idx" ON "research_jobs"("startedAt");

-- CreateIndex
CREATE INDEX "research_jobs_status_idx" ON "research_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_jobName_key" ON "scheduled_jobs"("jobName");

-- CreateIndex
CREATE INDEX "scheduled_jobs_isActive_nextRun_idx" ON "scheduled_jobs"("isActive", "nextRun");

-- AddForeignKey
ALTER TABLE "promotion_comparisons" ADD CONSTRAINT "promotion_comparisons_casinoId_fkey" FOREIGN KEY ("casinoId") REFERENCES "casinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
