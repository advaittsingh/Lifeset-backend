-- Migration: Add articleId to MCQ questions and update metadata support
-- This migration adds support for linking MCQ questions to General Knowledge/Current Affairs articles

-- Add articleId column to mcq_questions table
ALTER TABLE "McqQuestion" 
ADD COLUMN IF NOT EXISTS "articleId" TEXT;

-- Add metadata column to mcq_questions table if it doesn't exist
ALTER TABLE "McqQuestion" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Add index for articleId for faster lookups
CREATE INDEX IF NOT EXISTS "idx_mcq_questions_article_id" 
ON "McqQuestion"("articleId") 
WHERE "articleId" IS NOT NULL;

-- Add indexes for posts metadata queries (date, location, job filtering)
CREATE INDEX IF NOT EXISTS "idx_posts_metadata_date" 
ON "Post"((metadata->>'date')) 
WHERE metadata->>'date' IS NOT NULL;

-- Add GIN index for location queries
CREATE INDEX IF NOT EXISTS "idx_posts_metadata_location" 
ON "Post" USING GIN ((metadata->'location')) 
WHERE metadata->'location' IS NOT NULL;

-- Add indexes for job filtering
CREATE INDEX IF NOT EXISTS "idx_posts_metadata_job_type" 
ON "Post"((metadata->>'jobType')) 
WHERE "postType" = 'JOB' AND metadata->>'jobType' IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_posts_metadata_is_public" 
ON "Post"((metadata->>'isPublic')) 
WHERE "postType" = 'JOB' AND metadata->>'isPublic' IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_posts_metadata_is_private" 
ON "Post"((metadata->>'isPrivate')) 
WHERE "postType" = 'JOB' AND metadata->>'isPrivate' IS NOT NULL;

-- Add GIN index for private filters
CREATE INDEX IF NOT EXISTS "idx_posts_metadata_private_filters" 
ON "Post" USING GIN ((metadata->'privateFilters')) 
WHERE "postType" = 'JOB' AND (metadata->>'isPrivate')::boolean = true;


