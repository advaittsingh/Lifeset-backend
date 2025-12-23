/**
 * Utility script to identify and fix wall categories with incorrect parentCategoryId
 * 
 * This script helps identify categories that should be sub-categories but have parentCategoryId = null
 * 
 * Usage:
 *   npx ts-node scripts/fix-wall-categories.ts
 * 
 * To actually fix data (uncomment the update section):
 *   npx ts-node scripts/fix-wall-categories.ts --fix
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shouldFix = process.argv.includes('--fix');

  console.log('🔍 Checking wall categories...\n');

  // Get all categories
  const allCategories = await prisma.wallCategory.findMany({
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${allCategories.length} total categories\n`);

  // Find parent categories (parentCategoryId IS NULL)
  const parentCategories = allCategories.filter(
    (cat) => !cat.parentCategoryId || cat.parentCategoryId === null
  );

  // Find sub-categories (parentCategoryId IS NOT NULL)
  const subCategories = allCategories.filter(
    (cat) => cat.parentCategoryId && cat.parentCategoryId !== null
  );

  console.log(`📊 Statistics:`);
  console.log(`  - Parent categories: ${parentCategories.length}`);
  console.log(`  - Sub-categories: ${subCategories.length}\n`);

  // List all parent categories
  console.log(`📁 Parent Categories (parentCategoryId = null):`);
  parentCategories.forEach((cat) => {
    console.log(`  - ${cat.name} (ID: ${cat.id})`);
  });

  console.log(`\n📂 Sub-categories:`);
  subCategories.forEach((cat) => {
    const parent = parentCategories.find((p) => p.id === cat.parentCategoryId);
    console.log(
      `  - ${cat.name} (ID: ${cat.id}) → Parent: ${parent?.name || 'NOT FOUND'} (${cat.parentCategoryId})`
    );
  });

  // Check for orphaned sub-categories (parent doesn't exist)
  const orphaned = subCategories.filter(
    (sub) => !parentCategories.find((p) => p.id === sub.parentCategoryId)
  );

  if (orphaned.length > 0) {
    console.log(`\n⚠️  Found ${orphaned.length} orphaned sub-categories (parent doesn't exist):`);
    orphaned.forEach((cat) => {
      console.log(`  - ${cat.name} (ID: ${cat.id}) → Parent ID: ${cat.parentCategoryId} (NOT FOUND)`);
    });

    if (shouldFix) {
      console.log(`\n🔧 Fixing orphaned categories by setting parentCategoryId to null...`);
      for (const cat of orphaned) {
        await prisma.wallCategory.update({
          where: { id: cat.id },
          data: { parentCategoryId: null },
        });
        console.log(`  ✓ Fixed: ${cat.name}`);
      }
    } else {
      console.log(`\n💡 Run with --fix flag to automatically fix orphaned categories`);
    }
  }

  // Check for potential mis-categorized items (categories that look like sub-categories but are parents)
  console.log(`\n💡 Note: If you see categories that should be sub-categories but appear as parents,`);
  console.log(`   you'll need to manually update their parentCategoryId using:`);
  console.log(`   PUT /admin/wall-categories/:id with parentCategoryId set to the parent's ID\n`);

  console.log(`✅ Analysis complete!\n`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










