import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

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
}

