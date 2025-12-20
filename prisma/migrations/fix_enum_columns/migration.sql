-- Migration: Fix enum column types
-- This migration fixes the jobType and language columns to use enum types
-- after the create_enums migration partially applied

-- Fix Post.jobType column to use JobType enum
DO $$ 
DECLARE
    col_data_type text;
BEGIN
    -- Get the current column data type
    SELECT data_type INTO col_data_type
    FROM information_schema.columns 
        WHERE table_name = 'Post' 
    AND column_name = 'jobType';
    
    -- Only proceed if column exists and is TEXT (not already enum)
    IF col_data_type = 'text' THEN
        -- First, ensure all values are valid enum values or NULL
        UPDATE "Post" 
        SET "jobType" = NULL 
        WHERE "jobType" IS NOT NULL 
        AND "jobType" NOT IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');
        
        -- Now alter the column type - use simple text to enum cast
        ALTER TABLE "Post" ALTER COLUMN "jobType" TYPE "JobType" 
        USING NULLIF("jobType", '')::"JobType";
        
        -- Handle NULL values explicitly
        ALTER TABLE "Post" ALTER COLUMN "jobType" DROP NOT NULL;
    END IF;
END $$;

-- Fix Post.language column to use Language enum
DO $$ 
DECLARE
    col_data_type text;
BEGIN
    -- Get the current column data type
    SELECT data_type INTO col_data_type
    FROM information_schema.columns 
        WHERE table_name = 'Post' 
    AND column_name = 'language';
    
    -- Only proceed if column exists and is TEXT (not already enum)
    IF col_data_type = 'text' THEN
        -- First, ensure all values are valid enum values or NULL
        UPDATE "Post" 
        SET "language" = NULL 
        WHERE "language" IS NOT NULL 
        AND "language" NOT IN ('ENGLISH', 'HINDI');
        
        -- Now alter the column type - use simple text to enum cast
        ALTER TABLE "Post" ALTER COLUMN "language" TYPE "Language" 
        USING NULLIF("language", '')::"Language";
        
        -- Handle NULL values explicitly
        ALTER TABLE "Post" ALTER COLUMN "language" DROP NOT NULL;
    END IF;
END $$;
