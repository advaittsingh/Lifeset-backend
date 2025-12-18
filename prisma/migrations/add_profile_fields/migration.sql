-- Migration: Add all profile fields from PROFILE_FIELDS_DATABASE.md
-- This migration adds all missing fields to StudentProfile, Project, and Experience models

-- Add Personal Details fields to StudentProfile
ALTER TABLE "StudentProfile" 
ADD COLUMN IF NOT EXISTS "languageKnown" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "religion" TEXT,
ADD COLUMN IF NOT EXISTS "fatherName" TEXT,
ADD COLUMN IF NOT EXISTS "fatherHighestDegree" TEXT,
ADD COLUMN IF NOT EXISTS "fatherOccupation" TEXT,
ADD COLUMN IF NOT EXISTS "motherName" TEXT,
ADD COLUMN IF NOT EXISTS "motherHighestDegree" TEXT,
ADD COLUMN IF NOT EXISTS "motherOccupation" TEXT,
ADD COLUMN IF NOT EXISTS "resume" TEXT,
ADD COLUMN IF NOT EXISTS "introVideo" TEXT;

-- Add Address fields (stored as JSON)
ALTER TABLE "StudentProfile" 
ADD COLUMN IF NOT EXISTS "nativeAddress" JSONB,
ADD COLUMN IF NOT EXISTS "currentAddress" JSONB;

-- Add Education array field (stored as JSON)
ALTER TABLE "StudentProfile" 
ADD COLUMN IF NOT EXISTS "education" JSONB;

-- Add Skills fields
ALTER TABLE "StudentProfile" 
ADD COLUMN IF NOT EXISTS "interestHobbies" TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "professionalSkills" TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "internSwitch" TEXT,
ADD COLUMN IF NOT EXISTS "mentorFor" TEXT;

-- Add Competitive Exams (stored as JSON array)
ALTER TABLE "StudentProfile" 
ADD COLUMN IF NOT EXISTS "competitiveExams" JSONB;

-- Update Project model with new fields from PROFILE_FIELDS_DATABASE.md
ALTER TABLE "Project" 
ADD COLUMN IF NOT EXISTS "projectName" TEXT,
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "department" TEXT,
ADD COLUMN IF NOT EXISTS "designation" TEXT,
ADD COLUMN IF NOT EXISTS "startMonthYear" TEXT,
ADD COLUMN IF NOT EXISTS "endMonthYear" TEXT,
ADD COLUMN IF NOT EXISTS "aboutProject" TEXT;

-- Migrate existing data: if title exists but projectName doesn't, copy title to projectName
UPDATE "Project" 
SET "projectName" = "title" 
WHERE "projectName" IS NULL AND "title" IS NOT NULL;

-- Update Experience model with new fields from PROFILE_FIELDS_DATABASE.md
ALTER TABLE "Experience" 
ADD COLUMN IF NOT EXISTS "companyName" TEXT,
ADD COLUMN IF NOT EXISTS "isFacultyMember" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "department" TEXT,
ADD COLUMN IF NOT EXISTS "designation" TEXT,
ADD COLUMN IF NOT EXISTS "currentlyWorking" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "startMonthYear" TEXT,
ADD COLUMN IF NOT EXISTS "endMonthYear" TEXT,
ADD COLUMN IF NOT EXISTS "aboutRole" TEXT,
ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP;

-- Migrate existing data: if company exists but companyName doesn't, copy company to companyName
UPDATE "Experience" 
SET "companyName" = "company" 
WHERE "companyName" IS NULL AND "company" IS NOT NULL;

-- Migrate existing data: if title exists but designation doesn't, copy title to designation
UPDATE "Experience" 
SET "designation" = "title" 
WHERE "designation" IS NULL AND "title" IS NOT NULL;

-- Migrate existing data: if description exists but aboutRole doesn't, copy description to aboutRole
UPDATE "Experience" 
SET "aboutRole" = "description" 
WHERE "aboutRole" IS NULL AND "description" IS NOT NULL;

-- Migrate existing data: if isCurrent exists, copy to currentlyWorking
UPDATE "Experience" 
SET "currentlyWorking" = "isCurrent" 
WHERE "currentlyWorking" = false AND "isCurrent" = true;

-- Migrate existing data: if startDate exists, convert to startMonthYear format (MM/YYYY)
UPDATE "Experience" 
SET "startMonthYear" = TO_CHAR("startDate", 'MM/YYYY')
WHERE "startMonthYear" IS NULL AND "startDate" IS NOT NULL;

-- Migrate existing data: if endDate exists, convert to endMonthYear format (MM/YYYY)
UPDATE "Experience" 
SET "endMonthYear" = TO_CHAR("endDate", 'MM/YYYY')
WHERE "endMonthYear" IS NULL AND "endDate" IS NOT NULL;




