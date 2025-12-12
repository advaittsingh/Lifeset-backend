import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

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
    return this.prisma.awarded.delete({ where: { id } });
  }

  // ========== Specialisation Management ==========
  async getSpecialisationData(awardedId?: string) {
    const where: any = {};
    if (awardedId) {
      where.awardedId = awardedId;
    }
    return this.prisma.specialisation.findMany({
      where,
      include: {
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

  async createSpecialisation(data: { name: string; description?: string; awardedId: string; isActive?: boolean }) {
    return this.prisma.specialisation.create({ 
      data: {
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      }
    });
  }

  async updateSpecialisation(id: string, data: { name?: string; description?: string; awardedId?: string; isActive?: boolean }) {
    return this.prisma.specialisation.update({ where: { id }, data });
  }

  async deleteSpecialisation(id: string) {
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

  async bulkUploadSpecialisation(csvData: Array<{ name: string; description?: string; awardedId: string; isActive?: boolean }>) {
    const results = [];
    for (const row of csvData) {
      try {
        // Check if awarded exists
        const awarded = await this.prisma.awarded.findUnique({
          where: { id: row.awardedId },
        });
        if (!awarded) {
          results.push({ row, success: false, error: 'Awarded not found' });
          continue;
        }

        // Check if specialisation already exists by name and awarded
        const existing = await this.prisma.specialisation.findFirst({
          where: {
            name: row.name,
            awardedId: row.awardedId,
          },
        });

        if (existing) {
          // Update existing
          const updated = await this.prisma.specialisation.update({
            where: { id: existing.id },
            data: {
              description: row.description,
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
    name: string;
    type: string;
    city: string;
    state: string;
    pincode?: string;
    address?: string;
    website?: string;
    email?: string;
    phone?: string;
    description?: string;
    logo?: string;
    isActive?: boolean;
  }) {
    return this.prisma.college.create({ data });
  }

  async updateInstitute(id: string, data: any) {
    return this.prisma.college.update({ where: { id }, data });
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
    categoryId: string;
    duration?: string;
    description?: string;
    fees?: number;
    eligibility?: string;
    isActive?: boolean;
  }) {
    return this.prisma.course.create({ data });
  }

  async updateCourse(id: string, data: any) {
    return this.prisma.course.update({ where: { id }, data });
  }

  async getCoursesByInstitute(instituteId: string) {
    return this.prisma.course.findMany({
      where: { collegeId: instituteId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
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
    const page = filters.page || 1;
    const limit = filters.limit || 20;
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

    if (filters.type) {
      where.type = filters.type;
    }

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
  }
}

