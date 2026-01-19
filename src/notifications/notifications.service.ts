import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationType } from '@/shared';
import { PushNotificationService } from './push-notification.service';
import { mapFrontendTypeToDatabaseType } from './utils/notification-type-mapper';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private pushNotificationService: PushNotificationService,
  ) {}

  async createNotification(userId: string, data: {
    title: string;
    message: string;
    type: NotificationType;
    jobId?: string;
    notificationData?: Record<string, any>; // Additional data to include in push notification
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        jobId: data.jobId,
      },
    });

    // Send push notification with data
    await this.pushNotificationService.sendPushNotification(userId, {
      title: data.title,
      body: data.message,
      data: { 
        type: data.type,
        jobId: data.jobId,
        ...(data.notificationData || {}), // Merge additional data
      },
    });

    return notification;
  }

  /**
   * Create notification from mobile app
   * User ID is extracted from JWT token by the controller
   */
  async createNotificationFromMobile(userId: string, data: {
    title: string;
    message: string;
    type: NotificationType;
    data?: Record<string, any>; // Additional data from mobile app
    isRead?: boolean; // Whether notification is already read
  }) {
    // Create notification record in database
    const notification = await this.prisma.notification.create({
      data: {
        userId, // User ID from JWT token
        title: data.title,
        message: data.message,
        type: data.type,
        isRead: data.isRead || false,
      },
    });

    // Note: We don't send push notification here because the mobile app
    // is creating the notification record itself (likely after receiving a push)
    // If push notification is needed, it should be sent separately

    return notification;
  }

  async getNotifications(userId: string, filters?: {
    isRead?: boolean;
    type?: NotificationType | string;
    page?: number;
    limit?: number;
  }) {
    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }
    if (filters?.type) {
      // Map frontend type names (e.g., "current-affairs", "ca", "gk") to database enum values
      // If already in database format, use as-is
      const mappedType = mapFrontendTypeToDatabaseType(String(filters.type));
      if (mappedType) {
        where.type = mappedType;
      } else {
        // Fallback: use the type as-is (might be already in database format)
        where.type = filters.type;
      }
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
    this.logger.log(`Registering push token for user ${userId}, platform: ${platform}, deviceId: ${deviceId || 'none'}`);
    
    // Validate platform
    if (platform !== 'ios' && platform !== 'android') {
      throw new BadRequestException(`Invalid platform: ${platform}. Must be 'ios' or 'android'`);
    }

    // Validate token
    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Token is required and cannot be empty');
    }

    // Check if this is an Expo push token (starts with "ExponentPushToken[...]")
    const isExpoToken = token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
    
    if (isExpoToken) {
      // Save Expo token to user record
      await this.prisma.user.update({
        where: { id: userId },
        data: { expoPushToken: token },
      });
      
      this.logger.log(`✅ Expo push token saved to user record for user ${userId}`);
      return {
        success: true,
        message: 'Expo push token registered successfully',
        tokenType: 'expo',
        platform,
      };
    }

    // Handle FCM tokens (legacy)
    try {
      // Delete existing token if exists (to avoid duplicates)
      const deleted = await this.prisma.notificationToken.deleteMany({
        where: {
          userId,
          token,
        },
      });
      
      if (deleted.count > 0) {
        this.logger.log(`Deleted ${deleted.count} existing token(s) for user ${userId}`);
      }

      // Create new token
      const notificationToken = await this.prisma.notificationToken.create({
        data: {
          userId,
          token,
          platform,
          deviceId,
          isActive: true,
        },
      });

      this.logger.log(`✅ FCM token registered successfully for user ${userId}, token ID: ${notificationToken.id}`);
      return {
        success: true,
        message: 'Token registered successfully',
        tokenId: notificationToken.id,
        platform: notificationToken.platform,
        tokenType: 'fcm',
      };
    } catch (error: any) {
      this.logger.error(`Failed to register FCM token for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to register token: ${error.message}`);
    }
  }

  async saveExpoPushToken(userId: string, token: string) {
    this.logger.log(`Saving Expo push token for user ${userId}`);
    
    // Validate token
    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Token is required and cannot be empty');
    }

    // Validate Expo token format
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      throw new BadRequestException('Invalid Expo push token format. Token must start with "ExponentPushToken[" or "ExpoPushToken["');
    }

    try {
      // Update user's Expo push token
      await this.prisma.user.update({
        where: { id: userId },
        data: { expoPushToken: token },
      });

      this.logger.log(`✅ Expo push token saved successfully for user ${userId}`);
      return {
        success: true,
        message: 'Expo push token saved successfully',
      };
    } catch (error: any) {
      this.logger.error(`Failed to save Expo push token for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to save Expo push token: ${error.message}`);
    }
  }

  async sendNotification(data: {
    userIds?: string[];
    notification: { title: string; body: string };
    data?: Record<string, any>;
    redirectUrl?: string;
    imageUrl?: string;
  }) {
    if (!data.userIds || data.userIds.length === 0) {
      // Send to all users if no userIds provided
      return this.pushNotificationService.sendPushNotificationToAll({
        title: data.notification.title,
        body: data.notification.body,
        data: data.data,
        redirectUrl: data.redirectUrl,
        imageUrl: data.imageUrl,
      });
    }

    // Send to specific users
    return this.pushNotificationService.sendPushNotificationToUsers(data.userIds, {
      title: data.notification.title,
      body: data.notification.body,
      data: data.data,
      redirectUrl: data.redirectUrl,
      imageUrl: data.imageUrl,
    });
  }
}

