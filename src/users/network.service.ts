import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConnectionStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@/shared';

@Injectable()
export class NetworkService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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

    // Get requester info for notification
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      include: {
        studentProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const requesterName = requester?.studentProfile?.firstName && requester?.studentProfile?.lastName
      ? `${requester.studentProfile.firstName} ${requester.studentProfile.lastName}`
      : requester?.email?.split('@')[0] || 'Someone';

    const connection = await this.prisma.connection.create({
      data: {
        requesterId,
        receiverId,
        status: ConnectionStatus.PENDING,
        message,
      },
    });

    // Send notification to receiver
    try {
      await this.notificationsService.createNotification(receiverId, {
        title: 'New Connection Request',
        message: `${requesterName} sent you a connection request`,
        type: NotificationType.SYSTEM,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      // Don't fail the connection request if notification fails
    }

    return connection;
  }

  async acceptConnection(userId: string, connectionId: string) {
    // Get connection details before updating
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        requester: {
          include: {
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        receiver: {
          include: {
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!connection || connection.receiverId !== userId || connection.status !== ConnectionStatus.PENDING) {
      throw new Error('Invalid connection request');
    }

    const updated = await this.prisma.connection.updateMany({
      where: {
        id: connectionId,
        receiverId: userId,
        status: ConnectionStatus.PENDING,
      },
      data: {
        status: ConnectionStatus.ACCEPTED,
      },
    });

    // Send notification to requester
    const receiverName = connection.receiver?.studentProfile?.firstName && connection.receiver?.studentProfile?.lastName
      ? `${connection.receiver.studentProfile.firstName} ${connection.receiver.studentProfile.lastName}`
      : connection.receiver?.email?.split('@')[0] || 'Someone';

    try {
      await this.notificationsService.createNotification(connection.requesterId, {
        title: 'Connection Accepted',
        message: `${receiverName} accepted your connection request`,
        type: NotificationType.SYSTEM,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      // Don't fail the connection accept if notification fails
    }

    return updated;
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
    // Get received requests (pending)
    const receivedRequests = await this.prisma.connection.findMany({
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

    // Get sent requests (pending - not accepted)
    const sentRequests = await this.prisma.connection.findMany({
      where: {
        requesterId: userId,
        status: ConnectionStatus.PENDING,
      },
      include: {
        receiver: {
          include: {
            studentProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      received: receivedRequests,
      sent: sentRequests,
    };
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
      profileImage: user.profileImage || studentProfile?.profileImage,
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

    // Add search functionality
    if (filters?.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { mobile: { contains: searchTerm, mode: 'insensitive' } },
            {
              studentProfile: {
                OR: [
                  { firstName: { contains: searchTerm, mode: 'insensitive' } },
                  { lastName: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
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

