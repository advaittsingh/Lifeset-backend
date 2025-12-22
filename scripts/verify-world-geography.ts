import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyWorldGeography() {
  try {
    const categoriesToCheck = ['World Geography', 'Map Work'];

    for (const categoryName of categoriesToCheck) {
      console.log(`\n📚 ${categoryName} Structure Verification`);
      console.log('='.repeat(70));

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
        console.log(`❌ ${categoryName} category not found!`);
        continue;
      }

      console.log(`\n📁 Category: ${category.name} (ID: ${category.id})\n`);

      const subcategories = await prisma.wallCategory.findMany({
        where: {
          parentCategoryId: category.id,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      console.log(`   └─ Subcategories: ${subcategories.length}\n`);

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

        if (chapters.length > 0) {
          console.log(`   📂 ${subcategory.name} (${chapters.length} chapters)`);
          // Show first 3 chapters, then summarize if more
          chapters.slice(0, 3).forEach((chapter: any, index: number) => {
            console.log(`      ${index + 1}. ${chapter.name}`);
          });
          if (chapters.length > 3) {
            console.log(`      ... and ${chapters.length - 3} more chapters`);
          }
        } else {
          console.log(`   📂 ${subcategory.name} (no chapters)`);
        }
        console.log('');
      }

      console.log('='.repeat(70));
      console.log(`\n📊 Summary for ${categoryName}:`);
      console.log(`   Category: 1`);
      console.log(`   Subcategories: ${subcategories.length}`);
      console.log(`   Chapters: ${totalChapters}`);
      console.log('\n');
    }

    console.log('✅ Verification complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyWorldGeography();

