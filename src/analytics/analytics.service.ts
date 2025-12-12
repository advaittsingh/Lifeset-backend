import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @InjectQueue('analytics') private analyticsQueue: Queue,
  ) {}

  async trackEvent(
    userId: string,
    eventType: string,
    entityType?: string,
    entityId?: string,
    metadata?: any,
  ) {
    // Store in database
    await this.prisma.userEvent.create({
      data: {
        userId,
        eventType,
        entityType,
        entityId,
        metadata: metadata || {},
      },
    });

    // Increment counter in Redis
    const counterKey = `event:${eventType}`;
    await this.redis.increment(counterKey);

    // Queue for further processing
    await this.analyticsQueue.add('process-event', {
      userId,
      eventType,
      entityType,
      entityId,
      metadata,
    });
  }

  async getEventCount(eventType: string): Promise<number> {
    const count = await this.redis.get(`event:${eventType}`);
    return count ? parseInt(count, 10) : 0;
  }

  async getUserEvents(userId: string, filters?: any) {
    const where: any = { userId };
    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters?.startDate) {
      where.createdAt = { gte: filters.startDate };
    }
    if (filters?.endDate) {
      where.createdAt = { ...where.createdAt, lte: filters.endDate };
    }

    return this.prisma.userEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }
}

