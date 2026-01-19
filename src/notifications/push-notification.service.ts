import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private firebaseApp: admin.app.App;
  private expo: Expo;
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Initialize Expo SDK
    this.expo = new Expo();
  }

  async onModuleInit() {
    try {
      // Try loading from JSON file first (preferred method)
      const firebaseServiceAccountPath = this.configService.get('FIREBASE_SERVICE_ACCOUNT_PATH');
      
      if (firebaseServiceAccountPath) {
        // Resolve path (could be relative or absolute)
        const resolvedPath = path.isAbsolute(firebaseServiceAccountPath)
          ? firebaseServiceAccountPath
          : path.join(process.cwd(), firebaseServiceAccountPath);
        
        // Check if file exists
        if (fs.existsSync(resolvedPath)) {
          // Load from JSON file
          const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          console.log('✅ Firebase Admin SDK initialized from JSON file:', resolvedPath);
          return;
        } else {
          console.warn(`⚠️  Firebase service account file not found: ${resolvedPath}`);
        }
      }

      // Fall back to environment variables
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
        console.log('✅ Firebase Admin SDK initialized from environment variables');
      } else {
        console.warn('⚠️  Firebase Admin SDK not initialized: Missing configuration. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL');
      }
    } catch (error: any) {
      console.error('❌ Error initializing Firebase Admin SDK:', error.message);
      // Don't throw error, allow app to continue without Firebase
    }
  }

  async sendPushNotification(userId: string, notification: {
    title: string;
    body: string;
    data?: any;
    image?: string;
    redirectUrl?: string;
  }) {
    // Get user's Expo push token
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });

    // Get FCM tokens (legacy)
    const fcmTokens = await this.getUserTokens(userId);

    const results: any = {
      success: true,
      expo: null,
      fcm: null,
    };

    // Send Expo push notification if token exists
    if (user?.expoPushToken) {
      try {
        const expoResult = await this.sendExpoNotification(user.expoPushToken, {
          ...notification,
          // Map redirectUrl to data if provided
          data: {
            ...(notification.data || {}),
            ...(notification.redirectUrl && { redirectUrl: notification.redirectUrl }),
          },
        });
        results.expo = expoResult;
      } catch (error: any) {
        this.logger.error(`Failed to send Expo notification: ${error.message}`);
        results.expo = { success: false, error: error.message };
      }
    }

    // Send FCM push notifications if tokens exist (legacy)
    if (fcmTokens.length > 0 && this.firebaseApp) {
      try {
        const fcmResult = await this.sendFCMNotification(fcmTokens, notification);
        results.fcm = fcmResult;
      } catch (error: any) {
        this.logger.error(`Failed to send FCM notification: ${error.message}`);
        results.fcm = { success: false, error: error.message };
      }
    }

    if (!user?.expoPushToken && fcmTokens.length === 0) {
      return { success: false, message: 'No tokens found' };
    }

    return results;
  }

  private async sendExpoNotification(
    token: string,
    notification: {
      title: string;
      body: string;
      data?: any;
      image?: string;
      redirectUrl?: string;
    },
  ) {
    // Validate Expo token
    if (!Expo.isExpoPushToken(token)) {
      throw new Error(`Invalid Expo push token: ${token}`);
    }

    this.logger.log(`🖼️  Single notification - Image: ${notification.image ? 'Present' : 'Missing'}, redirectUrl: ${notification.redirectUrl ? 'Present' : 'Missing'}`);
    
    const messages = [
      {
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: {
          ...(notification.data || {}),
          ...(notification.redirectUrl && { redirectUrl: notification.redirectUrl }),
        },
        ...(notification.image && { image: notification.image }),
      },
    ];
    
    if (notification.image) {
      this.logger.log(`✅ Adding image to single Expo notification: ${notification.image.substring(0, 50)}...`);
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error: any) {
        this.logger.error(`Error sending Expo notification chunk: ${error.message}`);
        throw error;
      }
    }

    // Check for errors in tickets
    const errors = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error') {
        errors.push({
          token: messages[i].to,
          error: ticket.message,
        });
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Expo notification errors: ${JSON.stringify(errors)}`);
    }

    return {
      success: true,
      ticketsCount: tickets.length,
      errorsCount: errors.length,
      errors,
    };
  }

  private async sendFCMNotification(
    tokens: string[],
    notification: {
      title: string;
      body: string;
      data?: any;
      image?: string;
      imageUrl?: string;
      redirectUrl?: string;
    },
  ) {
    if (!this.firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    const imageValue = notification.imageUrl || notification.image;
    this.logger.log(`🖼️  FCM Notification - Image: ${imageValue ? 'Present' : 'Missing'}, redirectUrl: ${notification.redirectUrl ? 'Present' : 'Missing'}`);

    // Convert all data values to strings (FCM requirement)
    const stringifiedData: Record<string, string> = {};
    const dataPayload: Record<string, any> = {
      ...(notification.data || {}),
      ...(imageValue && { image: imageValue }),
      ...(notification.redirectUrl && { redirectUrl: notification.redirectUrl }),
    };
    Object.keys(dataPayload).forEach((key) => {
      stringifiedData[key] =
        typeof dataPayload[key] === 'string'
          ? dataPayload[key]
          : JSON.stringify(dataPayload[key]);
    });

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(imageValue && { imageUrl: imageValue }),
      },
      data: stringifiedData,
      tokens: tokens,
      // Android-specific image configuration
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'default',
          sound: 'default',
          ...(imageValue && { imageUrl: imageValue }), // Android-specific image field
        },
      },
      // iOS-specific image configuration (required for images to display)
      ...(imageValue && {
        apns: {
          headers: {
            'mutable-content': '1', // Required for iOS Notification Service Extension
          },
          payload: {
            aps: {
              mutableContent: true,
              sound: 'default',
            },
          },
          fcmOptions: {
            imageUrl: imageValue, // iOS-specific image field
          },
        },
      }),
    };
    
    if (imageValue) {
      this.logger.log(`✅ Adding image to FCM notification (Android + iOS): ${imageValue.substring(0, 50)}...`);
      this.logger.log(`   - Android: android.notification.imageUrl`);
      this.logger.log(`   - iOS: apns.fcm_options.imageUrl + mutable-content header`);
    }

    const response = await admin.messaging(this.firebaseApp).sendEachForMulticast(message);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
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

  private buildNotificationMessage(
    tokens: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      redirectUrl?: string;
      imageUrl?: string;
    },
  ): admin.messaging.MulticastMessage {
    // Prepare data payload
    const dataPayload: Record<string, any> = {
      ...(notification.data || {}),
      ...(notification.redirectUrl && { redirectUrl: notification.redirectUrl }),
      ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
    };

    // Convert all data values to strings (FCM requirement)
    const stringifiedData: Record<string, string> = {};
    Object.keys(dataPayload).forEach((key) => {
      stringifiedData[key] =
        typeof dataPayload[key] === 'string'
          ? dataPayload[key]
          : JSON.stringify(dataPayload[key]);
    });

    return {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data: stringifiedData,
      tokens: tokens,
      apns: notification.imageUrl
        ? {
            payload: {
              aps: {
                mutableContent: true,
                sound: 'default',
              },
            },
            fcmOptions: {
              imageUrl: notification.imageUrl,
            },
          }
        : undefined,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'default',
          sound: 'default',
          ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        },
      },
    };
  }

  async sendPushNotificationToUsers(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      redirectUrl?: string;
      imageUrl?: string;
    },
  ) {
    if (!userIds || userIds.length === 0) {
      return { success: false, message: 'No user IDs provided' };
    }

    // Get users with Expo tokens
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        expoPushToken: { not: null },
      },
      select: { id: true, expoPushToken: true },
    });

    this.logger.log(`📊 Found ${users.length} users with Expo tokens out of ${userIds.length} requested users`);

    // Get FCM tokens (legacy)
    const fcmTokens = await this.getUserTokensBatch(userIds);

    const results: any = {
      success: true,
      expo: null,
      fcm: null,
    };

    // Send Expo notifications
    if (users.length > 0) {
      const expoTokens = users.map((u) => u.expoPushToken).filter(Boolean) as string[];
      this.logger.log(`📤 Sending Expo notifications to ${expoTokens.length} tokens`);
      this.logger.debug(`Tokens: ${expoTokens.slice(0, 3).map(t => t.substring(0, 30) + '...').join(', ')}${expoTokens.length > 3 ? ` (${expoTokens.length - 3} more)` : ''}`);
      
      try {
        const expoResult = await this.sendExpoNotificationsBatch(expoTokens, notification);
        this.logger.log(`✅ Expo push result: ${expoResult.successCount} successful, ${expoResult.errorsCount} errors`);
        if (expoResult.errorsCount > 0) {
          this.logger.warn(`⚠️  Expo push errors: ${JSON.stringify(expoResult.errors)}`);
        }
        results.expo = expoResult;
      } catch (error: any) {
        this.logger.error(`❌ Failed to send Expo notifications: ${error.message}`, error.stack);
        results.expo = { success: false, error: error.message };
      }
    } else {
      this.logger.warn(`⚠️  No users with Expo tokens found for ${userIds.length} requested users`);
    }

    // Send FCM notifications (legacy)
    if (fcmTokens.length > 0 && this.firebaseApp) {
      try {
        // Map imageUrl to image for FCM compatibility
        const fcmNotification = {
          ...notification,
          image: notification.imageUrl,
        };
        const fcmResult = await this.sendFCMNotification(fcmTokens, fcmNotification);
        results.fcm = fcmResult;
      } catch (error: any) {
        this.logger.error(`Failed to send FCM notifications: ${error.message}`);
        results.fcm = { success: false, error: error.message };
      }
    }

    if (users.length === 0 && fcmTokens.length === 0) {
      return { success: false, message: 'No tokens found for the provided users' };
    }

    return results;
  }

  private async getUserTokensBatch(userIds: string[]): Promise<string[]> {
    // Get tokens for multiple users
    const tokens = await this.prisma.notificationToken.findMany({
      where: {
        userId: {
          in: userIds,
        },
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    return tokens.map((t) => t.token);
  }

  async sendPushNotificationToAll(notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
    redirectUrl?: string;
    imageUrl?: string;
  }) {
    // Get all users with Expo tokens
    const users = await this.prisma.user.findMany({
      where: {
        expoPushToken: { not: null },
      },
      select: { expoPushToken: true },
    });

    // Get all active FCM tokens (legacy)
    const fcmTokens = await this.prisma.notificationToken.findMany({
      where: {
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    const results: any = {
      success: true,
      expo: null,
      fcm: null,
    };

    // Send Expo notifications
    if (users.length > 0) {
      const expoTokens = users.map((u) => u.expoPushToken).filter(Boolean) as string[];
      try {
        const expoResult = await this.sendExpoNotificationsBatch(expoTokens, notification);
        results.expo = expoResult;
      } catch (error: any) {
        this.logger.error(`Failed to send Expo notifications: ${error.message}`);
        results.expo = { success: false, error: error.message };
      }
    }

    // Send FCM notifications (legacy)
    if (fcmTokens.length > 0 && this.firebaseApp) {
      const tokenList = fcmTokens.map((t) => t.token);
      try {
        // Map imageUrl to image for FCM compatibility
        const fcmNotification = {
          ...notification,
          image: notification.imageUrl,
        };
        const fcmResult = await this.sendFCMNotification(tokenList, fcmNotification);
        results.fcm = fcmResult;
      } catch (error: any) {
        this.logger.error(`Failed to send FCM notifications: ${error.message}`);
        results.fcm = { success: false, error: error.message };
      }
    }

    if (users.length === 0 && fcmTokens.length === 0) {
      return { success: false, message: 'No active tokens found' };
    }

    return results;
  }

  private async sendExpoNotificationsBatch(
    tokens: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      redirectUrl?: string;
      imageUrl?: string;
      image?: string; // Support both imageUrl and image for compatibility
    },
  ) {
    // Filter out invalid tokens
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    const invalidTokens = tokens.filter((token) => !Expo.isExpoPushToken(token));

    this.logger.log(`📋 Token validation: ${validTokens.length} valid, ${invalidTokens.length} invalid`);

    if (invalidTokens.length > 0) {
      this.logger.warn(`⚠️  Invalid Expo tokens found: ${invalidTokens.slice(0, 3).join(', ')}${invalidTokens.length > 3 ? '...' : ''}`);
    }

    if (validTokens.length === 0) {
      this.logger.error(`❌ No valid Expo tokens to send to`);
      return { success: false, message: 'No valid Expo tokens', invalidTokens: invalidTokens.length };
    }

    const imageValue = notification.imageUrl || notification.image;
    this.logger.log(`🖼️  Image value: ${imageValue ? 'Present' : 'Missing'}, redirectUrl: ${notification.redirectUrl ? 'Present' : 'Missing'}`);
    
    const messages = validTokens.map((token) => {
      const message: any = {
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: {
          ...(notification.data || {}),
          ...(notification.redirectUrl && { redirectUrl: notification.redirectUrl }),
        },
      };
      
      // Support both imageUrl and image for compatibility - add image at top level for Expo
      if (imageValue) {
        message.image = imageValue;
        this.logger.log(`✅ Adding image to Expo message: ${imageValue.substring(0, 50)}...`);
      }
      
      return message;
    });

    this.logger.log(`📨 Preparing ${messages.length} messages for Expo Push API...`);

    const chunks = this.expo.chunkPushNotifications(messages);
    this.logger.log(`📦 Split into ${chunks.length} chunks (Expo API limit)`);
    
    const tickets = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        this.logger.log(`📤 Sending chunk ${i + 1}/${chunks.length} (${chunk.length} messages) to Expo Push API...`);
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        this.logger.log(`✅ Chunk ${i + 1} sent, received ${ticketChunk.length} tickets`);
        
        // Log full ticket details for debugging
        ticketChunk.forEach((ticket, idx) => {
          if (ticket.status === 'error') {
            this.logger.error(`❌ Expo ticket error [${idx}]: ${JSON.stringify(ticket)}`);
          } else if (ticket.status === 'ok') {
            this.logger.log(`✅ Expo ticket success [${idx}]: ID=${ticket.id}`);
          } else {
            this.logger.warn(`⚠️  Expo ticket unknown status [${idx}]: ${JSON.stringify(ticket)}`);
          }
        });
      } catch (error: any) {
        this.logger.error(`❌ Error sending Expo notification chunk ${i + 1}: ${error.message}`, error.stack);
        throw error;
      }
    }

    // Check for errors in tickets
    const errors = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error') {
        errors.push({
          token: messages[i].to.substring(0, 30) + '...',
          error: ticket.message,
        });
        this.logger.warn(`⚠️  Expo push error for token: ${ticket.message}`);
      }
    }

    const successCount = tickets.filter((t) => t.status === 'ok').length;
    this.logger.log(`📊 Expo Push Summary: ${successCount} successful, ${errors.length} errors out of ${tickets.length} total`);

    return {
      success: true,
      ticketsCount: tickets.length,
      successCount,
      errorsCount: errors.length,
      errors,
      invalidTokensCount: invalidTokens.length,
    };
  }
}

