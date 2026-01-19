import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class InstitutesService {
  constructor(private prisma: PrismaService) {}

  async getInstitutes(filters: {
    search?: string;
    city?: string;
    state?: string;
    page?: number;
    limit?: number;
    simple?: boolean; // If true, return simple { id, name } format for autocomplete
    all?: boolean; // If true, fetch all institutes without limit (for dropdown)
  }) {
    const where: any = { isActive: true };

    // Handle search query - search across name, city, and state
    if (filters.search) {
      // Search across name, city, and state for better results
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { state: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Apply city filter if provided (can be combined with search for AND logic)
    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    // Apply state filter if provided (can be combined with search for AND logic)
    if (filters.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }

    // If page is provided, return paginated format, otherwise return simple array for autocomplete
    const wantsPagination = filters.page !== undefined;

    if (wantsPagination) {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const [institutes, total] = await Promise.all([
        this.prisma.college.findMany({
          where,
          skip,
          take: limit,
          include: {
            university: true,
            _count: {
              select: {
                courses: true,
                students: true,
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

    // Default: Simple array format for autocomplete (no pagination)
    // For dropdown, fetch all institutes (up to 5000)
    // If searching, limit to 500 for performance
    // If explicit limit is provided, use that limit
    const queryOptions: any = {
      where,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    };

    // Determine limit:
    // 1. If explicit limit provided, use it
    // 2. If searching, limit to 500 for performance
    // 3. Otherwise, fetch all institutes (up to 5000) for dropdown
    if (filters.limit !== undefined) {
      queryOptions.take = filters.limit;
    } else if (filters.search) {
      queryOptions.take = 500; // Limit search results for performance
    } else {
      // Fetch all institutes for dropdown (cap at 5000 for safety)
      queryOptions.take = 5000;
    }

    const institutes = await this.prisma.college.findMany(queryOptions);
    return institutes;
  }

  async getInstituteById(id: string) {
    const college = await this.prisma.college.findUnique({
      where: { id },
      include: {
        university: true,
        courses: {
          where: { isActive: true },
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sections: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            courses: true,
            students: true,
          },
        },
      },
    });

    if (!college) {
      return null;
    }

    // Extract unique course categories from courses
    const categoryMap = new Map<string, { id: string; name: string }>();
    college.courses.forEach((course) => {
      if (course.category && !categoryMap.has(course.category.id)) {
        categoryMap.set(course.category.id, {
          id: course.category.id,
          name: course.category.name,
        });
      }
    });

    // Format courses with categoryId
    const courses = college.courses.map((course) => ({
      id: course.id,
      name: course.name,
      categoryId: course.categoryId || null,
    }));

    // Format sections
    const sections = college.sections.map((section) => ({
      id: section.id,
      name: section.name,
    }));

    // Return the format expected by the frontend
    return {
      ...college,
      courseCategories: Array.from(categoryMap.values()),
      courses,
      sections,
      semesters: [], // No Semester model exists yet, return empty array
    };
  }

  async getCourses(collegeId: string) {
    return this.prisma.course.findMany({
      where: {
        collegeId,
        isActive: true,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCourseById(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        college: true,
        category: true,
      },
    });
  }

  async getSectionsByCollegeId(collegeId: string) {
    // Verify college exists
    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
    });

    if (!college) {
      return [];
    }

    // Get sections for this college
    const sections = await this.prisma.collegeSection.findMany({
      where: { collegeId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return sections;
  }

  async getSemesters() {
    // Return standard semester list (1-8 semesters)
    // Most courses have 6-8 semesters, so providing up to 8
    const semesters = Array.from({ length: 8 }, (_, i) => {
      const num = i + 1;
      const suffix = this.getOrdinalSuffix(num);
      return {
        id: `semester-${num}`,
        name: `${num}${suffix} Semester`,
        value: num.toString(),
      };
    });

    return semesters;
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
}

