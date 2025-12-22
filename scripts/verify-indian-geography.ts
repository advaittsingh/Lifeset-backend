import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyIndianGeography() {
  try {
    console.log('📚 Indian Geography Structure Verification\n');
    console.log('='.repeat(70));

    // Find Indian Geography category
    const category = await prisma.wallCategory.findFirst({
      where: {
        name: {
          contains: 'Indian Geography',
          mode: 'insensitive',
        },
        parentCategoryId: null,
        isActive: true,
      },
    });

    if (!category) {
      console.log('❌ Indian Geography category not found!');
      return;
    }

    console.log(`\n📁 Category: ${category.name} (ID: ${category.id})\n`);

    // Get subcategories
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

      console.log(`   📂 ${subcategory.name} (${chapters.length} chapters)`);
      chapters.forEach((chapter: any, index: number) => {
        console.log(`      ${index + 1}. ${chapter.name}`);
      });
      console.log('');
    }

    console.log('='.repeat(70));
    console.log(`\n📊 Total Summary:`);
    console.log(`   Category: 1`);
    console.log(`   Subcategories: ${subcategories.length}`);
    console.log(`   Chapters: ${totalChapters}`);
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

verifyIndianGeography();

