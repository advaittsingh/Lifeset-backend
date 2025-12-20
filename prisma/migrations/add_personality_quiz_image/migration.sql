-- Add imageUrl field to PersonalityQuiz table
ALTER TABLE "PersonalityQuiz" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

