import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('adImpressions') private adImpressionsQueue: Queue,
  ) {}

  async getAdSlots() {
    return this.prisma.adSlot.findMany({
      where: { isActive: true },
    });
  }

  async trackImpression(adSlotId: string, userId?: string) {
    // Queue impression tracking
    await this.adImpressionsQueue.add('track-impression', {
      adSlotId,
      userId,
      timestamp: new Date(),
    });

    // Create impression record
    return this.prisma.adImpression.create({
      data: {
        adSlotId,
        userId,
      },
    });
  }

  async getAdAnalytics(adSlotId: string) {
    const impressions = await this.prisma.adImpression.count({
      where: { adSlotId },
    });

    return {
      adSlotId,
      impressions,
    };
  }
}

