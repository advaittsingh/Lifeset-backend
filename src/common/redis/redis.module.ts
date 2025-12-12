import { Module, Global, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const host = configService.get('REDIS_HOST', 'localhost');
        const port = configService.get('REDIS_PORT', 6379);
        const password = configService.get('REDIS_PASSWORD');

        const redisClient = new Redis({
          host,
          port: Number(port),
          password: password || undefined,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true, // Lazy connect to prevent blocking app initialization
        });

        redisClient.on('connect', () => {
          logger.log(`Connecting to Redis at ${host}:${port}`);
        });

        redisClient.on('ready', () => {
          logger.log(`Redis connection established successfully at ${host}:${port}`);
        });

        redisClient.on('error', (error) => {
          logger.error(`Redis connection error: ${error.message}`, error.stack);
        });

        redisClient.on('close', () => {
          logger.warn('Redis connection closed');
        });

        redisClient.on('reconnecting', () => {
          logger.log('Redis reconnecting...');
        });

        return redisClient;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}

