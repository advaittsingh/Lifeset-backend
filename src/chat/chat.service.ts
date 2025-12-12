import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: string, receiverId: string, message: string, messageType: string = 'text') {
    return this.prisma.chatMessage.create({
      data: {
        senderId,
        receiverId,
        message,
        messageType,
      },
    });
  }

  async getChatHistory(userId1: string, userId2: string, limit: number = 50) {
    return this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
          select: {
            id: true,
            email: true,
            mobile: true,
            profileImage: true,
          },
        });

        return {
          partner,
          lastMessage,
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
}

