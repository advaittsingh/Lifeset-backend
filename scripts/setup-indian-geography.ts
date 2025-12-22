import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const indianGeographyStructure = {
  category: 'Indian Geography',
  subcategories: [
    {
      name: 'Physical Geography',
      chapters: [
        { name: "Earth's Structure", order: 1 },
        { name: 'Mountains, Plateaus, Rivers of India', order: 2 },
        { name: 'Soil Types', order: 3 },
        { name: 'Climate & Weather Patterns', order: 4 },
        { name: 'Natural Vegetation', order: 5 },
        { name: 'Mineral Resources', order: 6 },
      ],
    },
    {
      name: 'Human Geography',
      chapters: [
        { name: 'Population & Census Data', order: 1 },
        { name: 'Migration Patterns', order: 2 },
        { name: 'Urbanization', order: 3 },
        { name: 'Agriculture & Cropping Patterns', order: 4 },
        { name: 'Transport & Trade', order: 5 },
      ],
    },
    {
      name: 'Economic Geography',
      chapters: [
        { name: 'Major Industries (Iron-Steel, IT, etc.)', order: 1 },
        { name: 'Energy Resources', order: 2 },
        { name: 'Special Economic Zones (SEZs)', order: 3 },
      ],
    },
  ],
};

async function setupIndianGeography() {
  try {
    console.log('🔍 Setting up Indian Geography hierarchy...\n');

    // Step 1: Find or create the main category
    let category = await prisma.wallCategory.findFirst({
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
      console.log('❌ Indian Geography category not found. Creating...');
      category = await prisma.wallCategory.create({
        data: {
          name: 'Indian Geography',
          description: 'Comprehensive coverage of Indian Geography covering physical, human, and economic aspects',
          isActive: true,
          parentCategoryId: null,
        },
      });
      console.log(`✅ Created category: ${category.name} (ID: ${category.id})\n`);
    } else {
      console.log(`✅ Found category: ${category.name} (ID: ${category.id})\n`);
    }

    // Step 2: Check if Chapter table exists
    let chapterTableExists = false;
    try {
      await (prisma as any).chapter.findFirst();
      chapterTableExists = true;
      console.log('✅ Chapter table exists\n');
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.code === 'P2021') {
        console.log('⚠️  Chapter table does not exist in database. Will create subcategories only.\n');
        chapterTableExists = false;
      } else {
        throw error;
      }
    }

    let totalSubcategoriesCreated = 0;
    let totalSubcategoriesFound = 0;
    let totalChaptersCreated = 0;
    let totalChaptersFound = 0;

    // Step 3: Create subcategories and chapters
    for (const subcatData of indianGeographyStructure.subcategories) {
      // Find or create subcategory
      let subcategory = await prisma.wallCategory.findFirst({
        where: {
          name: {
            contains: subcatData.name,
            mode: 'insensitive',
          },
          parentCategoryId: category.id,
          isActive: true,
        },
      });

      if (!subcategory) {
        subcategory = await prisma.wallCategory.create({
          data: {
            name: subcatData.name,
            description: `Subcategory under ${category.name}`,
            isActive: true,
            parentCategoryId: category.id,
          },
        });
        console.log(`  ✅ Created subcategory: ${subcategory.name} (ID: ${subcategory.id})`);
        totalSubcategoriesCreated++;
      } else {
        console.log(`  ✓ Found subcategory: ${subcategory.name} (ID: ${subcategory.id})`);
        totalSubcategoriesFound++;
      }

      // Create chapters if table exists
      if (chapterTableExists) {
        for (const chapterData of subcatData.chapters) {
          try {
            const existingChapter = await (prisma as any).chapter.findFirst({
              where: {
                name: {
                  contains: chapterData.name,
                  mode: 'insensitive',
                },
                subCategoryId: subcategory.id,
                isActive: true,
              },
            });

            if (!existingChapter) {
              await (prisma as any).chapter.create({
                data: {
                  name: chapterData.name,
                  subCategoryId: subcategory.id,
                  isActive: true,
                  order: chapterData.order,
                },
              });
              console.log(`    ✅ Created chapter: ${chapterData.name}`);
              totalChaptersCreated++;
            } else {
              console.log(`    ✓ Found chapter: ${chapterData.name}`);
              totalChaptersFound++;
            }
          } catch (error: any) {
            console.log(`    ⚠️  Could not create chapter "${chapterData.name}": ${error.message}`);
          }
        }
      } else {
        console.log(`    ⚠️  Skipping chapters (Chapter table doesn't exist)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Category: ${category.name}`);
    console.log(`   Subcategories created: ${totalSubcategoriesCreated}`);
    console.log(`   Subcategories found: ${totalSubcategoriesFound}`);
    if (chapterTableExists) {
      console.log(`   Chapters created: ${totalChaptersCreated}`);
      console.log(`   Chapters found: ${totalChaptersFound}`);
    } else {
      console.log(`   ⚠️  Chapters: Table doesn't exist (need to run migration)`);
    }
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

setupIndianGeography();

