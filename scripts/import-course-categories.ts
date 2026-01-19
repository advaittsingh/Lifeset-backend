import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface ExcelRow {
  'Course Category'?: string;
  'Course category'?: string;
  'course category'?: string;
  'COURSE CATEGORY'?: string;
  'Awarded'?: string;
  'awarded'?: string;
  'AWARDED'?: string;
  'Specialisation'?: string;
  'specialisation'?: string;
  'SPECIALISATION'?: string;
  [key: string]: any;
}

interface ImportStats {
  categories: { created: number; errors: number };
  awardeds: { created: number; errors: number };
  specialisations: { created: number; errors: number };
}

const stats: ImportStats = {
  categories: { created: 0, errors: 0 },
  awardeds: { created: 0, errors: 0 },
  specialisations: { created: 0, errors: 0 },
};

// Helper function to read Excel file
function readExcelFile(filePath: string): ExcelRow[] {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return [];
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as ExcelRow[];
    
    console.log(`✅ Read ${data.length} rows from ${path.basename(filePath)}`);
    
    // Print first row to see column names
    if (data.length > 0) {
      console.log('\n📋 Column names found in Excel:');
      console.log(Object.keys(data[0]));
      console.log('\n📋 First data row sample:');
      console.log(JSON.stringify(data[0], null, 2));
      console.log('');
    }
    
    return data;
  } catch (error: any) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return [];
  }
}

// Helper function to normalize string values
function normalizeString(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  return str === '' || str === 'null' || str === 'undefined' ? null : str;
}

async function clearExistingData() {
  console.log('\n🗑️  Clearing existing data...');
  
  try {
    // Delete in order: specialisations -> awardeds -> course categories
    const specialisationCount = await prisma.specialisation.count();
    const awardedCount = await prisma.awarded.count();
    const categoryCount = await prisma.courseCategory.count();

    console.log(`Found ${specialisationCount} specialisations, ${awardedCount} awardeds, ${categoryCount} categories`);

    if (specialisationCount > 0) {
      await prisma.specialisation.deleteMany({});
      console.log(`✅ Deleted ${specialisationCount} specialisations`);
    }

    if (awardedCount > 0) {
      await prisma.awarded.deleteMany({});
      console.log(`✅ Deleted ${awardedCount} awardeds`);
    }

    if (categoryCount > 0) {
      await prisma.courseCategory.deleteMany({});
      console.log(`✅ Deleted ${categoryCount} course categories`);
    }

    console.log('✅ All existing data cleared\n');
  } catch (error: any) {
    console.error('❌ Error clearing data:', error.message);
    throw error;
  }
}

async function importData(excelData: ExcelRow[]) {
  console.log('\n📥 Importing data from Excel...\n');

  // Create a map to track unique categories, awardeds, and specialisations
  const categoryMap = new Map<string, string>(); // name -> id
  const awardedMap = new Map<string, { id: string; categoryId: string }>(); // "category|awarded" -> { id, categoryId }
  const specialisationMap = new Map<string, string>(); // "category|specialisation" -> id

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowNum = i + 2; // Excel rows start at 2 (1 is header)

    try {
      // Use Course_Category for course category (as it is)
      const categoryName = normalizeString(
        row['Course_Category'] ||
        row['Course Category'] || 
        row['Course category'] || 
        row['course category'] || 
        row['COURSE CATEGORY'] ||
        row['Category'] ||
        row['category']
      );
      
      // Use Main_Category (column E) for main category
      const mainCategoryName = normalizeString(
        row['Main_Category'] ||
        row['Main Category'] ||
        row['main_category'] ||
        row['MAIN CATEGORY']
      );
      
      const awardedName = normalizeString(
        row['Awards'] ||
        row['Awarded'] || 
        row['awarded'] || 
        row['AWARDED']
      );
      const specialisationName = normalizeString(
        row['Specialization'] ||
        row['Specialisation'] || 
        row['specialisation'] || 
        row['SPECIALISATION'] ||
        row['specialization']
      );

      // Skip rows with no category
      if (!categoryName) {
        console.log(`⚠️  Row ${rowNum}: Skipping - no Course Category`);
        continue;
      }

      // Create or get category
      let categoryId = categoryMap.get(categoryName);
      if (!categoryId) {
        let category = await prisma.courseCategory.findFirst({
          where: { name: categoryName },
        });
        if (!category) {
          category = await prisma.courseCategory.create({
            data: {
              name: categoryName,
            },
          });
          stats.categories.created++;
          console.log(`✅ Created category: ${categoryName}`);
        }
        categoryId = category.id;
        categoryMap.set(categoryName, categoryId);
      }

      // Create or get awarded if provided
      let awardedId: string | null = null;
      if (awardedName) {
        const awardedKey = `${categoryName}|${awardedName}`;
        let awarded = awardedMap.get(awardedKey);
        if (!awarded) {
          let awardedRecord = await prisma.awarded.findFirst({
            where: {
              name: awardedName,
              courseCategoryId: categoryId,
            },
          });
          if (!awardedRecord) {
            awardedRecord = await prisma.awarded.create({
              data: {
                name: awardedName,
                courseCategoryId: categoryId,
                isActive: true,
              },
            });
            stats.awardeds.created++;
            console.log(`  ✅ Created awarded: ${awardedName} (category: ${categoryName})`);
          }
          awarded = { id: awardedRecord.id, categoryId: awardedRecord.courseCategoryId };
          awardedMap.set(awardedKey, awarded);
        }
        awardedId = awarded.id;
      }

      // Create or get specialisation if provided
      if (specialisationName) {
        const specialisationKey = `${categoryName}|${specialisationName}`;
        if (!specialisationMap.has(specialisationKey)) {
          let specialisation = await prisma.specialisation.findFirst({
            where: {
              name: specialisationName,
              courseCategoryId: categoryId,
            },
          });
          if (!specialisation) {
            specialisation = await prisma.specialisation.create({
              data: {
                name: specialisationName,
                courseCategoryId: categoryId,
                awardedId: awardedId,
                mainCategory: mainCategoryName,
                isActive: true,
              },
            });
            stats.specialisations.created++;
            console.log(`    ✅ Created specialisation: ${specialisationName} (category: ${categoryName}${awardedName ? `, awarded: ${awardedName}` : ''}${mainCategoryName ? `, main category: ${mainCategoryName}` : ''})`);
          } else {
            // Update awardedId and mainCategory if they changed
            const updateData: any = {};
            if (specialisation.awardedId !== awardedId) {
              updateData.awardedId = awardedId;
            }
            if (specialisation.mainCategory !== mainCategoryName) {
              updateData.mainCategory = mainCategoryName;
            }
            if (Object.keys(updateData).length > 0) {
              await prisma.specialisation.update({
                where: { id: specialisation.id },
                data: updateData,
              });
            }
          }
          specialisationMap.set(specialisationKey, categoryId);
        }
      }
    } catch (error: any) {
      console.error(`❌ Row ${rowNum}: Error - ${error.message}`);
      if (error.message.includes('category')) {
        stats.categories.errors++;
      } else if (error.message.includes('awarded')) {
        stats.awardeds.errors++;
      } else {
        stats.specialisations.errors++;
      }
    }
  }
}

async function main() {
  const excelFilePath = path.join(process.cwd(), 'Course Category.xlsx');

  console.log('🚀 Starting Course Category Import');
  console.log('=====================================\n');
  console.log(`📄 Reading file: ${excelFilePath}\n`);

  // Read Excel file
  const excelData = readExcelFile(excelFilePath);
  
  if (excelData.length === 0) {
    console.error('❌ No data found in Excel file');
    process.exit(1);
  }

  try {
    // Clear existing data
    await clearExistingData();

    // Import new data
    await importData(excelData);

    // Print summary
    console.log('\n=====================================');
    console.log('📊 Import Summary');
    console.log('=====================================');
    console.log(`Categories: ${stats.categories.created} created, ${stats.categories.errors} errors`);
    console.log(`Awardeds: ${stats.awardeds.created} created, ${stats.awardeds.errors} errors`);
    console.log(`Specialisations: ${stats.specialisations.created} created, ${stats.specialisations.errors} errors`);
    console.log('=====================================\n');

    console.log('✅ Import completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
