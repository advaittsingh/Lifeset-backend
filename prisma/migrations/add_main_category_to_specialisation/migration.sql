-- Add mainCategory field to Specialisation model
ALTER TABLE "Specialisation" 
ADD COLUMN IF NOT EXISTS "mainCategory" TEXT;
