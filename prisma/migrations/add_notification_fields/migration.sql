-- Add redirectUrl and image fields to Notification table
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "redirectUrl" VARCHAR(500);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "image" TEXT;



