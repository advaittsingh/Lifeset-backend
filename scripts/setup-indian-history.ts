import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ChapterData {
  name: string;
  order: number;
}

interface SubcategoryData {
  name: string;
  chapters: ChapterData[];
}

const indianHistoryStructure = {
  category: 'Indian History',
  subcategories: [
    {
      name: 'Ancient History',
      chapters: [
        { name: 'Indus Valley Civilization', order: 1 },
        { name: 'Vedic Age', order: 2 },
        { name: 'Mahajanapadas', order: 3 },
        { name: 'Mauryan Empire', order: 4 },
        { name: 'Post-Maurian India (Sunga, Kushana, Gupta)', order: 5 },
        { name: 'South Indian Dynasties (Sangam Age, Cholas, Cheras, Pandyas)', order: 6 },
        { name: 'Religious Movements: Buddhism, Jainism', order: 7 },
        { name: 'Art, Culture, and Architecture', order: 8 },
      ],
    },
    {
      name: 'Medieval History',
      chapters: [
        { name: 'Delhi Sultanate', order: 1 },
        { name: 'Mughal Empire', order: 2 },
        { name: 'Regional Kingdoms', order: 3 },
        { name: 'Bhakti and Sufi Movements', order: 4 },
        { name: 'Marathas and Sikh Empire', order: 5 },
        { name: 'Architecture, Literature, and Cultural Developments', order: 6 },
      ],
    },
    {
      name: 'Modern History',
      chapters: [
        { name: 'Arrival of Europeans in India', order: 1 },
        { name: 'British Expansion & Administration', order: 2 },
        { name: 'Revolt of 1857', order: 3 },
        { name: 'Social Reform Movements', order: 4 },
        { name: 'Freedom Struggle (1885-1947)', order: 5 },
        { name: 'Gandhian Movements', order: 6 },
        { name: 'Partition & Independence', order: 7 },
        { name: 'Freedom Fighters and Their Contributions', order: 8 },
        { name: 'India Post-Independence', order: 9 },
      ],
    },
  ],
};

async function setupIndianHistory() {
  try {
    console.log('🔍 Setting up Indian History hierarchy...\n');

    // Step 1: Find or create the main category
    let category = await prisma.wallCategory.findFirst({
      where: {
        name: {
          contains: 'Indian History',
          mode: 'insensitive',
        },
        parentCategoryId: null,
        isActive: true,
      },
    });

    if (!category) {
      console.log('❌ Indian History category not found. Creating...');
      category = await prisma.wallCategory.create({
        data: {
          name: 'Indian History',
          description: 'Comprehensive coverage of Indian History from ancient to modern times',
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
    for (const subcatData of indianHistoryStructure.subcategories) {
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

setupIndianHistory();

