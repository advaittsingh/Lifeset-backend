import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupEmptyCategories() {
  try {
    console.log('🧹 Cleaning up empty parent categories...\n');
    console.log('='.repeat(80));

    // Get all parent categories
    const allCategories = await prisma.wallCategory.findMany({
      where: {
        parentCategoryId: null,
        isActive: true,
      },
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

    console.log(`\nTotal parent categories found: ${allCategories.length}\n`);

    // Find categories to keep (have posts OR subcategories)
    const categoriesToKeep = allCategories.filter(
      (cat) => cat._count.children > 0 || cat._count.posts > 0
    );

    // Find categories to delete (no posts AND no subcategories)
    const categoriesToDelete = allCategories.filter(
      (cat) => cat._count.children === 0 && cat._count.posts === 0
    );

    console.log('📊 Analysis:\n');
    console.log(`   Categories to KEEP (have posts or subcategories): ${categoriesToKeep.length}`);
    categoriesToKeep.forEach((cat) => {
      console.log(`     ✓ ${cat.name} (${cat._count.children} subcategories, ${cat._count.posts} posts)`);
    });

    console.log(`\n   Categories to DELETE (no posts and no subcategories): ${categoriesToDelete.length}`);
    categoriesToDelete.forEach((cat) => {
      console.log(`     ✗ ${cat.name} (${cat._count.children} subcategories, ${cat._count.posts} posts)`);
    });

    if (categoriesToDelete.length === 0) {
      console.log('\n✅ No empty categories to delete!\n');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  WARNING: This will permanently delete the following categories:');
    categoriesToDelete.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.name} (ID: ${cat.id})`);
    });

    console.log('\n🗑️  Starting deletion...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const category of categoriesToDelete) {
      try {
        // First, check if there are any inactive subcategories or posts
        const inactiveChildren = await prisma.wallCategory.count({
          where: {
            parentCategoryId: category.id,
            isActive: false,
          },
        });

        const inactivePosts = await prisma.post.count({
          where: {
            categoryId: category.id,
            isActive: false,
          },
        });

        if (inactiveChildren > 0 || inactivePosts > 0) {
          console.log(`   ⚠️  Skipping ${category.name} - has ${inactiveChildren} inactive subcategories or ${inactivePosts} inactive posts`);
          continue;
        }

        // Delete the category (cascade will handle children if any)
        await prisma.wallCategory.delete({
          where: { id: category.id },
        });

        console.log(`   ✅ Deleted: ${category.name}`);
        deletedCount++;
      } catch (error: any) {
        console.log(`   ❌ Error deleting ${category.name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Deletion Summary:');
    console.log(`   Categories deleted: ${deletedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Categories remaining: ${categoriesToKeep.length}`);
    console.log('\n✅ Cleanup complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

cleanupEmptyCategories();

