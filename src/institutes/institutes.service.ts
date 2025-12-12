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
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }

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

  async getInstituteById(id: string) {
    return this.prisma.college.findUnique({
      where: { id },
      include: {
        university: true,
        courses: {
          where: { isActive: true },
        },
        _count: {
          select: {
            courses: true,
            students: true,
          },
        },
      },
    });
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
}

