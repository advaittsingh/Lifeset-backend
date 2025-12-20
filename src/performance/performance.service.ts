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
    // Track card views (duration >= 20 seconds) and MCQ attempts (accuracy >= 50%)
    // Store engagement data in UserEvent table
    
    const eventType = dto.type === EngagementType.CARD_VIEW ? 'feed_view' : 'mcq_attempt';
    const date = dto.date ? new Date(dto.date) : new Date();
    
    // For CARD_VIEW: track if duration >= 20 seconds
    if (dto.type === EngagementType.CARD_VIEW && dto.duration && dto.duration >= 20) {
      await this.prisma.userEvent.create({
        data: {
          userId,
          eventType: 'feed_view',
          metadata: {
            cardId: dto.cardId,
            duration: dto.duration,
            cardType: dto.cardType,
          },
          createdAt: date,
        },
      });
    }
    
    // For MCQ_ATTEMPT: track if isComplete (accuracy >= 50%)
    if (dto.type === EngagementType.MCQ_ATTEMPT && dto.isComplete) {
      await this.prisma.userEvent.create({
        data: {
          userId,
          eventType: 'mcq_attempt',
          metadata: {
            cardId: dto.cardId,
            isCorrect: dto.isComplete,
            cardType: dto.cardType,
          },
          createdAt: date,
        },
      });
    }

    return { success: true, message: 'Engagement tracked successfully' };
  }

  // ========== Weekly Performance Meter ==========
  async getWeeklyMeter(userId: string): Promise<WeeklyMeterResponseDto> {
    // Get last 7 days engagement status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Last 7 days including today
    
    // Get all events in last 7 days
    const events = await this.prisma.userEvent.findMany({
      where: {
        userId,
        createdAt: {
          gte: sevenDaysAgo,
          lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1), // End of today
        },
      },
    });

    // Group events by date
    const daysMap = new Map<string, { cardViews: number; mcqAttempts: number; correctMcqs: number }>();
    
    // Initialize all 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      daysMap.set(dateStr, { cardViews: 0, mcqAttempts: 0, correctMcqs: 0 });
    }

    // Count events per day
    events.forEach(event => {
      const dateStr = event.createdAt.toISOString().split('T')[0];
      const dayData = daysMap.get(dateStr);
      if (dayData) {
        if (event.eventType === 'feed_view') {
          dayData.cardViews++;
        } else if (event.eventType === 'mcq_attempt') {
          dayData.mcqAttempts++;
          if (event.metadata && (event.metadata as any).isCorrect) {
            dayData.correctMcqs++;
          }
        }
      }
    });

    // Build response
    const days: DayStatusDto[] = [];
    let daysCompleted = 0;

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = daysMap.get(dateStr) || { cardViews: 0, mcqAttempts: 0, correctMcqs: 0 };
      
      const isPresent = dayData.cardViews > 0 || dayData.mcqAttempts > 0;
      const mcqAccuracy = dayData.mcqAttempts > 0 
        ? (dayData.correctMcqs / dayData.mcqAttempts) * 100 
        : 0;

      if (isPresent) daysCompleted++;

      days.push({
        date: dateStr,
        isPresent,
        completed: isPresent,
        cardViewCount: dayData.cardViews,
        mcqAttemptCount: dayData.mcqAttempts,
        mcqAccuracy: Math.round(mcqAccuracy * 100) / 100,
      });
    }

    return {
      daysCompleted,
      days,
    };
  }

  // ========== User Badge Status ==========
  async getBadgeStatus(userId: string): Promise<BadgeStatusResponseDto> {
    // Calculate badge based on 6-month activity
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Get all events in last 6 months
    const events = await this.prisma.userEvent.findMany({
      where: {
        userId,
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
    });

    // Count unique active days
    const activeDays = new Set<string>();
    events.forEach(event => {
      const dateStr = event.createdAt.toISOString().split('T')[0];
      activeDays.add(dateStr);
    });

    const daysActive = activeDays.size;

    // Determine badge based on days active
    let currentBadge: string | null = null;
    if (daysActive >= 150) {
      currentBadge = 'legend';
    } else if (daysActive >= 120) {
      currentBadge = 'champion';
    } else if (daysActive >= 90) {
      currentBadge = 'elite';
    } else if (daysActive >= 60) {
      currentBadge = 'adventurer';
    } else if (daysActive >= 30) {
      currentBadge = 'explorer';
    } else if (daysActive >= 1) {
      currentBadge = 'rookie';
    }

    return {
      currentBadge,
      daysActive,
    };
  }
}

