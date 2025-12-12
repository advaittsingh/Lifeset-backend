import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async createProject(studentId: string, data: {
    title: string;
    description: string;
    images?: string[];
    links?: string[];
    technologies?: string[];
  }) {
    return this.prisma.project.create({
      data: {
        studentId,
        ...data,
      },
    });
  }

  async getProjects(studentId?: string) {
    const where: any = {};
    if (studentId) {
      where.studentId = studentId;
    }

    return this.prisma.project.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }
}

