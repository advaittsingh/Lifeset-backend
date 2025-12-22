import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generalKnowledgeStructure = {
  category: 'General Knowledge / Static GK',
  subcategories: [
    {
      name: 'Indian States & Capitals',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'National Symbols',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'Important Days',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'World Heritage Sites',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'Dams, Rivers, Power Plants',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'Awards (Bharat Ratna, Nobel, etc.)',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'Books & Authors',
      chapters: [], // No chapters, just a subcategory
    },
    {
      name: 'Famous Personalities',
      chapters: [
        { name: 'Freedom Fighter', order: 1 },
        { name: 'Politician', order: 2 },
        { name: 'Scientist', order: 3 },
        { name: 'Industrialists & Entrepreneurs', order: 4 },
        { name: 'Social Reformers & Religious Leaders', order: 5 },
        { name: 'Writers, Poets & Thinkers', order: 6 },
        { name: 'Artists, Musicians & Dancers', order: 7 },
        { name: 'Sportspersons', order: 8 },
        { name: 'Judges & Legal Luminaries', order: 9 },
        { name: 'Internationally Renowned Indians', order: 10 },
      ],
    },
    {
      name: 'Param Veer Chakra',
      chapters: [], // No chapters, just a subcategory
    },
  ],
};

async function setupGeneralKnowledge() {
  try {
    console.log('🔍 Setting up General Knowledge / Static GK hierarchy...\n');

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

    // Step 1: Find or create the main category
    let category = await prisma.wallCategory.findFirst({
      where: {
        name: {
          contains: 'General Knowledge',
          mode: 'insensitive',
        },
        parentCategoryId: null,
        isActive: true,
      },
    });

    if (!category) {
      console.log('❌ General Knowledge / Static GK category not found. Creating...');
      category = await prisma.wallCategory.create({
        data: {
          name: 'General Knowledge / Static GK',
          description: 'Comprehensive General Knowledge and Static GK topics',
          isActive: true,
          parentCategoryId: null,
        },
      });
      console.log(`✅ Created category: ${category.name} (ID: ${category.id})\n`);
    } else {
      console.log(`✅ Found category: ${category.name} (ID: ${category.id})\n`);
    }

    let totalSubcategoriesCreated = 0;
    let totalSubcategoriesFound = 0;
    let totalChaptersCreated = 0;
    let totalChaptersFound = 0;

    // Step 2: Create subcategories and chapters
    for (const subcatData of generalKnowledgeStructure.subcategories) {
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

      // Create chapters if they exist and table exists
      if (chapterTableExists && subcatData.chapters && subcatData.chapters.length > 0) {
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

setupGeneralKnowledge();

