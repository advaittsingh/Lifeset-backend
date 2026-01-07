import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConnectionStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@/shared';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async sendMessage(senderId: string, receiverId: string, message: string, messageType: string = 'text') {
    // Check if users are connected
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: senderId, receiverId, status: ConnectionStatus.ACCEPTED },
          { requesterId: receiverId, receiverId: senderId, status: ConnectionStatus.ACCEPTED },
        ],
      },
    });

    if (!connection) {
      throw new ForbiddenException('Users must be connected to send messages');
    }

    // Get sender info for notification
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: {
        studentProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const senderName = sender?.studentProfile?.firstName && sender?.studentProfile?.lastName
      ? `${sender.studentProfile.firstName} ${sender.studentProfile.lastName}`
      : sender?.email?.split('@')[0] || 'Someone';

    const createdMessage = await this.prisma.chatMessage.create({
      data: {
        senderId,
        receiverId,
        message,
        messageType,
      },
    });

    // Send notification to receiver
    try {
      await this.notificationsService.createNotification(receiverId, {
        title: 'New Message',
        message: `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
        type: NotificationType.CHAT,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      // Don't fail the message send if notification fails
    }

    return createdMessage;
  }

  async getChatHistory(userId1: string, userId2: string, limit: number = 50) {
    // Check if users are connected
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: userId1, receiverId: userId2, status: ConnectionStatus.ACCEPTED },
          { requesterId: userId2, receiverId: userId1, status: ConnectionStatus.ACCEPTED },
        ],
      },
    });

    if (!connection) {
      throw new ForbiddenException('Users must be connected to view chat history');
    }

    return this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });
  }

  async getChatList(userId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['senderId', 'receiverId'],
    });

    const chatPartners = new Set<string>();
    for (const msg of messages) {
      if (msg.senderId === userId) {
        chatPartners.add(msg.receiverId);
      } else {
        chatPartners.add(msg.senderId);
      }
    }

    const chats = await Promise.all(
      Array.from(chatPartners).map(async (partnerId) => {
        const lastMessage = await this.prisma.chatMessage.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: partnerId },
              { senderId: partnerId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            senderId: partnerId,
            receiverId: userId,
            isRead: false,
          },
        });

        const partner = await this.prisma.user.findUnique({
          where: { id: partnerId },
          include: {
            studentProfile: {
              include: {
                college: true,
                course: true,
              },
            },
          },
        });

        return {
          id: `${userId}-${partnerId}`,
          senderId: userId,
          receiverId: partnerId,
          // Partner is always the other user (receiver in this case)
          sender: null,
          receiver: partner,
          lastMessage: lastMessage?.message || '',
          lastMessageTime: lastMessage?.createdAt,
          unreadCount,
        };
      }),
    );

    return chats;
  }

  async sendInvitation(senderId: string, receiverId: string) {
    const existing = await this.prisma.chatInvitation.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.chatInvitation.create({
      data: {
        senderId,
        receiverId,
        status: 'pending',
      },
    });
  }

  async acceptInvitation(userId: string, invitationId: string) {
    return this.prisma.chatInvitation.updateMany({
      where: {
        id: invitationId,
        receiverId: userId,
      },
      data: {
        status: 'accepted',
      },
    });
  }

  async markAsRead(userId: string, messageId: string) {
    return this.prisma.chatMessage.updateMany({
      where: {
        id: messageId,
        receiverId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string, otherUserId: string) {
    return this.prisma.chatMessage.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}

