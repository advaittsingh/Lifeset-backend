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
        ALTER TABLE "Post" ALTER COLUMN "jobType" TYPE "JobType" USING "jobType"::"JobType";
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
        ALTER TABLE "Post" ALTER COLUMN "language" TYPE "Language" USING "language"::"Language";
    END IF;
END $$;

