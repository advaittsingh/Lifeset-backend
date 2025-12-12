import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PerformanceService } from './performance.service';
import { BadgeTier } from '@/shared';

@Injectable()
export class BadgesService {
  constructor(
    private prisma: PrismaService,
    private performanceService: PerformanceService,
  ) {}

  async getAllBadges() {
    return this.prisma.badge.findMany({
      orderBy: [
        { tier: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async checkBadgeEligibility(userId: string) {
    const score = await this.performanceService.getScore(userId);
    const userEvents = await this.prisma.userEvent.findMany({
      where: { userId },
    });

    const badges = await this.prisma.badge.findMany();
    const earnedBadges: any[] = [];

    for (const badge of badges) {
      const criteria = badge.criteria as any;
      let eligible = false;

      // Score-based badges
      if (criteria.score && score.totalScore >= criteria.score) {
        eligible = true;
      }

      // Streak-based badges
      if (criteria.streak) {
        const loginEvents = userEvents.filter(e => e.eventType === 'login');
        // Calculate streak logic here
        // For now, just check if there are enough login events
        if (loginEvents.length >= criteria.streak) {
          eligible = true;
        }
      }

      // Engagement-based badges
      if (criteria.engagement) {
        const connections = userEvents.filter(e => e.eventType === 'connection_request').length;
        const posts = userEvents.filter(e => e.eventType === 'feed_apply').length;
        const mcqAttempts = userEvents.filter(e => e.eventType === 'mcq_attempt').length;

        if (criteria.engagement.connections && connections >= criteria.engagement.connections) {
          eligible = true;
        }
        if (criteria.engagement.posts && posts >= criteria.engagement.posts) {
          eligible = true;
        }
        if (criteria.engagement.mcqAttempts && mcqAttempts >= criteria.engagement.mcqAttempts) {
          eligible = true;
        }
      }

      if (eligible) {
        const existing = await this.prisma.userBadge.findUnique({
          where: {
            userId_badgeId: {
              userId,
              badgeId: badge.id,
            },
          },
        });

        if (!existing) {
          const earned = await this.prisma.userBadge.create({
            data: {
              userId,
              badgeId: badge.id,
            },
          });

          earnedBadges.push(earned);
        }
      }
    }

    return earnedBadges;
  }

  async getBadgeProgress(userId: string, badgeId: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
    });

    if (!badge) {
      return null;
    }

    const userBadge = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });

    const criteria = badge.criteria as any;
    const score = await this.performanceService.getScore(userId);
    const userEvents = await this.prisma.userEvent.findMany({
      where: { userId },
    });

    let progress = 0;
    let current = 0;
    let target = 0;

    if (criteria.score) {
      current = score.totalScore;
      target = criteria.score;
      progress = Math.min(100, (current / target) * 100);
    }

    return {
      badge,
      earned: !!userBadge,
      progress: Math.round(progress),
      current,
      target,
    };
  }
}

