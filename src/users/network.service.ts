import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConnectionStatus } from '@prisma/client';

@Injectable()
export class NetworkService {
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

    const users = await this.prisma.user.findMany({
      where,
      include: {
        studentProfile: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true,
            college: true,
            course: true,
          },
        },
      },
      take: 50,
    });

    return users;
  }

  async sendConnectionRequest(requesterId: string, receiverId: string, message?: string) {
    const existing = await this.prisma.connection.findUnique({
      where: {
        requesterId_receiverId: {
          requesterId,
          receiverId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.connection.create({
      data: {
        requesterId,
        receiverId,
        status: ConnectionStatus.PENDING,
        message,
      },
    });
  }

  async acceptConnection(userId: string, connectionId: string) {
    return this.prisma.connection.updateMany({
      where: {
        id: connectionId,
        receiverId: userId,
        status: ConnectionStatus.PENDING,
      },
      data: {
        status: ConnectionStatus.ACCEPTED,
      },
    });
  }

  async declineConnection(userId: string, connectionId: string) {
    return this.prisma.connection.updateMany({
      where: {
        id: connectionId,
        receiverId: userId,
      },
      data: {
        status: ConnectionStatus.DECLINED,
      },
    });
  }

  async getMyNetwork(userId: string) {
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [
          { requesterId: userId, status: ConnectionStatus.ACCEPTED },
          { receiverId: userId, status: ConnectionStatus.ACCEPTED },
        ],
      },
      include: {
        requester: {
          include: {
            studentProfile: true,
          },
        },
        receiver: {
          include: {
            studentProfile: true,
          },
        },
      },
    });

    return connections.map((conn) => {
      const partner = conn.requesterId === userId ? conn.receiver : conn.requester;
      return {
        connection: conn,
        partner,
      };
    });
  }

  async getConnectionRequests(userId: string) {
    return this.prisma.connection.findMany({
      where: {
        receiverId: userId,
        status: ConnectionStatus.PENDING,
      },
      include: {
        requester: {
          include: {
            studentProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateUserCard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: {
          include: {
            college: true,
            course: true,
            experiences: {
              orderBy: { startMonthYear: 'desc' },
              take: 5, // Get latest 5 experiences
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const studentProfile = user.studentProfile;
    
    // Get skills (combine technical and soft skills)
    const technicalSkills = studentProfile?.technicalSkills || [];
    const softSkills = studentProfile?.softSkills || [];
    const allSkills = [...technicalSkills, ...softSkills];
    
    // Get interests/hobbies
    const interests = studentProfile?.interestHobbies || [];
    
    // Format experiences
    const experiences = (studentProfile?.experiences || []).map((exp: any) => ({
      companyName: exp.companyName || '',
      designation: exp.designation || '',
      location: exp.location || '',
      startMonthYear: exp.startMonthYear || '',
      endMonthYear: exp.endMonthYear || '',
      currentlyWorking: exp.currentlyWorking || false,
      aboutRole: exp.aboutRole || '',
    }));

    return {
      userId: user.id,
      name: studentProfile
        ? `${studentProfile.firstName || ''} ${studentProfile.lastName || ''}`.trim()
        : user.email || user.mobile,
      profileImage: user.profileImage || studentProfile?.profileImage || studentProfile?.profilePicture,
      college: studentProfile?.college?.name,
      course: studentProfile?.course?.name,
      skills: allSkills,
      interests: interests,
      experiences: experiences,
      qrCode: `lifeset://user/${user.id}`,
    };
  }

  async getAllUsers(currentUserId: string, filters?: any) {
    const where: any = {
      id: { not: currentUserId }, // Exclude current user
      isActive: true,
    };

    // Always exclude ADMIN users from networking (unless explicitly filtering for ADMIN)
    if (filters?.userType === 'ADMIN') {
      // Only include ADMIN if explicitly requested
      where.userType = 'ADMIN';
    } else {
      // Exclude ADMIN users in all other cases
      where.userType = { not: 'ADMIN' };
      
      // If a specific userType filter is provided (and it's not ADMIN), apply it
      if (filters?.userType && filters.userType !== 'ADMIN') {
        where.userType = filters.userType;
      }
    }

    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { mobile: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 50), 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          studentProfile: {
            select: {
              firstName: true,
              lastName: true,
              profileImage: true,
              profilePicture: true,
              technicalSkills: true,
              softSkills: true,
              interestHobbies: true,
              college: {
                select: {
                  name: true,
                },
              },
              course: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Get connection status for each user
    const userIds = users.map(u => u.id);
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [
          { requesterId: currentUserId, receiverId: { in: userIds } },
          { receiverId: currentUserId, requesterId: { in: userIds } },
        ],
      },
    });

    const connectionMap = new Map();
    connections.forEach(conn => {
      const otherUserId = conn.requesterId === currentUserId ? conn.receiverId : conn.requesterId;
      connectionMap.set(otherUserId, {
        id: conn.id,
        status: conn.status,
        isRequester: conn.requesterId === currentUserId,
      });
    });

    return {
      data: users.map(user => ({
        ...user,
        connection: connectionMap.get(user.id) || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

