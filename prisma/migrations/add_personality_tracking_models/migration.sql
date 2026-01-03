-- CreateTable
CREATE TABLE "PersonalityView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalityView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalityViewDuration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalityViewDuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalityReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalityAnswered" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalityAnswered_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalityView_questionId_idx" ON "PersonalityView"("questionId");

-- CreateIndex
CREATE INDEX "PersonalityView_userId_idx" ON "PersonalityView"("userId");

-- CreateIndex
CREATE INDEX "PersonalityView_viewedAt_idx" ON "PersonalityView"("viewedAt");

-- CreateIndex
CREATE INDEX "PersonalityViewDuration_questionId_idx" ON "PersonalityViewDuration"("questionId");

-- CreateIndex
CREATE INDEX "PersonalityViewDuration_userId_idx" ON "PersonalityViewDuration"("userId");

-- CreateIndex
CREATE INDEX "PersonalityViewDuration_viewedAt_idx" ON "PersonalityViewDuration"("viewedAt");

-- CreateIndex
CREATE INDEX "PersonalityReport_questionId_idx" ON "PersonalityReport"("questionId");

-- CreateIndex
CREATE INDEX "PersonalityReport_userId_idx" ON "PersonalityReport"("userId");

-- CreateIndex
CREATE INDEX "PersonalityReport_status_idx" ON "PersonalityReport"("status");

-- CreateIndex
CREATE INDEX "PersonalityAnswered_questionId_idx" ON "PersonalityAnswered"("questionId");

-- CreateIndex
CREATE INDEX "PersonalityAnswered_userId_idx" ON "PersonalityAnswered"("userId");

-- CreateIndex
CREATE INDEX "PersonalityAnswered_answeredAt_idx" ON "PersonalityAnswered"("answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalityReport_userId_questionId_key" ON "PersonalityReport"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalityAnswered_userId_questionId_key" ON "PersonalityAnswered"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "PersonalityView" ADD CONSTRAINT "PersonalityView_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PersonalityQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityViewDuration" ADD CONSTRAINT "PersonalityViewDuration_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PersonalityQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityReport" ADD CONSTRAINT "PersonalityReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PersonalityQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityReport" ADD CONSTRAINT "PersonalityReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityAnswered" ADD CONSTRAINT "PersonalityAnswered_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PersonalityQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityAnswered" ADD CONSTRAINT "PersonalityAnswered_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
