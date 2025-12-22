import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const structures = [
  {
    category: 'General Science',
    subcategories: [
      {
        name: 'Physics',
        chapters: [
          { name: 'Electricity & Magnetism', order: 1 },
          { name: 'Optics', order: 2 },
          { name: 'Motion & Laws', order: 3 },
        ],
      },
      {
        name: 'Chemistry',
        chapters: [
          { name: 'Matter & Its Properties', order: 1 },
          { name: 'Periodic Table', order: 2 },
          { name: 'Acids, Bases, Salts', order: 3 },
        ],
      },
      {
        name: 'Biology',
        chapters: [
          { name: 'Human Anatomy', order: 1 },
          { name: 'Diseases & Vaccination', order: 2 },
          { name: 'Genetics & Biotechnology', order: 3 },
          { name: 'Ecology & Environment', order: 4 },
        ],
      },
    ],
  },
  {
    category: 'Environment & Ecology',
    subcategories: [], // No subcategories, chapters go directly under category
    chapters: [
      { name: 'Ecosystem, Biodiversity', order: 1 },
      { name: 'Climate Change', order: 2 },
      { name: 'Conservation Efforts (National Parks, Wildlife Sanctuaries)', order: 3 },
      { name: 'Environmental Laws & Treaties (Paris Agreement, COPs)', order: 4 },
    ],
  },
  {
    category: 'Science & Technology',
    subcategories: [], // No subcategories, chapters go directly under category
    chapters: [
      { name: 'Space Technology (ISRO Missions)', order: 1 },
      { name: 'Defence Technology', order: 2 },
      { name: 'Robotics & Nanotechnology', order: 3 },
      { name: 'Artificial Intelligence', order: 4 },
      { name: 'Biotechnology', order: 5 },
      { name: 'Internet & Cybersecurity', order: 6 },
    ],
  },
  {
    category: 'Current Affairs',
    subcategories: [], // No subcategories, chapters go directly under category
    chapters: [
      { name: 'National & International News', order: 1 },
      { name: 'Government Schemes', order: 2 },
      { name: 'Committees & Reports', order: 3 },
      { name: 'Awards & Honours', order: 4 },
      { name: 'Sports Events', order: 5 },
      { name: 'Important Days & Themes', order: 6 },
    ],
  },
  {
    category: 'Indian Art & Culture',
    subcategories: [
      {
        name: 'Indian Culture',
        chapters: [
          { name: 'Architecture (Temples, Stupas, Forts)', order: 1 },
          { name: 'Indian Paintings and Sculpture', order: 2 },
          { name: 'Indian Music and Dance Forms', order: 3 },
          { name: 'Fairs and Festivals of India', order: 4 },
        ],
      },
      {
        name: 'Religion and Philosophy',
        chapters: [
          { name: 'Hinduism, Jainism, Buddhism, Islam, Sikhism', order: 1 },
          { name: 'Cultural Institutions (Sangeet Natak Akademi, ASI)', order: 2 },
        ],
      },
    ],
  },
  {
    category: 'International Relations',
    subcategories: [], // No subcategories, chapters go directly under category
    chapters: [
      { name: "India's Relations with Neighbours", order: 1 },
      { name: 'Important International Organizations (UN, WHO, IMF, World Bank, WTO)', order: 2 },
      { name: 'Treaties & Summits (BRICS, SCO, G20)', order: 3 },
    ],
  },
];

async function setupRemainingCategories() {
  try {
    console.log('🔍 Setting up remaining category hierarchies...\n');

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

    let totalCategoriesCreated = 0;
    let totalCategoriesFound = 0;
    let totalSubcategoriesCreated = 0;
    let totalSubcategoriesFound = 0;
    let totalChaptersCreated = 0;
    let totalChaptersFound = 0;

    for (const structure of structures) {
      console.log(`\n📁 Processing: ${structure.category}`);
      console.log('='.repeat(60));

      // Step 1: Find or create the main category
      let category = await prisma.wallCategory.findFirst({
        where: {
          name: {
            contains: structure.category,
            mode: 'insensitive',
          },
          parentCategoryId: null,
          isActive: true,
        },
      });

      if (!category) {
        console.log(`   ❌ ${structure.category} category not found. Creating...`);
        category = await prisma.wallCategory.create({
          data: {
            name: structure.category,
            description: `Comprehensive coverage of ${structure.category}`,
            isActive: true,
            parentCategoryId: null,
          },
        });
        console.log(`   ✅ Created category: ${category.name} (ID: ${category.id})`);
        totalCategoriesCreated++;
      } else {
        console.log(`   ✅ Found category: ${category.name} (ID: ${category.id})`);
        totalCategoriesFound++;
      }

      // Step 2: Handle categories with subcategories
      if (structure.subcategories && structure.subcategories.length > 0) {
        for (const subcatData of structure.subcategories) {
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
            console.log(`     ✅ Created subcategory: ${subcategory.name}`);
            totalSubcategoriesCreated++;
          } else {
            console.log(`     ✓ Found subcategory: ${subcategory.name}`);
            totalSubcategoriesFound++;
          }

          // Create chapters if table exists
          if (chapterTableExists && subcatData.chapters) {
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
                  console.log(`       ✅ Created chapter: ${chapterData.name}`);
                  totalChaptersCreated++;
                } else {
                  console.log(`       ✓ Found chapter: ${chapterData.name}`);
                  totalChaptersFound++;
                }
              } catch (error: any) {
                console.log(`       ⚠️  Could not create chapter "${chapterData.name}": ${error.message}`);
              }
            }
          }
        }
      }

      // Step 3: Handle categories without subcategories (chapters go directly under category)
      // Note: Since our schema requires chapters to have a subCategoryId, we'll create a default subcategory
      if (structure.chapters && structure.chapters.length > 0 && (!structure.subcategories || structure.subcategories.length === 0)) {
        // Create a default subcategory with the same name as category (or "General")
        const defaultSubcategoryName = `${structure.category} - General`;
        let defaultSubcategory = await prisma.wallCategory.findFirst({
          where: {
            name: {
              contains: defaultSubcategoryName,
              mode: 'insensitive',
            },
            parentCategoryId: category.id,
            isActive: true,
          },
        });

        if (!defaultSubcategory) {
          defaultSubcategory = await prisma.wallCategory.create({
            data: {
              name: defaultSubcategoryName,
              description: `Default subcategory for ${category.name}`,
              isActive: true,
              parentCategoryId: category.id,
            },
          });
          console.log(`     ✅ Created default subcategory: ${defaultSubcategory.name}`);
          totalSubcategoriesCreated++;
        } else {
          console.log(`     ✓ Found default subcategory: ${defaultSubcategory.name}`);
          totalSubcategoriesFound++;
        }

        // Create chapters under the default subcategory
        if (chapterTableExists) {
          for (const chapterData of structure.chapters) {
            try {
              const existingChapter = await (prisma as any).chapter.findFirst({
                where: {
                  name: {
                    contains: chapterData.name,
                    mode: 'insensitive',
                  },
                  subCategoryId: defaultSubcategory.id,
                  isActive: true,
                },
              });

              if (!existingChapter) {
                await (prisma as any).chapter.create({
                  data: {
                    name: chapterData.name,
                    subCategoryId: defaultSubcategory.id,
                    isActive: true,
                    order: chapterData.order,
                  },
                });
                console.log(`       ✅ Created chapter: ${chapterData.name}`);
                totalChaptersCreated++;
              } else {
                console.log(`       ✓ Found chapter: ${chapterData.name}`);
                totalChaptersFound++;
              }
            } catch (error: any) {
              console.log(`       ⚠️  Could not create chapter "${chapterData.name}": ${error.message}`);
            }
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Overall Summary:');
    console.log(`   Categories created: ${totalCategoriesCreated}`);
    console.log(`   Categories found: ${totalCategoriesFound}`);
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

setupRemainingCategories();

