import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const structures = [
  {
    category: 'World Geography',
    subcategories: [
      {
        name: 'Continents & Countries',
        chapters: [
          { name: 'Physical Division of Continents', order: 1 },
          { name: 'Geological Formation of Continents', order: 2 },
          { name: 'Continental Drift Theory', order: 3 },
          { name: 'Plate Tectonics and Continental Movement', order: 4 },
          { name: 'Major Physiographic Features of Each Continent', order: 5 },
        ],
      },
      {
        name: 'Asia',
        chapters: [
          { name: 'Physical Geography of Asia', order: 1 },
          { name: 'Climatic Regions of Asia', order: 2 },
          { name: 'Population & Cultural Regions', order: 3 },
          { name: 'Important Countries and Capitals', order: 4 },
          { name: 'Natural Resources of Asia', order: 5 },
        ],
      },
      {
        name: 'Africa',
        chapters: [
          { name: 'Physiography of Africa', order: 1 },
          { name: 'Climatic Zones of Africa', order: 2 },
          { name: 'Major Rivers and Lakes', order: 3 },
          { name: 'Mineral Resources', order: 4 },
          { name: 'African Countries and Capitals', order: 5 },
        ],
      },
      {
        name: 'Europe',
        chapters: [
          { name: 'Physical Features of Europe', order: 1 },
          { name: 'Climate and Vegetation', order: 2 },
          { name: 'Industrial Regions of Europe', order: 3 },
          { name: 'Political Division and Countries', order: 4 },
          { name: 'Economic Geography of Europe', order: 5 },
        ],
      },
      {
        name: 'North America',
        chapters: [
          { name: 'Physiographic Divisions', order: 1 },
          { name: 'Drainage System', order: 2 },
          { name: 'Climatic Regions', order: 3 },
          { name: 'Major Countries and Capitals', order: 4 },
          { name: 'Economic Resources', order: 5 },
        ],
      },
      {
        name: 'South America',
        chapters: [
          { name: 'Relief Features', order: 1 },
          { name: 'Climate and Natural Vegetation', order: 2 },
          { name: 'River Systems', order: 3 },
          { name: 'Countries and Capitals', order: 4 },
          { name: 'Agriculture and Minerals', order: 5 },
        ],
      },
      {
        name: 'Australia',
        chapters: [
          { name: 'Physiography', order: 1 },
          { name: 'Climate Patterns', order: 2 },
          { name: 'Natural Vegetation', order: 3 },
          { name: 'Economic Resources', order: 4 },
          { name: 'Political Geography', order: 5 },
        ],
      },
      {
        name: 'Antarctica',
        chapters: [
          { name: 'Physical Features', order: 1 },
          { name: 'Climate of Antarctica', order: 2 },
          { name: 'Ice Sheets and Glaciers', order: 3 },
          { name: 'Scientific Research Stations', order: 4 },
          { name: 'Importance of Antarctica', order: 5 },
        ],
      },
      {
        name: 'Major Rivers, Mountains & Deserts',
        chapters: [
          { name: 'River Systems of Asia', order: 1 },
          { name: 'River Systems of Africa', order: 2 },
          { name: 'River Systems of Europe', order: 3 },
          { name: 'River Systems of North America', order: 4 },
          { name: 'River Systems of South America', order: 5 },
        ],
      },
      {
        name: 'Major Mountain Ranges',
        chapters: [
          { name: 'Fold Mountains of the World', order: 1 },
          { name: 'Block Mountains', order: 2 },
          { name: 'Volcanic Mountains', order: 3 },
          { name: 'Himalayan Mountain System', order: 4 },
          { name: 'Andes, Rockies, Alps, Atlas', order: 5 },
        ],
      },
      {
        name: 'Plateaus of the World',
        chapters: [
          { name: 'Types of Plateaus', order: 1 },
          { name: 'Important Plateaus of the World', order: 2 },
          { name: 'Economic Importance of Plateaus', order: 3 },
        ],
      },
      {
        name: 'Deserts of the World',
        chapters: [
          { name: 'Hot Deserts', order: 1 },
          { name: 'Cold Deserts', order: 2 },
          { name: 'Major Deserts (Sahara, Gobi, Kalahari, Atacama, etc.)', order: 3 },
          { name: 'Climate and Vegetation of Deserts', order: 4 },
          { name: 'Human Life in Deserts', order: 5 },
        ],
      },
      {
        name: 'Important Straits & Lakes',
        chapters: [
          { name: 'Meaning and Importance of Straits', order: 1 },
          { name: 'Classification of Straits (Geographical / Regional)', order: 2 },
          { name: 'Strategic Importance of Straits', order: 3 },
        ],
      },
      {
        name: 'Important Lakes of the World',
        chapters: [
          { name: 'Types of Lakes', order: 1 },
          { name: 'Major Lakes by Continent', order: 2 },
          { name: 'Economic and Ecological Importance of Lakes', order: 3 },
        ],
      },
      {
        name: 'World Climate Patterns',
        chapters: [
          { name: 'Basics of Climate', order: 1 },
          { name: 'Climate Classification', order: 2 },
          { name: 'Major Climate Types', order: 3 },
          { name: 'Winds & Pressure Systems', order: 4 },
          { name: 'Ocean Currents', order: 5 },
        ],
      },
      {
        name: 'Geophysical Phenomena',
        chapters: [
          { name: 'Earthquakes (Structure of the Earth, Causes of Earthquakes, Earthquake Zones of the World, etc.)', order: 1 },
          { name: 'Volcanoes (Types of Volcanoes, Volcanic Landforms, Benefits & Hazards, etc.)', order: 2 },
          { name: 'Cyclones (Types of Cyclones, Cyclone-Prone Regions, Formation & Structure, etc.)', order: 3 },
          { name: 'Tsunami (Causes, Tsunami-Prone Areas, Effects & Case Studies, etc.)', order: 4 },
          { name: 'Landslides (Causes, Prevention & Mitigation, Landslide-Prone Regions, etc.)', order: 5 },
        ],
      },
    ],
  },
  {
    category: 'Map Work',
    subcategories: [],
    chapters: [
      { name: 'India and World Map Practice', order: 1 },
      { name: 'Neighbouring Countries, Capitals', order: 2 },
      { name: 'Important Locations in News', order: 3 },
    ],
  },
];

async function setupWorldGeography() {
  try {
    console.log('🔍 Setting up World Geography and Map Work hierarchies...\n');

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
      if (structure.chapters && structure.chapters.length > 0 && (!structure.subcategories || structure.subcategories.length === 0)) {
        // Create a default subcategory
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

setupWorldGeography();

