import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserType } from '@/shared';

@Injectable()
export class InstitutesAdminService {
  constructor(private prisma: PrismaService) {}

  // ========== Course Master Data ==========
  async getCourseMasterData() {
    return this.prisma.courseCategory.findMany({
      include: {
        _count: { select: { awardeds: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCourseCategory(data: { name: string; description?: string }) {
    return this.prisma.courseCategory.create({ data });
  }

  async updateCourseCategory(id: string, data: { name?: string; description?: string }) {
    return this.prisma.courseCategory.update({ where: { id }, data });
  }

  async deleteCourseCategory(id: string) {
    // Check if course category has awardeds
    const awardedCount = await this.prisma.awarded.count({
      where: { courseCategoryId: id },
    });

    if (awardedCount > 0) {
      throw new ConflictException(`Cannot delete course category: it has ${awardedCount} award(s) tagged with it. Please delete or reassign the awards first.`);
    }

    return this.prisma.courseCategory.delete({ where: { id } });
  }

  // ========== Awarded Management ==========
  async getAwardedData(courseCategoryId?: string) {
    const where: any = {};
    if (courseCategoryId) {
      where.courseCategoryId = courseCategoryId;
    }
    return this.prisma.awarded.findMany({
      where,
      include: {
        courseCategory: true,
        _count: { select: { specialisations: true } },
        specialisations: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createAwarded(data: { name: string; description?: string; courseCategoryId: string; isActive?: boolean }) {
    return this.prisma.awarded.create({ 
      data: {
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      }
    });
  }

  async updateAwarded(id: string, data: { name?: string; description?: string; courseCategoryId?: string; isActive?: boolean }) {
    return this.prisma.awarded.update({ where: { id }, data });
  }

  async deleteAwarded(id: string) {
    // Check if awarded has specialisations
    const specialisationCount = await this.prisma.specialisation.count({
      where: { awardedId: id },
    });

    if (specialisationCount > 0) {
      throw new ConflictException(`Cannot delete award: it has ${specialisationCount} specialisation(s) tagged with it. Please delete or reassign the specialisations first.`);
    }

    // Check if awarded has courses (via specialisations - courses are linked to specialisations, not directly to awarded)
    // But we should check if any course is linked through specialisations
    const coursesCount = await this.prisma.course.count({
      where: {
        specialisation: {
          awardedId: id,
        },
      },
    });

    if (coursesCount > 0) {
      throw new ConflictException(`Cannot delete award: it has ${coursesCount} course(s) tagged with it through specialisations. Please delete or reassign the courses first.`);
    }

    return this.prisma.awarded.delete({ where: { id } });
  }

  // ========== Specialisation Management ==========
  async getSpecialisationData(courseCategoryId?: string) {
    const where: any = {};
    if (courseCategoryId) {
      where.courseCategoryId = courseCategoryId;
    }
    return this.prisma.specialisation.findMany({
      where,
      include: {
        courseCategory: true,
        awarded: {
          include: {
            courseCategory: true,
          },
        },
        _count: { select: { courses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Find specialisations by course category ID
   * @param courseCategoryId - The course category ID to filter by
   * @returns Array of specialisations for the given category
   */
  async findByCategoryId(courseCategoryId: string) {
    return this.prisma.specialisation.findMany({
      where: {
        courseCategoryId,
      },
      include: {
        courseCategory: true,
        awarded: {
          include: {
            courseCategory: true,
          },
        },
        _count: { select: { courses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createSpecialisation(data: { name: string; description?: string; courseCategoryId: string; awardedId?: string; mainCategory?: string; isActive?: boolean }) {
    // Validate course category exists
    const category = await this.prisma.courseCategory.findUnique({
      where: { id: data.courseCategoryId },
    });
    if (!category) {
      throw new BadRequestException('Course category not found');
    }

    // Validate awarded if provided
    if (data.awardedId) {
      const awarded = await this.prisma.awarded.findUnique({
        where: { id: data.awardedId },
      });
      if (!awarded) {
        throw new BadRequestException('Awarded not found');
      }
      // Validate that awarded belongs to the same course category
      if (awarded.courseCategoryId !== data.courseCategoryId) {
        throw new BadRequestException('Awarded does not belong to the specified course category');
      }
    }

    return this.prisma.specialisation.create({ 
      data: {
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      }
    });
  }

  async updateSpecialisation(id: string, data: { name?: string; description?: string; courseCategoryId?: string; awardedId?: string; mainCategory?: string; isActive?: boolean }) {
    // Validate course category if provided
    if (data.courseCategoryId) {
      const category = await this.prisma.courseCategory.findUnique({
        where: { id: data.courseCategoryId },
      });
      if (!category) {
        throw new BadRequestException('Course category not found');
      }
    }

    // Validate awarded if provided
    if (data.awardedId) {
      const awarded = await this.prisma.awarded.findUnique({
        where: { id: data.awardedId },
      });
      if (!awarded) {
        throw new BadRequestException('Awarded not found');
      }

      // Get current specialisation to check course category
      const specialisation = await this.prisma.specialisation.findUnique({
        where: { id },
      });
      if (!specialisation) {
        throw new NotFoundException('Specialisation not found');
      }

      const targetCategoryId = data.courseCategoryId || specialisation.courseCategoryId;
      // Validate that awarded belongs to the same course category
      if (awarded.courseCategoryId !== targetCategoryId) {
        throw new BadRequestException('Awarded does not belong to the specified course category');
      }
    }

    return this.prisma.specialisation.update({ where: { id }, data });
  }

  async deleteSpecialisation(id: string) {
    // Check if specialisation has courses
    const coursesCount = await this.prisma.course.count({
      where: { specialisationId: id },
    });

    if (coursesCount > 0) {
      throw new ConflictException(`Cannot delete specialisation: it has ${coursesCount} course(s) tagged with it. Please delete or reassign the courses first.`);
    }

    return this.prisma.specialisation.delete({ where: { id } });
  }

  // ========== Bulk Upload ==========
  async bulkUploadAwarded(csvData: Array<{ name: string; description?: string; courseCategoryId: string; isActive?: boolean }>) {
    const results = [];
    for (const row of csvData) {
      try {
        // Check if category exists
        const category = await this.prisma.courseCategory.findUnique({
          where: { id: row.courseCategoryId },
        });
        if (!category) {
          results.push({ row, success: false, error: 'Course category not found' });
          continue;
        }

        // Check if awarded already exists by name and category
        const existing = await this.prisma.awarded.findFirst({
          where: {
            name: row.name,
            courseCategoryId: row.courseCategoryId,
          },
        });

        if (existing) {
          // Update existing
          const updated = await this.prisma.awarded.update({
            where: { id: existing.id },
            data: {
              description: row.description,
              isActive: row.isActive !== undefined ? row.isActive : true,
            },
          });
          results.push({ row, success: true, action: 'updated', data: updated });
        } else {
          // Create new
          const created = await this.prisma.awarded.create({
            data: {
              name: row.name,
              description: row.description,
              courseCategoryId: row.courseCategoryId,
              isActive: row.isActive !== undefined ? row.isActive : true,
            },
          });
          results.push({ row, success: true, action: 'created', data: created });
        }
      } catch (error: any) {
        results.push({ row, success: false, error: error.message });
      }
    }
    return results;
  }

  async bulkUploadSpecialisation(csvData: Array<{ name: string; description?: string; courseCategoryId: string; awardedId?: string; isActive?: boolean }>) {
    const results = [];
    for (const row of csvData) {
      try {
        // Check if course category exists
        const category = await this.prisma.courseCategory.findUnique({
          where: { id: row.courseCategoryId },
        });
        if (!category) {
          results.push({ row, success: false, error: 'Course category not found' });
          continue;
        }

        // Validate awarded if provided
        if (row.awardedId) {
          const awarded = await this.prisma.awarded.findUnique({
            where: { id: row.awardedId },
          });
          if (!awarded) {
            results.push({ row, success: false, error: 'Awarded not found' });
            continue;
          }
          // Validate that awarded belongs to the same course category
          if (awarded.courseCategoryId !== row.courseCategoryId) {
            results.push({ row, success: false, error: 'Awarded does not belong to the specified course category' });
            continue;
          }
        }

        // Check if specialisation already exists by name and course category
        const existing = await this.prisma.specialisation.findFirst({
          where: {
            name: row.name,
            courseCategoryId: row.courseCategoryId,
          },
        });

        if (existing) {
          // Update existing
          const updated = await this.prisma.specialisation.update({
            where: { id: existing.id },
            data: {
              description: row.description,
              awardedId: row.awardedId,
              isActive: row.isActive !== undefined ? row.isActive : true,
            },
          });
          results.push({ row, success: true, action: 'updated', data: updated });
        } else {
          // Create new
          const created = await this.prisma.specialisation.create({
            data: {
              name: row.name,
              description: row.description,
              courseCategoryId: row.courseCategoryId,
              awardedId: row.awardedId,
              isActive: row.isActive !== undefined ? row.isActive : true,
            },
          });
          results.push({ row, success: true, action: 'created', data: created });
        }
      } catch (error: any) {
        results.push({ row, success: false, error: error.message });
      }
    }
    return results;
  }

  // ========== Institute Profile Management ==========
  async createInstitute(data: {
    // Faculty Head Details
    facultyHeadName: string;
    facultyHeadEmail: string;
    facultyHeadContact: string;
    facultyHeadStatus?: string;
    
    // Institute Details
    name: string;
    type?: string;
    city: string;
    state: string;
    district?: string;
    pincode?: string;
    address?: string;
    website?: string;
    email?: string;
    phone?: string;
    description?: string;
    logo?: string;
    isActive?: boolean;
  }) {
    // Check if faculty head email already exists
    if (data.facultyHeadEmail) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.facultyHeadEmail },
        include: {
          collegeProfile: {
            select: {
              id: true,
              collegeName: true,
            },
          },
        },
      });
      if (existingUser) {
        const instituteName = existingUser.collegeProfile?.collegeName || 'an existing institute';
        throw new BadRequestException(
          `Faculty head email already registered. This email is associated with ${instituteName}. Please use a different email or update the existing institute.`
        );
      }
    }

    // Check if faculty head mobile already exists
    if (data.facultyHeadContact) {
      const existingUser = await this.prisma.user.findUnique({
        where: { mobile: data.facultyHeadContact },
        include: {
          collegeProfile: {
            select: {
              id: true,
              collegeName: true,
            },
          },
        },
      });
      if (existingUser) {
        const instituteName = existingUser.collegeProfile?.collegeName || 'an existing institute';
        throw new BadRequestException(
          `Faculty head contact number already registered. This number is associated with ${instituteName}. Please use a different contact number or update the existing institute.`
        );
      }
    }

    // Generate a default password for faculty head (can be changed later)
    const defaultPassword = 'Faculty@123'; // In production, generate a secure random password
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Combine address with district and pincode if provided
    let fullAddress = data.address || '';
    if (data.district) {
      fullAddress = fullAddress ? `${fullAddress}, ${data.district}` : data.district;
    }
    if (data.pincode) {
      fullAddress = fullAddress ? `${fullAddress} - ${data.pincode}` : `Pincode: ${data.pincode}`;
    }

    // Create institute and faculty head in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Create Faculty Head User
      const facultyUser = await tx.user.create({
        data: {
          email: data.facultyHeadEmail,
          mobile: data.facultyHeadContact,
          password: hashedPassword,
          userType: UserType.FACULTY,
          isActive: data.facultyHeadStatus === 'Active',
          isVerified: true, // Auto-verify faculty heads created by admin
        },
      });

      // Create College/Institute
      const college = await tx.college.create({
        data: {
          name: data.name,
          address: fullAddress || undefined,
          city: data.city,
          state: data.state,
          // Store additional fields that don't exist in schema in a JSON metadata field
          // For now, we'll use available fields and note that type, website, email, phone, description need schema update
          isActive: data.isActive !== false,
        },
      });

      // Create CollegeProfile for the faculty head linking to this college
      await tx.collegeProfile.create({
        data: {
          userId: facultyUser.id,
          collegeName: data.name,
          address: fullAddress || undefined,
          city: data.city,
          state: data.state,
        },
      });

      return {
        college,
        facultyHead: {
          id: facultyUser.id,
          email: facultyUser.email,
          mobile: facultyUser.mobile,
          name: data.facultyHeadName,
          status: data.facultyHeadStatus || 'Active',
        },
        message: 'Institute and faculty head created successfully',
      };
    });
  }

  async updateInstitute(id: string, data: any) {
    return this.prisma.college.update({ where: { id }, data });
  }

  async deleteInstitute(id: string) {
    // Check if institute exists
    const institute = await this.prisma.college.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            courses: true,
            students: true,
          },
        },
      },
    });

    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    // Check for dependencies and prevent deletion if they exist
    const dependencyMessages: string[] = [];

    if (institute._count.courses > 0) {
      dependencyMessages.push(`${institute._count.courses} course(s)`);
    }

    if (institute._count.students > 0) {
      dependencyMessages.push(`${institute._count.students} student(s)`);
    }

    if (dependencyMessages.length > 0) {
      throw new BadRequestException(
        `Cannot delete institute: it has ${dependencyMessages.join(' and ')} associated with it. Please delete or reassign these dependencies first.`
      );
    }

    // If no dependencies, proceed with deletion in a transaction
    // Note: CollegeSections have onDelete: Cascade, so they'll be automatically deleted
    return this.prisma.$transaction(async (tx) => {
      // Delete the college (sections will cascade automatically)
      await tx.college.delete({
        where: { id },
      });

      // Clean up any CollegeProfile records that match this college name
      // (These are created when the institute is created)
      await tx.collegeProfile.deleteMany({
        where: {
          collegeName: institute.name,
        },
      });

      return {
        success: true,
        message: 'Institute deleted successfully',
      };
    });
  }

  async getInstituteById(id: string) {
    return this.prisma.college.findUnique({
      where: { id },
      include: {
        courses: {
          include: { category: true },
        },
        _count: {
          select: {
            students: true,
            courses: true,
          },
        },
      },
    });
  }

  // ========== Course Creation ==========
  async createCourse(data: {
    name: string;
    collegeId: string;
    categoryId?: string;
    specialisationId?: string;
    awardedId?: string; // Optional, for validation purposes (not stored in Course model)
    affiliationId?: string; // Optional, redundant with collegeId (not stored in Course model)
    section?: string; // Optional, not stored in Course model
    courseMode?: string; // Optional, not stored in Course model
    level?: string; // Optional, not stored in Course model
    code?: string;
    duration?: string;
    description?: string;
    fees?: number;
    eligibility?: string;
    isActive?: boolean;
  }) {
    // Validate that college exists
    const college = await this.prisma.college.findUnique({
      where: { id: data.collegeId },
    });
    if (!college) {
      throw new BadRequestException('Institute not found');
    }

    // Validate category if provided
    if (data.categoryId) {
      const category = await this.prisma.courseCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Course category not found');
      }
    }

    // Validate specialisation if provided
    if (data.specialisationId) {
      const specialisation = await this.prisma.specialisation.findUnique({
        where: { id: data.specialisationId },
      });
      if (!specialisation) {
        throw new BadRequestException('Specialisation not found');
      }
    }

    // Validate awarded if provided (awarded is independent of specialisation)
    if (data.awardedId) {
      const awarded = await this.prisma.awarded.findUnique({
        where: { id: data.awardedId },
      });
      if (!awarded) {
        throw new BadRequestException('Awarded not found');
      }
    }

    // Remove fields that don't exist in Course model before creating course
    const { awardedId, affiliationId, section, courseMode, level, ...courseData } = data;
    return this.prisma.course.create({ data: courseData });
  }

  async getCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        specialisation: {
          include: {
            awarded: {
              include: {
                courseCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        college: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    // Enhance course data with fields the frontend expects for editing
    return {
      ...course,
      // Derive awardedId from specialisation if it exists
      awardedId: course.specialisation?.awardedId || null,
      // affiliationId is the collegeId (for frontend compatibility)
      affiliationId: course.collegeId || null,
      // These fields aren't stored in the database, return null/empty for frontend
      section: null,
      courseMode: null,
      level: null,
    };
  }

  async updateCourse(id: string, data: any) {
    // Remove fields that don't exist in Course model before updating
    const { awardedId, affiliationId, section, courseMode, level, ...courseData } = data;
    return this.prisma.course.update({ where: { id }, data: courseData });
  }

  async deleteCourse(id: string) {
    // Check if course exists
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            assignments: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check for dependencies and prevent deletion if they exist
    const dependencyMessages: string[] = [];

    if (course._count.students > 0) {
      dependencyMessages.push(`${course._count.students} student(s)`);
    }

    if (dependencyMessages.length > 0) {
      throw new BadRequestException(
        `Cannot delete course: it has ${dependencyMessages.join(' and ')} enrolled in it. Please remove or reassign these students first.`
      );
    }

    // If no dependencies, proceed with deletion
    // Note: CourseAssignments have onDelete: Cascade, so they'll be automatically deleted
    await this.prisma.course.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Course deleted successfully',
    };
  }

  async getCoursesByInstitute(instituteId: string) {
    const courses = await this.prisma.course.findMany({
      where: { collegeId: instituteId },
      include: { 
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        specialisation: {
          include: {
            awarded: {
              include: {
                courseCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Enhance courses with fields the frontend expects
    return courses.map(course => ({
      ...course,
      // Derive awardedId from specialisation if it exists
      awardedId: course.specialisation?.awardedId || null,
      // affiliationId is the collegeId (for frontend compatibility)
      affiliationId: course.collegeId || null,
      // These fields aren't stored in the database, return null/empty for frontend
      section: null,
      courseMode: null,
      level: null,
    }));
  }

  // ========== Student Dashboard & Reports ==========
  async getInstituteStudentDashboard(instituteId: string) {
    const [totalStudents, activeStudents, totalCourses, recentStudents] = await Promise.all([
      this.prisma.studentProfile.count({ where: { collegeId: instituteId } }),
      this.prisma.studentProfile.count({
        where: { collegeId: instituteId, user: { isActive: true } },
      }),
      this.prisma.course.count({ where: { collegeId: instituteId, isActive: true } }),
      this.prisma.studentProfile.findMany({
        where: { collegeId: instituteId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              mobile: true,
              profileImage: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Get students by course
    const studentsByCourse = await this.prisma.course.findMany({
      where: { collegeId: instituteId },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    return {
      stats: {
        totalStudents,
        activeStudents,
        totalCourses,
        inactiveStudents: totalStudents - activeStudents,
      },
      recentStudents,
      studentsByCourse: studentsByCourse.map((course) => ({
        courseId: course.id,
        courseName: course.name,
        studentCount: course._count.students,
      })),
    };
  }

  async getInstituteReports(instituteId: string, filters?: any) {
    const where: any = { collegeId: instituteId };
    if (filters?.courseId) where.courseId = filters.courseId;
    if (filters?.startDate) {
      where.user = {
        createdAt: { gte: new Date(filters.startDate) },
      };
    }
    if (filters?.endDate) {
      where.user = {
        ...where.user,
        createdAt: {
          ...where.user?.createdAt,
          lte: new Date(filters.endDate),
        },
      };
    }

    const students = await this.prisma.studentProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            mobile: true,
            profileImage: true,
            isActive: true,
            createdAt: true,
          },
        },
        course: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by course
    const byCourse: Record<string, any[]> = {};
    students.forEach((student) => {
      const courseName = student.course?.name || 'No Course';
      if (!byCourse[courseName]) {
        byCourse[courseName] = [];
      }
      byCourse[courseName].push(student);
    });

    return {
      total: students.length,
      byCourse,
      students,
    };
  }

  // ========== Institute Landing Page Data ==========
  async getInstituteLandingPage(instituteId: string) {
    const institute = await this.prisma.college.findUnique({
      where: { id: instituteId },
      include: {
        courses: {
          where: { isActive: true },
          include: { category: true },
        },
        _count: {
          select: {
            students: true,
            courses: true,
          },
        },
      },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    return {
      ...institute,
      stats: {
        totalStudents: institute._count.students,
        totalCourses: institute._count.courses,
        activeCourses: institute.courses.length,
      },
    };
  }

  // ========== Institute Search ==========
  async searchInstitutes(filters: {
    search?: string;
    city?: string;
    state?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 1000); // Cap limit at 1000
      const skip = (page - 1) * limit;

      const where: any = { isActive: true };

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { city: { contains: filters.search, mode: 'insensitive' } },
          { state: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.city) {
        where.city = { contains: filters.city, mode: 'insensitive' };
      }

      if (filters.state) {
        where.state = { contains: filters.state, mode: 'insensitive' };
      }

      // Note: College model doesn't have a 'type' field, so we skip that filter
      // if (filters.type) {
      //   where.type = filters.type;
      // }

      const [institutes, total] = await Promise.all([
        this.prisma.college.findMany({
          where,
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                students: true,
                courses: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.college.count({ where }),
      ]);

      return {
        data: institutes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      // Log the error for debugging
      console.error('Error in searchInstitutes:', error);
      throw new BadRequestException(
        `Failed to fetch institutes: ${error.message || 'Unknown error'}`
      );
    }
  }
}

