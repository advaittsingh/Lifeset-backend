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
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      name: user.studentProfile
        ? `${user.studentProfile.firstName} ${user.studentProfile.lastName}`
        : user.email || user.mobile,
      profileImage: user.profileImage || user.studentProfile?.profileImage,
      college: user.studentProfile?.college?.name,
      course: user.studentProfile?.course?.name,
      qrCode: `lifeset://user/${user.id}`,
    };
  }
}

