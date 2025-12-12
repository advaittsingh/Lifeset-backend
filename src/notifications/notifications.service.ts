import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationType } from '@/shared';
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private pushNotificationService: PushNotificationService,
  ) {}

  async createNotification(userId: string, data: {
    title: string;
    message: string;
    type: NotificationType;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
      },
    });

    // Send push notification
    await this.pushNotificationService.sendPushNotification(userId, {
      title: data.title,
      body: data.message,
      data: { type: data.type },
    });

    return notification;
  }

  async getNotifications(userId: string, filters?: {
    isRead?: boolean;
    type?: NotificationType;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }
    if (filters?.type) {
      where.type = filters.type;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async registerToken(userId: string, token: string, platform: string, deviceId?: string) {
    // Delete existing token if exists
    await this.prisma.notificationToken.deleteMany({
      where: {
        userId,
        token,
      },
    });

    // Create new token
    return this.prisma.notificationToken.create({
      data: {
        userId,
        token,
        platform,
        deviceId,
        isActive: true,
      },
    });
  }
}

