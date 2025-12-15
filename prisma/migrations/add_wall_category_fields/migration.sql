-- Migration: Add parentCategoryId, categoryFor, postCount, and metadata to WallCategory
-- This migration adds support for parent-child relationships in wall categories

-- Add parentCategoryId column (nullable foreign key to self)
ALTER TABLE "WallCategory" 
ADD COLUMN IF NOT EXISTS "parentCategoryId" TEXT;

-- Add categoryFor column
ALTER TABLE "WallCategory" 
ADD COLUMN IF NOT EXISTS "categoryFor" TEXT;

-- Add postCount column with default 0
ALTER TABLE "WallCategory" 
ADD COLUMN IF NOT EXISTS "postCount" INTEGER DEFAULT 0;

-- Add metadata column (JSONB)
ALTER TABLE "WallCategory" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Add foreign key constraint for self-referential relationship
-- Note: This will fail if there are existing invalid parentCategoryId values
-- First, set all existing parentCategoryId to NULL if they don't reference valid categories
UPDATE "WallCategory" 
SET "parentCategoryId" = NULL 
WHERE "parentCategoryId" IS NOT NULL 
  AND "parentCategoryId" NOT IN (SELECT id FROM "WallCategory");

-- Now add the foreign key constraint
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_wall_category_parentCategoryId" 
ON "WallCategory"("parentCategoryId") 
WHERE "parentCategoryId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_wall_category_isActive" 
ON "WallCategory"("isActive");

CREATE INDEX IF NOT EXISTS "idx_wall_category_categoryFor" 
ON "WallCategory"("categoryFor") 
WHERE "categoryFor" IS NOT NULL;

-- Initialize postCount for existing categories
UPDATE "WallCategory" 
SET "postCount" = (
  SELECT COUNT(*) 
  FROM "Post" 
  WHERE "Post"."categoryId" = "WallCategory".id
);

-- Set all existing categories as top-level (parentCategoryId = NULL)
UPDATE "WallCategory" 
SET "parentCategoryId" = NULL 
WHERE "parentCategoryId" IS NULL OR "parentCategoryId" = '';


