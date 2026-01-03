-- Migration: Update userStatus from 8 options to 3 simplified options
-- Old values: school_10th, school_11th, school_12th, college_ug, college_pg, college_phd, working_professional, other
-- New values: SCHOOL, COLLEGE, WORKING_PROFESSIONAL

-- Step 1: Create the UserStatus enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('SCHOOL', 'COLLEGE', 'WORKING_PROFESSIONAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add userStatus column if it doesn't exist (as String first for migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'StudentProfile' AND column_name = 'userStatus'
  ) THEN
    ALTER TABLE "StudentProfile" ADD COLUMN "userStatus" TEXT;
  END IF;
END $$;

-- Step 3: Migrate existing data (if any exists in metadata or other fields)
-- Map old values to new values
UPDATE "StudentProfile"
SET "userStatus" = CASE
  -- Old school values -> SCHOOL
  WHEN "userStatus" IN ('school_10th', 'school_11th', 'school_12th') THEN 'SCHOOL'
  -- Old college values -> COLLEGE
  WHEN "userStatus" IN ('college_ug', 'college_pg', 'college_phd', 'other') THEN 'COLLEGE'
  -- Keep working_professional -> WORKING_PROFESSIONAL
  WHEN "userStatus" = 'working_professional' THEN 'WORKING_PROFESSIONAL'
  -- Default to COLLEGE for any other values
  ELSE 'COLLEGE'
END
WHERE "userStatus" IS NOT NULL;

-- Step 4: Convert the column to use the enum type
-- First, ensure all values are valid enum values
UPDATE "StudentProfile"
SET "userStatus" = 'COLLEGE'
WHERE "userStatus" IS NOT NULL 
  AND "userStatus" NOT IN ('SCHOOL', 'COLLEGE', 'WORKING_PROFESSIONAL');

-- Step 5: Alter column to use enum type
ALTER TABLE "StudentProfile" 
ALTER COLUMN "userStatus" TYPE "UserStatus" 
USING "userStatus"::"UserStatus";

-- Step 6: Add preferredLanguage column if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'StudentProfile' AND column_name = 'preferredLanguage'
  ) THEN
    ALTER TABLE "StudentProfile" ADD COLUMN "preferredLanguage" TEXT;
  END IF;
END $$;




