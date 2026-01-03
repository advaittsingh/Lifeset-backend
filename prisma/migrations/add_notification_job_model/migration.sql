-- Create NotificationJob table
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "redirectionLink" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ALL',
    "frequency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "filterConditions" JSONB,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- Add jobId column to Notification table
ALTER TABLE "Notification" ADD COLUMN "jobId" TEXT;

-- CreateIndex for NotificationJob
CREATE INDEX "NotificationJob_status_idx" ON "NotificationJob"("status");
CREATE INDEX "NotificationJob_scheduledAt_idx" ON "NotificationJob"("scheduledAt");
CREATE INDEX "NotificationJob_nextSendAt_idx" ON "NotificationJob"("nextSendAt");
CREATE INDEX "NotificationJob_createdBy_idx" ON "NotificationJob"("createdBy");
CREATE INDEX "NotificationJob_messageType_idx" ON "NotificationJob"("messageType");

-- CreateIndex for Notification
CREATE INDEX "Notification_jobId_idx" ON "Notification"("jobId");

-- AddForeignKey for Notification
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "NotificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for NotificationJob (if User table exists)
-- Note: This assumes User table has id column. Adjust if needed.
-- ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
