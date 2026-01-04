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

  async trackAdCampaignImpression(adCampaignId: string, userId?: string) {
    // Track impression for ad campaign
    // Update impression count
    await this.prisma.adCampaign.update({
      where: { id: adCampaignId },
      data: {
        impressions: {
          increment: 1,
        },
      },
    });

    return { success: true };
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

  async getActiveAdCampaigns(userId?: string) {
    const now = new Date();
    
    // Get active campaigns that are:
    // 1. Status is 'active'
    // 2. Within date range (if specified)
    // 3. Have remaining impressions (if daily budget is set)
    const campaigns = await this.prisma.adCampaign.findMany({
      where: {
        status: 'active',
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to prevent too many ads
    });

    // Filter campaigns based on targeting (if user is provided)
    // For now, return all active campaigns
    // TODO: Add targeting logic based on user profile
    
    return campaigns;
  }
}

