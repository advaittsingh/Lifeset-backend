import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '@/shared';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RegisterTokenDto } from './dto/register-token.dto';
import { SaveExpoTokenDto } from './dto/save-expo-token.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateNotificationMobileDto } from './dto/create-notification-mobile.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications' })
  async getNotifications(@CurrentUser() user: any, @Query() filters: any) {
    return this.notificationsService.getNotifications(user.id, filters);
  }

  @Post()
  @ApiOperation({ summary: 'Create notification (Mobile App)' })
  async createNotification(
    @CurrentUser() user: any,
    @Body() data: CreateNotificationMobileDto,
  ) {
    // User ID is automatically extracted from JWT token via @CurrentUser() decorator
    // Notification is associated with the authenticated user
    return this.notificationsService.createNotificationFromMobile(user.id, {
      title: data.title,
      message: data.message,
      type: data.type,
      data: data.data, // Additional data (used for push notifications, not stored in DB)
      isRead: data.isRead || false,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread count' })
  async getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Post('token')
  @ApiOperation({ summary: 'Register push notification token (FCM or Expo)' })
  async registerToken(
    @CurrentUser() user: any,
    @Body() data: RegisterTokenDto,
  ) {
    return this.notificationsService.registerToken(user.id, data.token, data.platform, data.deviceId);
  }

  @Post('save-push-token')
  @ApiOperation({ summary: 'Save Expo push token to user record' })
  async saveExpoPushToken(
    @CurrentUser() user: any,
    @Body() data: SaveExpoTokenDto,
  ) {
    return this.notificationsService.saveExpoPushToken(user.id, data.token);
  }

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Send push notification to users (CMS/Admin)' })
  async sendNotification(@Body() data: SendNotificationDto) {
    return this.notificationsService.sendNotification(data);
  }
}

