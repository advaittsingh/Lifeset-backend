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
        
        // Support Redis URL format (Upstash, Railway, etc.)
        // Format: rediss://default:password@host:port or redis://default:password@host:port
        const redisUrl = configService.get('REDIS_URL') || configService.get('KV_URL');
        
        let redisConfig: any;
        
        if (redisUrl) {
          // Parse Redis URL
          // Supports formats:
          // - redis://host:port (no password)
          // - redis://password@host:port
          // - redis://user:password@host:port
          // - rediss://host:port (TLS, no password)
          // - rediss://password@host:port (TLS with password)
          const urlMatch = redisUrl.match(/^(rediss?):\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:]+):(\d+)$/);
          
          if (urlMatch) {
            const [, protocol, username, password, host, port] = urlMatch;
            redisConfig = {
              host,
              port: Number(port),
              password: password || undefined,
              tls: protocol === 'rediss', // Use TLS for rediss://
              retryStrategy: (times: number) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
              },
              maxRetriesPerRequest: 3,
              enableReadyCheck: true,
              lazyConnect: true,
            };
            logger.log(`Using Redis URL connection: ${host}:${port} (TLS: ${protocol === 'rediss'}, Password: ${password ? 'Yes' : 'No'})`);
          } else {
            logger.warn(`Invalid Redis URL format: ${redisUrl}. Falling back to host/port configuration.`);
            // Fall back to host/port configuration
            const host = configService.get('REDIS_HOST', 'localhost');
            const port = configService.get('REDIS_PORT', 6379);
            const password = configService.get('REDIS_PASSWORD');
            redisConfig = {
              host,
              port: Number(port),
              password: password || undefined,
              retryStrategy: (times: number) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
              },
              maxRetriesPerRequest: 3,
              enableReadyCheck: true,
              lazyConnect: true,
            };
          }
        } else {
          // Use traditional host/port configuration
          const host = configService.get('REDIS_HOST', 'localhost');
          const port = configService.get('REDIS_PORT', 6379);
          const password = configService.get('REDIS_PASSWORD');
          redisConfig = {
            host,
            port: Number(port),
            password: password || undefined,
            retryStrategy: (times: number) => {
              const delay = Math.min(times * 50, 2000);
              return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
          };
        }

        const redisClient = new Redis(redisConfig);

        redisClient.on('connect', () => {
          logger.log(`Connecting to Redis at ${redisConfig.host}:${redisConfig.port}`);
        });

        redisClient.on('ready', () => {
          logger.log(`Redis connection established successfully at ${redisConfig.host}:${redisConfig.port}`);
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

