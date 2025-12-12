import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { AdImpressionProcessor } from './processors/ad-impression.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'analytics' },
      { name: 'adImpressions' },
      { name: 'email' },
      { name: 'sms' },
    ),
  ],
  providers: [
    EmailProcessor,
    SmsProcessor,
    NotificationProcessor,
    AnalyticsProcessor,
    AdImpressionProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}

