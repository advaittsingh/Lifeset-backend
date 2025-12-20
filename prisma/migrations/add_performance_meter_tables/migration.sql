-- CreateTable
CREATE TABLE "DailyDigestEngagement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "engagementType" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDigestEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEngagementStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT false,
    "cardViewCount" INTEGER NOT NULL DEFAULT 0,
    "mcqAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "mcqCorrectCount" INTEGER NOT NULL DEFAULT 0,
    "mcqAccuracy" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "totalEngagementDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyEngagementStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadgeStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentBadge" TEXT,
    "daysActive" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBadgeStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyDigestEngagement_userId_date_idx" ON "DailyDigestEngagement"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyDigestEngagement_userId_cardId_date_idx" ON "DailyDigestEngagement"("userId", "cardId", "date");

-- CreateIndex
CREATE INDEX "DailyDigestEngagement_date_idx" ON "DailyDigestEngagement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEngagementStatus_userId_date_key" ON "DailyEngagementStatus"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyEngagementStatus_userId_date_idx" ON "DailyEngagementStatus"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyEngagementStatus_userId_date_isPresent_idx" ON "DailyEngagementStatus"("userId", "date", "isPresent");

-- CreateIndex
CREATE INDEX "DailyEngagementStatus_date_idx" ON "DailyEngagementStatus"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadgeStatus_userId_key" ON "UserBadgeStatus"("userId");

-- CreateIndex
CREATE INDEX "UserBadgeStatus_userId_idx" ON "UserBadgeStatus"("userId");

-- AddForeignKey
ALTER TABLE "DailyDigestEngagement" ADD CONSTRAINT "DailyDigestEngagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEngagementStatus" ADD CONSTRAINT "DailyEngagementStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadgeStatus" ADD CONSTRAINT "UserBadgeStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


