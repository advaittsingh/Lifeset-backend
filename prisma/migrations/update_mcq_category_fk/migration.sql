-- Update McqQuestion to reference WallCategory instead of McqCategory
-- First, drop any existing foreign key constraint (if it exists)
DO $$
BEGIN
  -- Drop the old foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'McqQuestion_categoryId_fkey' 
    AND table_name = 'McqQuestion'
  ) THEN
    ALTER TABLE "McqQuestion" DROP CONSTRAINT "McqQuestion_categoryId_fkey";
  END IF;
END $$;

-- Add new foreign key constraint to WallCategory
ALTER TABLE "McqQuestion" 
ADD CONSTRAINT "McqQuestion_categoryId_fkey" 
FOREIGN KEY ("categoryId") 
REFERENCES "WallCategory"("id") 
ON DELETE CASCADE;

-- Add index if it doesn't exist
CREATE INDEX IF NOT EXISTS "McqQuestion_categoryId_idx" ON "McqQuestion"("categoryId");

