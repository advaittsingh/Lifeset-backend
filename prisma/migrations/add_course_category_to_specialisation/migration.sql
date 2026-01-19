-- Add courseCategoryId to Specialisation model and make awardedId optional
-- Step 1: Add courseCategoryId column (nullable initially)
ALTER TABLE "Specialisation" 
ADD COLUMN IF NOT EXISTS "courseCategoryId" TEXT;

-- Step 2: Populate courseCategoryId from awarded.courseCategoryId for existing records
UPDATE "Specialisation" s
SET "courseCategoryId" = a."courseCategoryId"
FROM "Awarded" a
WHERE s."awardedId" = a.id AND s."courseCategoryId" IS NULL;

-- Step 3: Make courseCategoryId NOT NULL (after populating existing data)
-- Note: This will fail if there are any NULL values, so we ensure all are populated above
ALTER TABLE "Specialisation" 
ALTER COLUMN "courseCategoryId" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "Specialisation" 
ADD CONSTRAINT "Specialisation_courseCategoryId_fkey" 
FOREIGN KEY ("courseCategoryId") 
REFERENCES "CourseCategory"("id") 
ON DELETE CASCADE;

-- Step 5: Add index for courseCategoryId
CREATE INDEX IF NOT EXISTS "Specialisation_courseCategoryId_idx" 
ON "Specialisation"("courseCategoryId");

-- Step 6: Make awardedId nullable (after ensuring courseCategoryId is set)
ALTER TABLE "Specialisation" 
ALTER COLUMN "awardedId" DROP NOT NULL;
