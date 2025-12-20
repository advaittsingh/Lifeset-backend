-- Fix foreign key constraint violations in McqQuestion
-- Set invalid categoryIds to NULL
UPDATE "McqQuestion"
SET "categoryId" = NULL
WHERE "categoryId" IS NOT NULL
  AND "categoryId" NOT IN (SELECT id FROM "WallCategory");

