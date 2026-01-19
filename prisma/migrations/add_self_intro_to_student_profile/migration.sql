-- Add selfIntro column to StudentProfile table
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "selfIntro" TEXT;
