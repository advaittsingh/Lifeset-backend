import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationJobService } from './notification-job.service';
import { NotificationJobController } from './notification-job.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Module({
  imports: [PrismaModule, QueueModule, ConfigModule],
  providers: [NotificationsService, PushNotificationService, NotificationJobService, NotificationSchedulerService],
  controllers: [NotificationsController, NotificationJobController],
  exports: [NotificationsService, PushNotificationService, NotificationJobService],
})
export class NotificationsModule {}

