-- Migration: Add PostReport model and update WallCategory with parentCategoryId support
-- This migration adds support for reporting articles and category hierarchy

-- Update WallCategory if fields don't exist (they may already exist from previous migration)
ALTER TABLE "WallCategory" 
ADD COLUMN IF NOT EXISTS "parentCategoryId" TEXT,
ADD COLUMN IF NOT EXISTS "categoryFor" TEXT,
ADD COLUMN IF NOT EXISTS "postCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Add foreign key constraint for self-referential relationship if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WallCategory_parentCategoryId_fkey'
  ) THEN
    ALTER TABLE "WallCategory"
    ADD CONSTRAINT "WallCategory_parentCategoryId_fkey"
    FOREIGN KEY ("parentCategoryId") 
    REFERENCES "WallCategory"(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS "idx_wall_category_parentCategoryId" 
ON "WallCategory"("parentCategoryId") 
WHERE "parentCategoryId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_wall_category_isActive" 
ON "WallCategory"("isActive");

CREATE INDEX IF NOT EXISTS "idx_wall_category_categoryFor" 
ON "WallCategory"("categoryFor") 
WHERE "categoryFor" IS NOT NULL;

-- Create PostReport table
CREATE TABLE IF NOT EXISTS "PostReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostReport_postId_idx" ON "PostReport"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostReport_userId_idx" ON "PostReport"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostReport_status_idx" ON "PostReport"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostReport_createdAt_idx" ON "PostReport"("createdAt");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "PostReport_userId_postId_key" ON "PostReport"("userId", "postId");

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

