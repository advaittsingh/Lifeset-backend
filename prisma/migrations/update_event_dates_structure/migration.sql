-- Migration: Update eventDates from String[] to JSONB array of objects
-- This migration converts eventDates from TEXT[] to JSONB to support the new structure:
-- Before: ["01-26", "08-15"]
-- After: [{"date": "01-26", "title": ""}, {"date": "08-15", "title": ""}]

-- Step 1: Add a temporary column to store the new JSONB data
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "eventDates_new" JSONB;

-- Step 2: Migrate existing data from TEXT[] to JSONB array of objects
-- Convert each string in the array to an object with date and empty title
UPDATE "Post"
SET "eventDates_new" = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', elem,
        'title', ''
      )
    ),
    '[]'::jsonb
  )
  FROM unnest("eventDates") AS elem
)
WHERE "eventDates" IS NOT NULL 
  AND array_length("eventDates", 1) IS NOT NULL 
  AND array_length("eventDates", 1) > 0;

-- Step 3: Set empty array for posts with NULL or empty eventDates
UPDATE "Post"
SET "eventDates_new" = '[]'::jsonb
WHERE "eventDates_new" IS NULL;

-- Step 4: Drop the old column
ALTER TABLE "Post" DROP COLUMN IF EXISTS "eventDates";

-- Step 5: Rename the new column to the original name
ALTER TABLE "Post" RENAME COLUMN "eventDates_new" TO "eventDates";

-- Step 6: Set default value for new records
ALTER TABLE "Post" ALTER COLUMN "eventDates" SET DEFAULT '[]'::jsonb;

