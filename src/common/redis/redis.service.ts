import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private async ensureConnected(): Promise<void> {
    if (this.redis.status !== 'ready' && this.redis.status !== 'connect') {
      try {
        await this.redis.connect();
      } catch (error) {
        this.logger.warn(`Redis connection failed: ${error.message}. Continuing without Redis.`);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnected();
      return this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Redis get failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      await this.ensureConnected();
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      this.logger.warn(`Redis set failed for key ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Redis del failed for key ${key}: ${error.message}`);
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      await this.ensureConnected();
      return this.redis.incrby(key, value);
    } catch (error) {
      this.logger.warn(`Redis increment failed for key ${key}: ${error.message}`);
      return 0;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      await this.ensureConnected();
      return this.redis.decrby(key, value);
    } catch (error) {
      this.logger.warn(`Redis decrement failed for key ${key}: ${error.message}`);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnected();
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.warn(`Redis exists failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.warn(`Redis expire failed for key ${key}: ${error.message}`);
    }
  }
}

