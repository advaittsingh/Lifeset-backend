-- Migration: Add Chapter model
-- This migration creates the Chapter table as a child of WallCategory (sub-category)

-- Create Chapter table
CREATE TABLE IF NOT EXISTS "Chapter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subCategoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint to WallCategory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Chapter_subCategoryId_fkey'
  ) THEN
    ALTER TABLE "Chapter"
    ADD CONSTRAINT "Chapter_subCategoryId_fkey"
    FOREIGN KEY ("subCategoryId") 
    REFERENCES "WallCategory"(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_chapter_subCategoryId" 
ON "Chapter"("subCategoryId");

CREATE INDEX IF NOT EXISTS "idx_chapter_isActive" 
ON "Chapter"("isActive");

CREATE INDEX IF NOT EXISTS "idx_chapter_order" 
ON "Chapter"("order");








