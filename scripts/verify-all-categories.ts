import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyAllCategories() {
  try {
    const categoriesToCheck = [
      'General Science',
      'Environment & Ecology',
      'Science & Technology',
      'Current Affairs',
      'Indian Art & Culture',
      'International Relations',
    ];

    console.log('📚 Complete Category Structure Verification\n');
    console.log('='.repeat(70));

    for (const categoryName of categoriesToCheck) {
      const category = await prisma.wallCategory.findFirst({
        where: {
          name: {
            contains: categoryName,
            mode: 'insensitive',
          },
          parentCategoryId: null,
          isActive: true,
        },
      });

      if (!category) {
        console.log(`\n❌ ${categoryName} category not found!`);
        continue;
      }

      console.log(`\n📁 ${category.name}`);
      console.log('-'.repeat(70));

      const subcategories = await prisma.wallCategory.findMany({
        where: {
          parentCategoryId: category.id,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      let totalChapters = 0;

      for (const subcategory of subcategories) {
        const chapters = await (prisma as any).chapter.findMany({
          where: {
            subCategoryId: subcategory.id,
            isActive: true,
          },
          orderBy: [
            { order: 'asc' },
            { name: 'asc' },
          ],
        });

        totalChapters += chapters.length;

        console.log(`\n  📂 ${subcategory.name} (${chapters.length} chapters)`);
        chapters.forEach((chapter: any, index: number) => {
          console.log(`     ${index + 1}. ${chapter.name}`);
        });
      }

      console.log(`\n  Total: ${subcategories.length} subcategories, ${totalChapters} chapters`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Verification complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllCategories();

