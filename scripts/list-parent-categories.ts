import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listParentCategories() {
  try {
    console.log('📋 All Parent Categories\n');
    console.log('='.repeat(80));

    // Get all parent categories (where parentCategoryId is null)
    const categories = await prisma.wallCategory.findMany({
      where: {
        parentCategoryId: null,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            children: {
              where: {
                isActive: true,
              },
            },
            posts: {
              where: {
                isActive: true,
                postType: 'COLLEGE_FEED',
              },
            },
          },
        },
      },
    });

    console.log(`\nTotal Parent Categories: ${categories.length}\n`);

    categories.forEach((category, index) => {
      const subcategoryCount = category._count.children;
      const postCount = category._count.posts;
      
      console.log(`${(index + 1).toString().padStart(3, ' ')}. ${category.name}`);
      console.log(`     ID: ${category.id}`);
      console.log(`     Subcategories: ${subcategoryCount}`);
      console.log(`     Posts: ${postCount}`);
      if (category.description) {
        const desc = category.description.length > 60 
          ? category.description.substring(0, 60) + '...' 
          : category.description;
        console.log(`     Description: ${desc}`);
      }
      console.log('');
    });

    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total Parent Categories: ${categories.length}`);
    console.log(`   Total Subcategories: ${categories.reduce((sum, cat) => sum + cat._count.children, 0)}`);
    console.log(`   Total Posts: ${categories.reduce((sum, cat) => sum + cat._count.posts, 0)}`);
    console.log('\n');

    // Also create a simple list format
    console.log('📝 Simple List Format:\n');
    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

listParentCategories();

