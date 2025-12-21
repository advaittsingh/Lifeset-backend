-- CreateTable: DailyDigestPersonalityQuestion
-- Track personality questions shown to users in daily digest
CREATE TABLE IF NOT EXISTS "DailyDigestPersonalityQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyDigestPersonalityQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DailyDigestGkArticle
-- Track GK articles shown in daily digest
CREATE TABLE IF NOT EXISTS "DailyDigestGkArticle" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyDigestGkArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyDigestPersonalityQuestion_userId_idx" ON "DailyDigestPersonalityQuestion"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyDigestPersonalityQuestion_questionId_idx" ON "DailyDigestPersonalityQuestion"("questionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyDigestPersonalityQuestion_shownAt_idx" ON "DailyDigestPersonalityQuestion"("shownAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyDigestGkArticle_postId_idx" ON "DailyDigestGkArticle"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyDigestGkArticle_shownAt_idx" ON "DailyDigestGkArticle"("shownAt");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "DailyDigestPersonalityQuestion_userId_questionId_shownAt_key" ON "DailyDigestPersonalityQuestion"("userId", "questionId", "shownAt");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "DailyDigestGkArticle_postId_shownAt_key" ON "DailyDigestGkArticle"("postId", "shownAt");

-- AddForeignKey
ALTER TABLE "DailyDigestPersonalityQuestion" ADD CONSTRAINT "DailyDigestPersonalityQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDigestPersonalityQuestion" ADD CONSTRAINT "DailyDigestPersonalityQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PersonalityQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDigestGkArticle" ADD CONSTRAINT "DailyDigestGkArticle_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

