-- Migration: Add MCQ tracking models and fields
-- This migration adds support for view tracking, read status, answered status, reporting, and solution field

-- Add solution field to McqQuestion if it doesn't exist
ALTER TABLE "McqQuestion" 
ADD COLUMN IF NOT EXISTS "solution" TEXT;

-- Add articleId field to McqQuestion if it doesn't exist (may already exist from previous migration)
ALTER TABLE "McqQuestion" 
ADD COLUMN IF NOT EXISTS "articleId" TEXT;

-- Create index for articleId if it doesn't exist
CREATE INDEX IF NOT EXISTS "McqQuestion_articleId_idx" 
ON "McqQuestion"("articleId") 
WHERE "articleId" IS NOT NULL;

-- Create McqView table
CREATE TABLE IF NOT EXISTS "McqView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McqView_pkey" PRIMARY KEY ("id")
);

-- Create McqRead table
CREATE TABLE IF NOT EXISTS "McqRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McqRead_pkey" PRIMARY KEY ("id")
);

-- Create McqViewDuration table
CREATE TABLE IF NOT EXISTS "McqViewDuration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McqViewDuration_pkey" PRIMARY KEY ("id")
);

-- Create McqReport table
CREATE TABLE IF NOT EXISTS "McqReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McqReport_pkey" PRIMARY KEY ("id")
);

-- Create McqAnswered table
CREATE TABLE IF NOT EXISTS "McqAnswered" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McqAnswered_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for McqView
CREATE INDEX IF NOT EXISTS "McqView_questionId_idx" ON "McqView"("questionId");
CREATE INDEX IF NOT EXISTS "McqView_userId_idx" ON "McqView"("userId");
CREATE INDEX IF NOT EXISTS "McqView_viewedAt_idx" ON "McqView"("viewedAt");

-- CreateIndex for McqRead
CREATE INDEX IF NOT EXISTS "McqRead_questionId_idx" ON "McqRead"("questionId");
CREATE INDEX IF NOT EXISTS "McqRead_userId_idx" ON "McqRead"("userId");
CREATE INDEX IF NOT EXISTS "McqRead_readAt_idx" ON "McqRead"("readAt");

-- CreateIndex for McqViewDuration
CREATE INDEX IF NOT EXISTS "McqViewDuration_questionId_idx" ON "McqViewDuration"("questionId");
CREATE INDEX IF NOT EXISTS "McqViewDuration_userId_idx" ON "McqViewDuration"("userId");
CREATE INDEX IF NOT EXISTS "McqViewDuration_viewedAt_idx" ON "McqViewDuration"("viewedAt");

-- CreateIndex for McqReport
CREATE INDEX IF NOT EXISTS "McqReport_questionId_idx" ON "McqReport"("questionId");
CREATE INDEX IF NOT EXISTS "McqReport_userId_idx" ON "McqReport"("userId");
CREATE INDEX IF NOT EXISTS "McqReport_status_idx" ON "McqReport"("status");
CREATE INDEX IF NOT EXISTS "McqReport_createdAt_idx" ON "McqReport"("createdAt");

-- CreateIndex for McqAnswered
CREATE INDEX IF NOT EXISTS "McqAnswered_questionId_idx" ON "McqAnswered"("questionId");
CREATE INDEX IF NOT EXISTS "McqAnswered_userId_idx" ON "McqAnswered"("userId");
CREATE INDEX IF NOT EXISTS "McqAnswered_answeredAt_idx" ON "McqAnswered"("answeredAt");

-- CreateUniqueConstraint for McqRead
CREATE UNIQUE INDEX IF NOT EXISTS "McqRead_userId_questionId_key" ON "McqRead"("userId", "questionId");

-- CreateUniqueConstraint for McqReport
CREATE UNIQUE INDEX IF NOT EXISTS "McqReport_userId_questionId_key" ON "McqReport"("userId", "questionId");

-- CreateUniqueConstraint for McqAnswered
CREATE UNIQUE INDEX IF NOT EXISTS "McqAnswered_userId_questionId_key" ON "McqAnswered"("userId", "questionId");

-- AddForeignKey for McqView
ALTER TABLE "McqView" ADD CONSTRAINT "McqView_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for McqRead
ALTER TABLE "McqRead" ADD CONSTRAINT "McqRead_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McqRead" ADD CONSTRAINT "McqRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for McqViewDuration
ALTER TABLE "McqViewDuration" ADD CONSTRAINT "McqViewDuration_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for McqReport
ALTER TABLE "McqReport" ADD CONSTRAINT "McqReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McqReport" ADD CONSTRAINT "McqReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for McqAnswered
ALTER TABLE "McqAnswered" ADD CONSTRAINT "McqAnswered_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McqAnswered" ADD CONSTRAINT "McqAnswered_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

