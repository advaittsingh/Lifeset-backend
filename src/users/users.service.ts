import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async searchUsers(query: string, filters?: any) {
    const where: any = {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { mobile: { contains: query, mode: 'insensitive' } },
      ],
      isActive: true,
    };

    if (filters?.userType) {
      where.userType = filters.userType;
    }

    return this.prisma.user.findMany({
      where,
      include: {
        studentProfile: true,
        companyProfile: true,
        collegeProfile: true,
      },
      take: 50,
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: {
          include: {
            college: true,
            course: true,
          },
        },
        companyProfile: true,
        collegeProfile: true,
      },
    });
  }
}

