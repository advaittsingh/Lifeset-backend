-- Migration: Create enum types for JobType and Language
-- This migration creates the enum types that are referenced in the Prisma schema

-- Create JobType enum
DO $$ BEGIN
    CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Language enum
DO $$ BEGIN
    CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HINDI');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update Post.jobType column to use JobType enum (if column exists and is TEXT)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Post' 
        AND column_name = 'jobType' 
        AND data_type = 'text'
    ) THEN
        -- First, ensure all values are valid enum values or NULL
        UPDATE "Post" 
        SET "jobType" = NULL 
        WHERE "jobType" IS NOT NULL 
        AND "jobType" NOT IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');
        
        -- Now alter the column type with proper casting (text -> enum)
        ALTER TABLE "Post" ALTER COLUMN "jobType" TYPE "JobType" 
        USING CASE 
            WHEN "jobType" = 'FULL_TIME' THEN 'FULL_TIME'::"JobType"
            WHEN "jobType" = 'PART_TIME' THEN 'PART_TIME'::"JobType"
            WHEN "jobType" = 'CONTRACT' THEN 'CONTRACT'::"JobType"
            WHEN "jobType" = 'INTERNSHIP' THEN 'INTERNSHIP'::"JobType"
            WHEN "jobType" = 'FREELANCE' THEN 'FREELANCE'::"JobType"
            ELSE NULL::"JobType"
        END;
    END IF;
END $$;

-- Update Post.language column to use Language enum (if column exists and is TEXT)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Post' 
        AND column_name = 'language' 
        AND data_type = 'text'
    ) THEN
        -- First, ensure all values are valid enum values or NULL
        UPDATE "Post" 
        SET "language" = NULL 
        WHERE "language" IS NOT NULL 
        AND "language" NOT IN ('ENGLISH', 'HINDI');
        
        -- Now alter the column type with proper casting (text -> enum)
        ALTER TABLE "Post" ALTER COLUMN "language" TYPE "Language" 
        USING CASE 
            WHEN "language" = 'ENGLISH' THEN 'ENGLISH'::"Language"
            WHEN "language" = 'HINDI' THEN 'HINDI'::"Language"
            ELSE NULL::"Language"
        END;
    END IF;
END $$;




