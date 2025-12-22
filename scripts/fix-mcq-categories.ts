import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMcqCategories() {
  try {
    console.log('🔧 Fixing MCQ question categories...\n');

    // Get invalid categoryId
    const invalidCategoryId = '12cf39d0-d7be-4b47-8930-db31bcecc099';
    
    // Get a default category
    const defaultCategory = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WallCategory" 
      WHERE "parentCategoryId" IS NULL 
      AND "isActive" = true 
      ORDER BY name ASC 
      LIMIT 1
    `;

    if (defaultCategory.length === 0) {
      console.log('❌ No default category found!');
      return;
    }

    const defaultCategoryId = defaultCategory[0].id;
    console.log(`✅ Using default category: ${defaultCategoryId}`);

    // Fix invalid categoryIds using raw SQL
    const result = await prisma.$executeRaw`
      UPDATE "McqQuestion" 
      SET "categoryId" = ${defaultCategoryId}
      WHERE "categoryId" = ${invalidCategoryId}
    `;

    console.log(`✅ Updated ${result} questions with invalid categoryId`);

    // Verify
    const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "McqQuestion"
    `;
    console.log(`\n✅ Total MCQ questions: ${count[0].count}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixMcqCategories();

