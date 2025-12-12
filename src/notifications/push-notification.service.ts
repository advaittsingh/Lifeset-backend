import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as admin from 'firebase-admin';

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const projectId = this.configService.get('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');

    if (projectId && privateKey && clientEmail) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });
    }
  }

  async sendPushNotification(userId: string, notification: {
    title: string;
    body: string;
    data?: any;
  }) {
    if (!this.firebaseApp) {
      console.warn('Firebase not initialized');
      return;
    }

    // Get user's notification tokens
    const tokens = await this.getUserTokens(userId);

    if (tokens.length === 0) {
      return { success: false, message: 'No tokens found' };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };

    try {
      const response = await admin.messaging(this.firebaseApp).sendEachForMulticast(message);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  private async getUserTokens(userId: string): Promise<string[]> {
    // Get from database
    const tokens = await this.prisma.notificationToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    return tokens.map((t) => t.token);
  }
}

