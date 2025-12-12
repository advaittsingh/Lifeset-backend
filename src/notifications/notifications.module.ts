import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [PrismaModule, QueueModule, ConfigModule],
  providers: [NotificationsService, PushNotificationService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushNotificationService],
})
export class NotificationsModule {}

