import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategoryStats() {
  try {
    console.log('📊 Category Statistics\n');
    console.log('=' .repeat(60));

    // Get all top-level categories
    const categories = await prisma.wallCategory.findMany({
      where: {
        parentCategoryId: null,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    console.log(`\n✅ Total Categories: ${categories.length}\n`);

    let totalSubcategories = 0;
    let totalChapters = 0;

    for (const category of categories) {
      // Get subcategories for this category
      const subcategories = await prisma.wallCategory.findMany({
        where: {
          parentCategoryId: category.id,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      totalSubcategories += subcategories.length;

      console.log(`\n📁 Category: ${category.name} (ID: ${category.id})`);
      console.log(`   └─ Subcategories: ${subcategories.length}`);

      // Check if Chapter table exists by trying to query it
      let chapterCount = 0;
      try {
        const chapters = await (prisma as any).chapter.findMany({
          where: {
            subCategoryId: { in: subcategories.map(s => s.id) },
            isActive: true,
          },
        });
        chapterCount = chapters.length;
        totalChapters += chapterCount;
      } catch (error: any) {
        if (error.message?.includes('does not exist') || error.code === 'P2021') {
          console.log(`   ⚠️  Chapter table does not exist in database`);
          chapterCount = 0;
        } else {
          throw error;
        }
      }

      // Show subcategory details
      for (const subcategory of subcategories) {
        let subChapterCount = 0;
        try {
          const subChapters = await (prisma as any).chapter.findMany({
            where: {
              subCategoryId: subcategory.id,
              isActive: true,
            },
          });
          subChapterCount = subChapters.length;
        } catch (error: any) {
          // Chapter table doesn't exist, skip
        }

        console.log(`      ├─ ${subcategory.name} (ID: ${subcategory.id})`);
        if (subChapterCount > 0) {
          console.log(`      │  └─ Chapters: ${subChapterCount}`);
        }
      }

      if (chapterCount > 0) {
        console.log(`   └─ Total Chapters: ${chapterCount}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📈 Summary:`);
    console.log(`   Total Categories: ${categories.length}`);
    console.log(`   Total Subcategories: ${totalSubcategories}`);
    console.log(`   Total Chapters: ${totalChapters}`);
    console.log('\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkCategoryStats();

