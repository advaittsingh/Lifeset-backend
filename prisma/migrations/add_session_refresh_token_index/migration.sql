-- Migration: Add index on refreshToken field in Session table
-- This migration adds an index on refreshToken for faster lookups in restoreSession and refreshToken methods

-- Create index on refreshToken if it doesn't exist
CREATE INDEX IF NOT EXISTS "Session_refreshToken_idx" 
ON "Session"("refreshToken") 
WHERE "refreshToken" IS NOT NULL;

