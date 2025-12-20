-- Fix foreign key constraint violations first
-- Set invalid categoryIds to NULL in McqQuestion
UPDATE "McqQuestion"
SET "categoryId" = NULL
WHERE "categoryId" IS NOT NULL
  AND "categoryId" NOT IN (SELECT id FROM "WallCategory");

-- Add UserStatus enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('SCHOOL', 'COLLEGE', 'WORKING_PROFESSIONAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new fields to StudentProfile (only if they don't exist)
ALTER TABLE "StudentProfile" 
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "religion" TEXT,
  ADD COLUMN IF NOT EXISTS "fatherName" TEXT,
  ADD COLUMN IF NOT EXISTS "fatherHighestDegree" TEXT,
  ADD COLUMN IF NOT EXISTS "fatherOccupation" TEXT,
  ADD COLUMN IF NOT EXISTS "motherName" TEXT,
  ADD COLUMN IF NOT EXISTS "motherHighestDegree" TEXT,
  ADD COLUMN IF NOT EXISTS "motherOccupation" TEXT,
  ADD COLUMN IF NOT EXISTS "nativeAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "currentAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "education" JSONB,
  ADD COLUMN IF NOT EXISTS "interestHobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "professionalSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "internSwitch" TEXT,
  ADD COLUMN IF NOT EXISTS "mentorFor" TEXT,
  ADD COLUMN IF NOT EXISTS "competitiveExams" JSONB,
  ADD COLUMN IF NOT EXISTS "introVideo" TEXT,
  ADD COLUMN IF NOT EXISTS "resume" TEXT;

-- Update userStatus column type if it exists as TEXT
DO $$ 
BEGIN
    -- Check if userStatus exists and is TEXT, then convert to enum
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'StudentProfile' 
        AND column_name = 'userStatus' 
        AND data_type = 'text'
    ) THEN
        -- Add temporary column
        ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "userStatus_new" "UserStatus";
        
        -- Migrate data
        UPDATE "StudentProfile"
        SET "userStatus_new" = CASE
            WHEN "userStatus" IN ('school_10th', 'school_11th', 'school_12th') THEN 'SCHOOL'
            WHEN "userStatus" IN ('college_ug', 'college_pg', 'college_phd', 'other') THEN 'COLLEGE'
            WHEN "userStatus" = 'working_professional' THEN 'WORKING_PROFESSIONAL'
            WHEN UPPER("userStatus") = 'SCHOOL' THEN 'SCHOOL'
            WHEN UPPER("userStatus") = 'COLLEGE' THEN 'COLLEGE'
            WHEN UPPER("userStatus") = 'WORKING_PROFESSIONAL' THEN 'WORKING_PROFESSIONAL'
            ELSE NULL
        END;
        
        -- Drop old column and rename new one
        ALTER TABLE "StudentProfile" DROP COLUMN IF EXISTS "userStatus";
        ALTER TABLE "StudentProfile" RENAME COLUMN "userStatus_new" TO "userStatus";
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'StudentProfile' 
        AND column_name = 'userStatus'
    ) THEN
        -- Column doesn't exist, add it
        ALTER TABLE "StudentProfile" ADD COLUMN "userStatus" "UserStatus";
    END IF;
END $$;

-- Add new fields to Project table
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "projectName" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "designation" TEXT,
  ADD COLUMN IF NOT EXISTS "startMonthYear" TEXT,
  ADD COLUMN IF NOT EXISTS "endMonthYear" TEXT,
  ADD COLUMN IF NOT EXISTS "aboutProject" TEXT;

-- Add new fields to Experience table
ALTER TABLE "Experience"
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "isFacultyMember" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "designation" TEXT,
  ADD COLUMN IF NOT EXISTS "startMonthYear" TEXT,
  ADD COLUMN IF NOT EXISTS "endMonthYear" TEXT,
  ADD COLUMN IF NOT EXISTS "aboutRole" TEXT,
  ADD COLUMN IF NOT EXISTS "currentlyWorking" BOOLEAN DEFAULT false;

