-- Migration: Add PostView, PostRead, and PostViewDuration models for current affairs tracking
-- This migration adds support for view tracking, read status, and view duration tracking

-- Create PostView table
CREATE TABLE IF NOT EXISTS "PostView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "postId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- Create PostRead table
CREATE TABLE IF NOT EXISTS "PostRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostRead_pkey" PRIMARY KEY ("id")
);

-- Create PostViewDuration table
CREATE TABLE IF NOT EXISTS "PostViewDuration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "postId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostViewDuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for PostView
CREATE INDEX IF NOT EXISTS "PostView_postId_idx" ON "PostView"("postId");
CREATE INDEX IF NOT EXISTS "PostView_userId_idx" ON "PostView"("userId");
CREATE INDEX IF NOT EXISTS "PostView_viewedAt_idx" ON "PostView"("viewedAt");

-- CreateIndex for PostRead
CREATE INDEX IF NOT EXISTS "PostRead_postId_idx" ON "PostRead"("postId");
CREATE INDEX IF NOT EXISTS "PostRead_userId_idx" ON "PostRead"("userId");
CREATE INDEX IF NOT EXISTS "PostRead_readAt_idx" ON "PostRead"("readAt");

-- CreateIndex for PostViewDuration
CREATE INDEX IF NOT EXISTS "PostViewDuration_postId_idx" ON "PostViewDuration"("postId");
CREATE INDEX IF NOT EXISTS "PostViewDuration_userId_idx" ON "PostViewDuration"("userId");
CREATE INDEX IF NOT EXISTS "PostViewDuration_viewedAt_idx" ON "PostViewDuration"("viewedAt");

-- CreateUniqueConstraint for PostRead
CREATE UNIQUE INDEX IF NOT EXISTS "PostRead_userId_postId_key" ON "PostRead"("userId", "postId");

-- AddForeignKey for PostView
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for PostRead
ALTER TABLE "PostRead" ADD CONSTRAINT "PostRead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostRead" ADD CONSTRAINT "PostRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for PostViewDuration
ALTER TABLE "PostViewDuration" ADD CONSTRAINT "PostViewDuration_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

