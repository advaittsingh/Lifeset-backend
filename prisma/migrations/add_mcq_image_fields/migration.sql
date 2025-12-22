-- Add image fields to McqQuestion model
ALTER TABLE "McqQuestion" 
ADD COLUMN IF NOT EXISTS "questionImage" TEXT,
ADD COLUMN IF NOT EXISTS "explanationImage" TEXT;

