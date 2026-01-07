import { PrismaClient, UserType, FeedType } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface MigrationStats {
  courseCategories: { created: number; found: number; errors: number };
  posts: { created: number; found: number; errors: number };
  colleges: { created: number; found: number; errors: number };
  courses: { created: number; found: number; errors: number };
  users: { created: number; found: number; errors: number };
}

const stats: MigrationStats = {
  courseCategories: { created: 0, found: 0, errors: 0 },
  posts: { created: 0, found: 0, errors: 0 },
  colleges: { created: 0, found: 0, errors: 0 },
  courses: { created: 0, found: 0, errors: 0 },
  users: { created: 0, found: 0, errors: 0 },
};

// Helper function to read Excel file
function readExcelFile(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return [];
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
    
    console.log(`✅ Read ${data.length} rows from ${path.basename(filePath)}`);
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

// Helper function to normalize number values
function normalizeNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// Helper function to normalize date values
function normalizeDate(value: any): Date | null {
  if (!value) return null;
  try {
    // Handle Excel date serial numbers
    if (typeof value === 'number') {
      return new Date((value - 25569) * 86400 * 1000);
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Get or create admin user for posts
async function getOrCreateAdminUser() {
  let admin = await prisma.user.findFirst({
    where: {
      userType: UserType.ADMIN,
      isActive: true,
    },
  });

  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    admin = await prisma.user.create({
      data: {
        email: 'admin@lifeset.com',
        password: hashedPassword,
        userType: UserType.ADMIN,
        isActive: true,
        isVerified: true,
        adminProfile: {
          create: {
            role: 'SUPER_ADMIN',
            permissions: {
              resources: ['*'],
              actions: ['*'],
            },
          },
        },
      },
    });
    console.log('✅ Created admin user for posts');
  }

  return admin;
}

// Load Course Categories
async function loadCourseCategories(filePath: string) {
  console.log('\n📚 Loading Course Categories...');
  console.log('='.repeat(60));

  const data = readExcelFile(filePath);
  if (data.length === 0) {
    console.log('⚠️  No data found in Course Category file');
    return;
  }

  for (const row of data) {
    try {
      const name = normalizeString((row as any).name || (row as any).Name || (row as any).Category || (row as any).category);
      const description = normalizeString((row as any).description || (row as any).Description || (row as any).details);

      if (!name) {
        console.log('⚠️  Skipping row with no name');
        continue;
      }

      const existing = await prisma.courseCategory.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        console.log(`  ✓ Found: ${name}`);
        stats.courseCategories.found++;
      } else {
        await prisma.courseCategory.create({
          data: {
            name,
            description,
          },
        });
        console.log(`  ✅ Created: ${name}`);
        stats.courseCategories.created++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing row:`, error.message);
      stats.courseCategories.errors++;
    }
  }
}

// Load GK Posts
async function loadGKPosts(filePath: string) {
  console.log('\n📝 Loading GK Posts...');
  console.log('='.repeat(60));

  const data = readExcelFile(filePath);
  if (data.length === 0) {
    console.log('⚠️  No data found in GK Post file');
    return;
  }

  const admin = await getOrCreateAdminUser();

  for (const row of data) {
    try {
      const title = normalizeString((row as any).title || (row as any).Title || (row as any).heading || (row as any).Heading);
      const description = normalizeString((row as any).description || (row as any).Description || (row as any).content || (row as any).Content || (row as any).body);
      const categoryName = normalizeString((row as any).category || (row as any).Category || (row as any).categoryName);
      const subCategoryName = normalizeString((row as any).subCategory || (row as any).SubCategory || (row as any).subcategory);
      const chapterName = normalizeString((row as any).chapter || (row as any).Chapter || (row as any).section);
      const images = (row as any).images || (row as any).Images || (row as any).image;
      const imageArray = images ? (Array.isArray(images) ? images : [images]).filter(Boolean) : [];

      if (!title || !description) {
        console.log('⚠️  Skipping row with missing title or description');
        continue;
      }

      // Find or create category hierarchy
      let categoryId: string | null = null;
      if (categoryName) {
        let category = await prisma.wallCategory.findFirst({
          where: {
            name: {
              equals: categoryName,
              mode: 'insensitive',
            },
            parentCategoryId: null,
          },
        });

        if (!category) {
          category = await prisma.wallCategory.create({
            data: {
              name: categoryName,
              description: `Category for ${categoryName}`,
              isActive: true,
            },
          });
          console.log(`  ✅ Created category: ${categoryName}`);
        }

        // Handle subcategory
        if (subCategoryName) {
          let subCategory = await prisma.wallCategory.findFirst({
            where: {
              name: {
                equals: subCategoryName,
                mode: 'insensitive',
              },
              parentCategoryId: category.id,
            },
          });

          if (!subCategory) {
            subCategory = await prisma.wallCategory.create({
              data: {
                name: subCategoryName,
                description: `Subcategory for ${subCategoryName}`,
                isActive: true,
                parentCategoryId: category.id,
              },
            });
            console.log(`  ✅ Created subcategory: ${subCategoryName}`);
          }

          categoryId = subCategory.id;

          // Handle chapter if exists
          if (chapterName) {
            try {
              const existingChapter = await (prisma as any).chapter.findFirst({
                where: {
                  name: {
                    equals: chapterName,
                    mode: 'insensitive',
                  },
                  subCategoryId: subCategory.id,
                },
              });

              if (!existingChapter) {
                await (prisma as any).chapter.create({
                  data: {
                    name: chapterName,
                    subCategoryId: subCategory.id,
                    isActive: true,
                    order: 0,
                  },
                });
                console.log(`  ✅ Created chapter: ${chapterName}`);
              }
            } catch (error: any) {
              // Chapter table might not exist, store in metadata
              console.log(`  ⚠️  Could not create chapter (table may not exist): ${chapterName}`);
            }
          }
        } else {
          categoryId = category.id;
        }
      }

      // Check if post already exists
      const existing = await prisma.post.findFirst({
        where: {
          title: {
            equals: title,
            mode: 'insensitive',
          },
          userId: admin.id,
        },
      });

      if (existing) {
        console.log(`  ✓ Found: ${title}`);
        stats.posts.found++;
      } else {
        const metadata: any = {};
        if (subCategoryName && categoryId) {
          // Find the subcategory ID
          const subCategory = await prisma.wallCategory.findFirst({
            where: { id: categoryId },
          });
          if (subCategory) {
            metadata.subCategoryId = subCategory.id;
          }
        }
        if (chapterName) {
          metadata.chapterName = chapterName;
        }

        await prisma.post.create({
          data: {
            userId: admin.id,
            title,
            description,
            postType: FeedType.COLLEGE_FEED,
            categoryId,
            images: imageArray,
            isActive: true,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          },
        });
        console.log(`  ✅ Created: ${title}`);
        stats.posts.created++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing row:`, error.message);
      stats.posts.errors++;
    }
  }
}

// Load Institutes and Courses
async function loadInstitutesAndCourses(filePath: string) {
  console.log('\n🏫 Loading Institutes and Courses...');
  console.log('='.repeat(60));

  const data = readExcelFile(filePath);
  if (data.length === 0) {
    console.log('⚠️  No data found in Institute_Courses file');
    return;
  }

  for (const row of data) {
    try {
      const instituteName = normalizeString((row as any).institute || (row as any).Institute || (row as any).college || (row as any).College || (row as any).instituteName);
      const courseName = normalizeString((row as any).course || (row as any).Course || (row as any).courseName);
      const courseCode = normalizeString((row as any).courseCode || (row as any).CourseCode || (row as any).code);
      const courseCategoryName = normalizeString((row as any).courseCategory || (row as any).CourseCategory || (row as any).category);
      const duration = normalizeString((row as any).duration || (row as any).Duration);
      const description = normalizeString((row as any).description || (row as any).Description);
      const address = normalizeString((row as any).address || (row as any).Address);
      const city = normalizeString((row as any).city || (row as any).City);
      const state = normalizeString((row as any).state || (row as any).State);

      if (!instituteName) {
        console.log('⚠️  Skipping row with no institute name');
        continue;
      }

      // Find or create college
      let college = await prisma.college.findFirst({
        where: {
          name: {
            equals: instituteName,
            mode: 'insensitive',
          },
        },
      });

      if (!college) {
        college = await prisma.college.create({
          data: {
            name: instituteName,
            address,
            city,
            state,
            isActive: true,
          },
        });
        console.log(`  ✅ Created college: ${instituteName}`);
        stats.colleges.created++;
      } else {
        console.log(`  ✓ Found college: ${instituteName}`);
        stats.colleges.found++;
      }

      // Create course if course name is provided
      if (courseName) {
        let courseCategoryId: string | null = null;
        if (courseCategoryName) {
          const courseCategory = await prisma.courseCategory.findFirst({
            where: {
              name: {
                equals: courseCategoryName,
                mode: 'insensitive',
              },
            },
          });

          if (courseCategory) {
            courseCategoryId = courseCategory.id;
          }
        }

        const existingCourse = await prisma.course.findFirst({
          where: {
            name: {
              equals: courseName,
              mode: 'insensitive',
            },
            collegeId: college.id,
          },
        });

        if (!existingCourse) {
          await prisma.course.create({
            data: {
              collegeId: college.id,
              name: courseName,
              code: courseCode,
              duration,
              description,
              categoryId: courseCategoryId,
              isActive: true,
            },
          });
          console.log(`    ✅ Created course: ${courseName}`);
          stats.courses.created++;
        } else {
          console.log(`    ✓ Found course: ${courseName}`);
          stats.courses.found++;
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing row:`, error.message);
      stats.colleges.errors++;
      stats.courses.errors++;
    }
  }
}

// Load Users
async function loadUsers(filePath: string) {
  console.log('\n👥 Loading Users...');
  console.log('='.repeat(60));

  const data = readExcelFile(filePath);
  if (data.length === 0) {
    console.log('⚠️  No data found in Users Info file');
    return;
  }

  const defaultPassword = await bcrypt.hash('Password123!', 10);

  for (const row of data) {
    try {
      const email = normalizeString((row as any).email || (row as any).Email || (row as any).emailAddress);
      const mobile = normalizeString((row as any).mobile || (row as any).Mobile || (row as any).phone || (row as any).Phone || (row as any).contact);
      const firstName = normalizeString((row as any).firstName || (row as any).FirstName || (row as any).first_name || (row as any).name);
      const lastName = normalizeString((row as any).lastName || (row as any).LastName || (row as any).last_name);
      const dateOfBirth = normalizeDate((row as any).dateOfBirth || (row as any).DateOfBirth || (row as any).dob || (row as any).DOB);
      const gender = normalizeString((row as any).gender || (row as any).Gender);
      const address = normalizeString((row as any).address || (row as any).Address);
      const city = normalizeString((row as any).city || (row as any).City);
      const state = normalizeString((row as any).state || (row as any).State);
      const pincode = normalizeString((row as any).pincode || (row as any).Pincode || (row as any).pin || (row as any).PIN);
      const collegeName = normalizeString((row as any).college || (row as any).College || (row as any).collegeName);
      const courseName = normalizeString((row as any).course || (row as any).Course || (row as any).courseName);

      if (!email && !mobile) {
        console.log('⚠️  Skipping row with no email or mobile');
        continue;
      }

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(mobile ? [{ mobile }] : []),
          ],
        },
      });

      if (existingUser) {
        console.log(`  ✓ Found user: ${email || mobile}`);
        stats.users.found++;
        continue;
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email || null,
          mobile: mobile || null,
          password: defaultPassword,
          userType: UserType.STUDENT,
          isActive: true,
          isVerified: false,
        },
      });

      // Create student profile
      let collegeId: string | null = null;
      let courseId: string | null = null;

      if (collegeName) {
        const college = await prisma.college.findFirst({
          where: {
            name: {
              equals: collegeName,
              mode: 'insensitive',
            },
          },
        });
        if (college) {
          collegeId = college.id;

          if (courseName) {
            const course = await prisma.course.findFirst({
              where: {
                name: {
                  equals: courseName,
                  mode: 'insensitive',
                },
                collegeId: college.id,
              },
            });
            if (course) {
              courseId = course.id;
            }
          }
        }
      }

      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          firstName: firstName || 'Unknown',
          lastName: lastName || '',
          dateOfBirth,
          gender,
          address,
          city,
          state,
          pincode,
          collegeId,
          courseId,
        },
      });

      console.log(`  ✅ Created user: ${email || mobile}`);
      stats.users.created++;
    } catch (error: any) {
      console.error(`  ❌ Error processing row:`, error.message);
      stats.users.errors++;
    }
  }
}

// Main migration function
async function main() {
  console.log('\n🚀 Starting Migration Data Load');
  console.log('='.repeat(60));
  console.log(`📁 Migration data folder: ${path.join(process.cwd(), 'migration data')}\n`);

  const migrationDataPath = path.join(process.cwd(), 'migration data');

  try {
    // Load Course Categories
    const courseCategoryPath = path.join(migrationDataPath, 'Course Category.xlsx');
    await loadCourseCategories(courseCategoryPath);

    // Load GK Posts
    const gkPostPath = path.join(migrationDataPath, 'GK Post.xlsx');
    await loadGKPosts(gkPostPath);

    // Load Institutes and Courses
    const instituteCoursesPath = path.join(migrationDataPath, 'Institute_Courses.xlsx');
    await loadInstitutesAndCourses(instituteCoursesPath);

    // Load Users (should be done after institutes/courses to link properly)
    const usersPath = path.join(migrationDataPath, 'Users Info.xlsx');
    await loadUsers(usersPath);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`\n📚 Course Categories:`);
    console.log(`   Created: ${stats.courseCategories.created}`);
    console.log(`   Found: ${stats.courseCategories.found}`);
    console.log(`   Errors: ${stats.courseCategories.errors}`);

    console.log(`\n📝 GK Posts:`);
    console.log(`   Created: ${stats.posts.created}`);
    console.log(`   Found: ${stats.posts.found}`);
    console.log(`   Errors: ${stats.posts.errors}`);

    console.log(`\n🏫 Colleges:`);
    console.log(`   Created: ${stats.colleges.created}`);
    console.log(`   Found: ${stats.colleges.found}`);
    console.log(`   Errors: ${stats.colleges.errors}`);

    console.log(`\n📖 Courses:`);
    console.log(`   Created: ${stats.courses.created}`);
    console.log(`   Found: ${stats.courses.found}`);
    console.log(`   Errors: ${stats.courses.errors}`);

    console.log(`\n👥 Users:`);
    console.log(`   Created: ${stats.users.created}`);
    console.log(`   Found: ${stats.users.found}`);
    console.log(`   Errors: ${stats.users.errors}`);

    console.log('\n✅ Migration completed successfully!\n');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
