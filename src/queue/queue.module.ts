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
      useFactory: async (configService: ConfigService) => {
        // Support Redis URL format (Upstash, Railway, etc.)
        const redisUrl = configService.get('REDIS_URL') || configService.get('KV_URL');
        
        let connection: any;
        
        if (redisUrl) {
          // Parse Redis URL: rediss://default:password@host:port
          const urlMatch = redisUrl.match(/^(rediss?):\/\/(?:[^:]+:)?([^@]+)@([^:]+):(\d+)$/);
          
          if (urlMatch) {
            const [, protocol, password, host, port] = urlMatch;
            connection = {
              host,
              port: Number(port),
              password: password || undefined,
              tls: protocol === 'rediss', // Use TLS for rediss://
            };
          } else {
            // Fall back to host/port
            connection = {
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
              password: configService.get('REDIS_PASSWORD'),
            };
          }
        } else {
          connection = {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
          };
        }
        
        return { connection };
      },
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

