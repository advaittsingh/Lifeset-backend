import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const structures = [
  {
    category: 'Polity & Governance',
    subcategories: [
      {
        name: 'Indian Constitution',
        chapters: [
          { name: 'Making of the Constitution', order: 1 },
          { name: 'Preamble', order: 2 },
          { name: 'Fundamental Rights & Duties', order: 3 },
          { name: 'Directive Principles of State Policy (DPSP)', order: 4 },
          { name: 'Amendment of the Constitution', order: 5 },
          { name: 'Basic Structure Doctrine', order: 6 },
          { name: 'Union Government', order: 7 },
          { name: 'State Government', order: 8 },
          { name: 'Local Government', order: 9 },
          { name: 'Union Territories & Special Areas', order: 10 },
          { name: 'Constitutional Bodies', order: 11 },
          { name: 'Non-Constitutional Bodies', order: 12 },
          { name: 'Emergency Provisions', order: 13 },
          { name: 'Centre-State Relations', order: 14 },
          { name: 'Special Provisions for States', order: 15 },
          { name: 'Tribunals', order: 16 },
          { name: 'Official Language', order: 17 },
          { name: 'Elections', order: 18 },
          { name: 'Rights & Liabilities', order: 19 },
          { name: 'Current Affairs Linkage', order: 20 },
        ],
      },
      {
        name: 'Indian Political System',
        chapters: [
          { name: 'President, PM, Parliament', order: 1 },
          { name: 'Judiciary (Supreme Court, High Courts)', order: 2 },
          { name: 'Federalism', order: 3 },
          { name: 'Elections, Political Parties', order: 4 },
        ],
      },
      {
        name: 'Governance',
        chapters: [
          { name: 'Policies & Schemes', order: 1 },
          { name: 'Rights Issues (RTI, RTE)', order: 2 },
          { name: 'Panchayati Raj', order: 3 },
        ],
      },
    ],
  },
  {
    category: 'Indian Economy',
    subcategories: [
      {
        name: 'Basic Concepts',
        chapters: [
          { name: 'GDP, GNP, Inflation, Deflation', order: 1 },
          { name: 'Fiscal and Monetary Policy', order: 2 },
          { name: 'NPAs, GST, Budget and Economic Survey', order: 3 },
          { name: 'RBI and Financial Institutions', order: 4 },
        ],
      },
      {
        name: 'Sectors of Economy',
        chapters: [
          { name: 'Agriculture and Allied Sectors', order: 1 },
          { name: 'Industry and Infrastructure', order: 2 },
          { name: 'Services Sector', order: 3 },
        ],
      },
      {
        name: 'Government Schemes & Reforms',
        chapters: [
          { name: 'Poverty Alleviation Programs', order: 1 },
          { name: 'Rural Development Schemes', order: 2 },
          { name: 'Start-up India, Make in India, Skill India', order: 3 },
        ],
      },
      {
        name: 'External Sector',
        chapters: [
          { name: 'Balance of Payment', order: 1 },
          { name: 'Foreign Trade', order: 2 },
          { name: 'FDI & WTO', order: 3 },
        ],
      },
    ],
  },
];

async function setupPolityAndEconomy() {
  try {
    console.log('🔍 Setting up Polity & Governance and Indian Economy hierarchies...\n');

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

      // Step 2: Create subcategories and chapters
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
        } else {
          console.log(`       ⚠️  Skipping chapters (Chapter table doesn't exist)`);
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

setupPolityAndEconomy();

