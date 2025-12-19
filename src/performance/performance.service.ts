import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { TrackEngagementDto, EngagementType } from './dto/track-engagement.dto';
import { WeeklyMeterResponseDto, DayStatusDto } from './dto/weekly-meter.dto';
import { BadgeStatusResponseDto } from './dto/badge-status.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PerformanceService {
  private readonly eventWeights = {
    login: 10,
    feed_like: 5,
    feed_save: 10,
    feed_apply: 20,
    mcq_attempt: 15,
    mcq_correct: 25,
    community_post: 30,
    connection_request: 15,
    profile_view: 5,
  };

  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

  async calculateScore(userId: string): Promise<number> {
    const events = await this.prisma.userEvent.findMany({
      where: { userId },
    });

    let totalScore = 0;
    for (const event of events) {
      const weight = this.eventWeights[event.eventType] || 0;
      totalScore += weight;
    }

    // Update user score
    await this.prisma.userScore.upsert({
      where: { userId },
      create: {
        userId,
        totalScore,
        weeklyScore: 0,
        monthlyScore: 0,
      },
      update: {
        totalScore,
      },
    });

    return totalScore;
  }

  async getScore(userId: string) {
    let score = await this.prisma.userScore.findUnique({
      where: { userId },
    });

    if (!score) {
      const calculatedScore = await this.calculateScore(userId);
      score = await this.prisma.userScore.findUnique({
        where: { userId },
      });
    }

    return score;
  }

  async getWeeklyScore(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const events = await this.prisma.userEvent.findMany({
      where: {
        userId,
        createdAt: { gte: weekStart },
      },
    });

    let weeklyScore = 0;
    for (const event of events) {
      const weight = this.eventWeights[event.eventType] || 0;
      weeklyScore += weight;
    }

    // Update weekly score
    await this.prisma.userScore.update({
      where: { userId },
      data: { weeklyScore },
    });

    return { weeklyScore };
  }

  async getMonthlyScore(userId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const events = await this.prisma.userEvent.findMany({
      where: {
        userId,
        createdAt: { gte: monthStart },
      },
    });

    let monthlyScore = 0;
    for (const event of events) {
      const weight = this.eventWeights[event.eventType] || 0;
      monthlyScore += weight;
    }

    // Update monthly score
    await this.prisma.userScore.update({
      where: { userId },
      data: { monthlyScore },
    });

    return { monthlyScore };
  }

  async getScoreHistory(userId: string, period: 'daily' | 'weekly' | 'monthly') {
    return this.prisma.scoreHistory.findMany({
      where: {
        userId,
        period,
      },
      orderBy: { periodDate: 'desc' },
      take: 30,
    });
  }

  async getLeaderboard(limit: number = 100) {
    return this.prisma.userScore.findMany({
      orderBy: { totalScore: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            mobile: true,
            profileImage: true,
          },
        },
      },
    });
  }

  // ========== Daily Digest Engagement Tracking ==========
  async trackEngagement(userId: string, dto: TrackEngagementDto) {
    // Parse date or use today
    let engagementDate: Date;
    if (dto.date) {
      engagementDate = new Date(dto.date + 'T00:00:00.000Z');
    } else {
      engagementDate = new Date();
      engagementDate.setUTCHours(0, 0, 0, 0);
    }

    // Determine card type if not provided
    const cardType = dto.cardType || await this.inferCardType(dto.cardId);

    // Create engagement record
    const engagement = await this.prisma.dailyDigestEngagement.create({
      data: {
        userId,
        cardId: dto.cardId,
        cardType,
        engagementType: dto.type,
        duration: dto.duration || 0,
        isCorrect: dto.type === EngagementType.MCQ_ATTEMPT ? dto.isComplete : null,
        date: engagementDate,
      },
    });

    // Update daily engagement status
    await this.updateDailyEngagementStatus(userId, engagementDate);

    return {
      success: true,
      data: {
        id: engagement.id,
        engagementRecorded: true,
      },
    };
  }

  private async updateDailyEngagementStatus(
    userId: string,
    date: Date,
  ) {
    // Normalize date to start of day (UTC)
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Get all engagement records for this day
    const engagements = await this.prisma.dailyDigestEngagement.findMany({
      where: {
        userId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // Calculate stats
    const cardViews = engagements.filter(
      (e) => e.engagementType === 'CARD_VIEW' && e.duration >= 20,
    ).length;

    const mcqAttempts = engagements.filter(
      (e) => e.engagementType === 'MCQ_ATTEMPT',
    ).length;

    const mcqCorrect = engagements.filter(
      (e) => e.engagementType === 'MCQ_ATTEMPT' && e.isCorrect === true,
    ).length;

    const totalDuration = engagements
      .filter((e) => e.engagementType === 'CARD_VIEW')
      .reduce((sum, e) => sum + e.duration, 0);

    const mcqAccuracy =
      mcqAttempts > 0 ? (mcqCorrect / mcqAttempts) * 100 : 0;

    // Determine if present
    const isPresent =
      cardViews >= 1 || (mcqAttempts >= 1 && mcqAccuracy >= 50);

    // Upsert daily engagement status
    await this.prisma.dailyEngagementStatus.upsert({
      where: {
        userId_date: {
          userId,
          date: dayStart,
        },
      },
      create: {
        userId,
        date: dayStart,
        isPresent,
        cardViewCount: cardViews,
        mcqAttemptCount: mcqAttempts,
        mcqCorrectCount: mcqCorrect,
        mcqAccuracy: new Prisma.Decimal(mcqAccuracy.toFixed(2)),
        totalEngagementDuration: totalDuration,
      },
      update: {
        isPresent,
        cardViewCount: cardViews,
        mcqAttemptCount: mcqAttempts,
        mcqCorrectCount: mcqCorrect,
        mcqAccuracy: new Prisma.Decimal(mcqAccuracy.toFixed(2)),
        totalEngagementDuration: totalDuration,
      },
    });
  }

  private async inferCardType(cardId: string): Promise<string> {
    // Try to determine card type by checking different tables
    // Check if it's a Post (Current Affairs or General Knowledge)
    const post = await this.prisma.post.findUnique({
      where: { id: cardId },
      select: { postType: true, articleType: true },
    });

    if (post) {
      if (post.postType === 'CURRENT_AFFAIRS') {
        return 'CURRENT_AFFAIRS';
      }
      if (post.postType === 'COLLEGE_FEED' && post.articleType === 'GENERAL_KNOWLEDGE') {
        return 'GENERAL_KNOWLEDGE';
      }
    }

    // Check if it's an MCQ
    const mcq = await this.prisma.mcqQuestion.findUnique({
      where: { id: cardId },
    });

    if (mcq) {
      return 'MCQ';
    }

    // Default to CURRENT_AFFAIRS
    return 'CURRENT_AFFAIRS';
  }

  // ========== Weekly Performance Meter ==========
  async getWeeklyMeter(userId: string): Promise<WeeklyMeterResponseDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const sixDaysAgo = new Date(today);
    sixDaysAgo.setUTCDate(sixDaysAgo.getUTCDate() - 6);

    // Get engagement status for last 7 days
    const statuses = await this.prisma.dailyEngagementStatus.findMany({
      where: {
        userId,
        date: {
          gte: sixDaysAgo,
          lte: today,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Create a map of dates to statuses
    const statusMap = new Map<string, any>();
    statuses.forEach((status) => {
      const dateStr = status.date.toISOString().split('T')[0];
      statusMap.set(dateStr, status);
    });

    // Generate array of last 7 days
    const days: DayStatusDto[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const status = statusMap.get(dateStr);
      days.push({
        date: dateStr,
        isPresent: status?.isPresent || false,
        completed: status?.isPresent || false,
        cardViewCount: status?.cardViewCount || 0,
        mcqAttemptCount: status?.mcqAttemptCount || 0,
        mcqAccuracy: status?.mcqAccuracy ? Number(status.mcqAccuracy) : 0.0,
      });
    }

    const daysCompleted = days.filter((d) => d.isPresent).length;

    return {
      daysCompleted,
      days,
    };
  }

  // ========== User Badge Status ==========
  async getBadgeStatus(userId: string): Promise<BadgeStatusResponseDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);

    // Count active days in last 6 months
    const activeDaysCount = await this.prisma.dailyEngagementStatus.count({
      where: {
        userId,
        isPresent: true,
        date: {
          gte: sixMonthsAgo,
          lte: today,
        },
      },
    });

    // Determine badge based on days active
    const currentBadge = this.calculateBadge(activeDaysCount);

    // Update or create badge status
    await this.prisma.userBadgeStatus.upsert({
      where: { userId },
      create: {
        userId,
        currentBadge,
        daysActive: activeDaysCount,
        lastCalculatedAt: new Date(),
      },
      update: {
        currentBadge,
        daysActive: activeDaysCount,
        lastCalculatedAt: new Date(),
      },
    });

    return {
      currentBadge,
      daysActive: activeDaysCount,
    };
  }

  private calculateBadge(daysActive: number): string | null {
    if (daysActive >= 180) return 'legend';
    if (daysActive >= 150) return 'champion';
    if (daysActive >= 120) return 'elite';
    if (daysActive >= 90) return 'adventurer';
    if (daysActive >= 60) return 'explorer';
    if (daysActive >= 30) return 'rookie';
    return null;
  }
}

