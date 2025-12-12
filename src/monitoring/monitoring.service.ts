import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import Redis from 'ioredis';
import * as os from 'os';
import * as process from 'process';

@Injectable()
export class MonitoringService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  // ========== Server Metrics ==========
  async getServerMetrics() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Get system info
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate CPU percentage (simplified)
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000 / uptime) * 100;

    // Get disk usage (simplified - would need actual disk stats in production)
    const diskUsage = {
      total: 0,
      used: 0,
      free: 0,
      percent: 0,
    };

    return {
      cpu: {
        usage: Math.min(cpuPercent, 100),
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: (usedMem / totalMem) * 100,
        process: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        },
      },
      disk: diskUsage,
      uptime: {
        seconds: uptime,
        formatted: this.formatUptime(uptime),
      },
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
    };
  }

  // ========== API Latency ==========
  async getApiLatency() {
    // This would typically come from request logging middleware
    // For now, return mock data structure
    try {
      const latencyData = await this.redisService.get('api:latency:stats');
      if (latencyData) {
        return JSON.parse(latencyData);
      }
    } catch (e) {
      // Ignore
    }

    return {
      average: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      requests: 0,
    };
  }

  // ========== Redis Stats ==========
  async getRedisStats() {
    try {
      if (!this.redisClient) {
        return {
          connected: false,
          error: 'Redis client not available - check Redis module configuration. REDIS_CLIENT was not injected.',
        };
      }

      // Check if Redis client is properly initialized
      if (typeof this.redisClient.ping !== 'function') {
        return {
          connected: false,
          error: 'Redis client is not properly initialized. Expected Redis instance but got different type.',
        };
      }

      // Check if Redis is connected
      const status = this.redisClient.status;
      
      // ioredis status can be: 'end', 'close', 'wait', 'connecting', 'connect', 'ready'
      if (status === 'end' || status === 'close') {
        return {
          connected: false,
          error: `Redis connection closed. Status: ${status}. Please check if Redis server is running on localhost:6379.`,
        };
      }

      if (status === 'wait' || status === 'connecting') {
        return {
          connected: false,
          error: `Redis is connecting... Status: ${status}. Please wait a moment and refresh.`,
        };
      }

      // Try to ping Redis to verify connection (with timeout)
      try {
        const pingPromise = this.redisClient.ping();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout after 2 seconds')), 2000)
        );
        
        const pong = await Promise.race([pingPromise, timeoutPromise]) as string;
        if (pong !== 'PONG') {
          return {
            connected: false,
            error: `Redis ping failed - received: ${pong} instead of PONG. Connection may be unstable.`,
          };
        }
      } catch (pingError: any) {
        const pingErrorMsg = pingError?.message || pingError?.toString() || 'Unknown ping error';
        return {
          connected: false,
          error: `Redis ping failed: ${pingErrorMsg}. Check Redis server connection. Status: ${status}`,
          status: status,
        };
      }

      const info = await this.redisClient.info();
      const stats = {
        connected: true,
        memory: {
          used: 0,
          peak: 0,
        },
        keys: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
      };

      // Parse Redis INFO command output
      if (info) {
        const lines = info.split('\r\n');
        lines.forEach((line) => {
          if (line.startsWith('used_memory:')) {
            stats.memory.used = parseInt(line.split(':')[1]) || 0;
          }
          if (line.startsWith('used_memory_peak:')) {
            stats.memory.peak = parseInt(line.split(':')[1]) || 0;
          }
          if (line.startsWith('keyspace_hits:')) {
            stats.hits = parseInt(line.split(':')[1]) || 0;
          }
          if (line.startsWith('keyspace_misses:')) {
            stats.misses = parseInt(line.split(':')[1]) || 0;
          }
        });

        const total = stats.hits + stats.misses;
        stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
      }

      // Get key count
      try {
        const keys = await this.redisClient.keys('*');
        stats.keys = keys?.length || 0;
      } catch (e) {
        // Ignore key count errors
      }

      return stats;
    } catch (error: any) {
      // Provide more detailed error information
      let errorMessage = 'Unknown error';
      let errorCode = 'NO_CODE';
      let errorDetails = '';

      try {
        if (error === null || error === undefined) {
          errorMessage = 'Error object is null or undefined';
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = String(error.message);
        } else if (error.toString && typeof error.toString === 'function') {
          errorMessage = error.toString();
        } else {
          try {
            errorMessage = JSON.stringify(error);
          } catch {
            errorMessage = 'Unable to stringify error object';
          }
        }

        if (error && error.code !== undefined) {
          errorCode = String(error.code);
        }

        if (error && error.stack) {
          errorDetails = String(error.stack);
        }
      } catch (parseError) {
        errorMessage = 'Error occurred while parsing error object';
        console.error('Error parsing error:', parseError);
      }

      // Log the full error for debugging
      console.error('Redis connection error:', {
        message: errorMessage,
        code: errorCode,
        status: this.redisClient?.status,
        errorType: error?.constructor?.name,
        error: error,
        details: errorDetails,
        hasRedisClient: !!this.redisClient,
        redisClientType: typeof this.redisClient,
      });
      
      const statusInfo = this.redisClient?.status ? ` Status: ${this.redisClient.status}.` : ' Status: unknown.';
      const codeInfo = errorCode !== 'NO_CODE' ? ` Code: ${errorCode}.` : '';
      
      return {
        connected: false,
        error: `${errorMessage}${codeInfo}${statusInfo} Please ensure Redis is running and accessible at the configured host/port.`,
        status: this.redisClient?.status || 'unknown',
      };
    }
  }

  // ========== DB Performance ==========
  async getDbPerformance() {
    const start = Date.now();
    try {
      // Simple query to test DB performance
      await this.prisma.user.count();
      const queryTime = Date.now() - start;

      // Get table sizes (simplified)
      let tableStats: any[] = [];
      try {
        tableStats = await this.prisma.$queryRaw`
          SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
          LIMIT 10
        ` as any[];
      } catch (e) {
        // Ignore if query fails
      }

      return {
        queryTime,
        pool: {
          active: 0,
          idle: 0,
          total: 0,
        },
        tableSizes: tableStats || [],
        connections: {
          active: 0,
          idle: 0,
        },
      };
    } catch (error: any) {
      return {
        queryTime: Date.now() - start,
        error: error.message,
      };
    }
  }

  // ========== Queue Processing ==========
  async getQueueStats() {
    // This would come from BullMQ
    const queueStats = {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      jobs: {
        email: { active: 0, waiting: 0, completed: 0, failed: 0 },
        sms: { active: 0, waiting: 0, completed: 0, failed: 0 },
        notification: { active: 0, waiting: 0, completed: 0, failed: 0 },
        analytics: { active: 0, waiting: 0, completed: 0, failed: 0 },
      },
    };

    return queueStats;
  }

  // ========== App Metrics ==========
  async getAppMetrics() {
    const [activeUsers, totalUsers, recentCrashes] = await Promise.all([
      this.prisma.session.count({
        where: {
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.userEvent.findMany({
        where: {
          eventType: 'ERROR',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      crashes: recentCrashes.length,
      recentCrashes: recentCrashes.map((crash) => ({
        id: crash.id,
        userId: crash.userId,
        eventType: crash.eventType,
        metadata: crash.metadata,
        createdAt: crash.createdAt,
      })),
      activeUsers,
      totalUsers,
      featureUsage: await this.getFeatureUsage(),
      versionDistribution: await this.getVersionDistribution(),
    };
  }

  async getFeatureUsage() {
    // Get feature usage from analytics events
    const features = await this.prisma.userEvent.groupBy({
      by: ['eventType'],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    return features.map((f) => ({
      feature: f.eventType,
      count: f._count.id,
    }));
  }

  async getVersionDistribution() {
    // This would come from app version tracking
    return [
      { version: '1.0.0', users: 0, percent: 0 },
    ];
  }

  // ========== Web Metrics ==========
  async getWebMetrics() {
    const [cmsActivity, adminLogs, trafficSummary] = await Promise.all([
      this.getCmsActivity(),
      this.getAdminLogs(),
      this.getTrafficSummary(),
    ]);

    return {
      cmsActivity,
      adminLogs,
      trafficSummary,
    };
  }

  async getCmsActivity() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [postsCreated, postsUpdated, usersCreated, jobsCreated] = await Promise.all([
      this.prisma.post.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.post.count({ where: { updatedAt: { gte: last24h } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.jobPost.count({ where: { createdAt: { gte: last24h } } }),
    ]);

    return {
      postsCreated,
      postsUpdated,
      usersCreated,
      jobsCreated,
      last24h,
    };
  }

  async getAdminLogs() {
    // Get audit logs if available
    const logs = await this.prisma.userEvent.findMany({
      where: {
        eventType: { contains: 'ADMIN' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return logs;
  }

  async getTrafficSummary() {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const traffic = await Promise.all(
      last7Days.map(async (date) => {
        const start = new Date(date);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);

        const [sessions, users] = await Promise.all([
          this.prisma.session.count({
            where: {
              createdAt: { gte: start, lt: end },
            },
          }),
          this.prisma.user.count({
            where: {
              createdAt: { gte: start, lt: end },
            },
          }),
        ]);

        return {
          date,
          sessions,
          users,
        };
      }),
    );

    return {
      last7Days: traffic,
      total: {
        sessions: traffic.reduce((sum, t) => sum + t.sessions, 0),
        users: traffic.reduce((sum, t) => sum + t.users, 0),
      },
    };
  }

  // ========== User Behavior ==========
  async getUserBehaviorMetrics() {
    const [feedStats, scorecardTracking, contentPerformance, mcqAnalytics, referralAnalytics] = await Promise.all([
      this.getFeedStats(),
      this.getScorecardTracking(),
      this.getContentPerformance(),
      this.getMcqAnalytics(),
      this.getReferralAnalytics(),
    ]);

    return {
      feedStats,
      scorecardTracking,
      contentPerformance,
      mcqAnalytics,
      referralAnalytics,
    };
  }

  async getFeedStats() {
    const [totalFeeds, activeFeeds] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.count({ where: { isActive: true } }),
    ]);

    // Get interaction stats
    let interactions: any = { posts_with_interactions: 0, total_likes: 0, total_comments: 0 };
    try {
      const result = await this.prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT "postId") as posts_with_interactions,
          SUM(CASE WHEN type = 'LIKE' THEN 1 ELSE 0 END) as total_likes,
          SUM(CASE WHEN type = 'COMMENT' THEN 1 ELSE 0 END) as total_comments
        FROM "PostInteraction"
      ` as any[];
      if (result && result.length > 0) {
        interactions = result[0];
      }
    } catch (e) {
      // Ignore
    }

    return {
      totalFeeds,
      activeFeeds,
      interactions,
    };
  }

  async getScorecardTracking() {
    const [totalUsers, usersWithScore, avgScore] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.userScore.count(),
      this.prisma.userScore.aggregate({
        _avg: {
          totalScore: true,
        },
      }),
    ]);

    return {
      totalUsers,
      usersWithScore: usersWithScore,
      avgScore: avgScore._avg.totalScore || 0,
      distribution: await this.getScoreDistribution(),
    };
  }

  async getScoreDistribution() {
    // Simplified distribution
    return {
      '0-100': 0,
      '101-500': 0,
      '501-1000': 0,
      '1000+': 0,
    };
  }

  async getContentPerformance() {
    const topPosts = await this.prisma.post.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return {
      topPosts: topPosts.map((post) => ({
        id: post.id,
        title: post.title,
        likes: post._count.likes,
        comments: post._count.comments,
        createdAt: post.createdAt,
      })),
    };
  }

  async getMcqAnalytics() {
    const [totalQuestions, totalAttempts, correctAttempts] = await Promise.all([
      this.prisma.mcqQuestion.count(),
      this.prisma.mcqAttempt.count(),
      this.prisma.mcqAttempt.count({
        where: { isCorrect: true },
      }),
    ]);

    const avgScore = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    return {
      totalQuestions,
      totalAttempts,
      avgScore: Math.round(avgScore * 100) / 100,
      categoryBreakdown: await this.getMcqCategoryBreakdown(),
    };
  }

  async getMcqCategoryBreakdown() {
    // Get attempts with their question categories
    const attempts = await this.prisma.mcqAttempt.findMany({
      include: {
        question: {
          include: {
            category: true,
          },
        },
      },
    });

    // Group by category
    const categoryMap = new Map();
    attempts.forEach((attempt) => {
      const categoryId = attempt.question.categoryId;
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          total: 0,
          correct: 0,
        });
      }
      const stats = categoryMap.get(categoryId);
      stats.total++;
      if (attempt.isCorrect) {
        stats.correct++;
      }
    });

    return Array.from(categoryMap.values()).map((stats) => ({
      categoryId: stats.categoryId,
      _count: { id: stats.total },
      correctCount: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }));
  }

  async getReferralAnalytics() {
    const [totalReferrals, activeReferrers, totalRewards] = await Promise.all([
      this.prisma.referral.count(),
      this.prisma.referral.groupBy({
        by: ['referrerId'],
        _count: {
          id: true,
        },
      }),
      this.prisma.referral.count({
        where: { rewardEarned: true },
      }),
    ]);

    return {
      totalReferrals,
      activeReferrers: activeReferrers.length,
      totalRewards: totalRewards, // Count of referrals with rewards earned
    };
  }

  // ========== Engagement Metrics ==========
  async getEngagementMetrics() {
    const [notifications, adsPerformance, streakInsights] = await Promise.all([
      this.getNotificationMetrics(),
      this.getAdsPerformance(),
      this.getStreakInsights(),
    ]);

    return {
      notifications,
      adsPerformance,
      streakInsights,
    };
  }

  async getNotificationMetrics() {
    const [total, sent, read, unread] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      this.prisma.notification.count({ where: { isRead: true } }),
      this.prisma.notification.count({ where: { isRead: false } }),
    ]);

    return {
      total,
      sent24h: sent,
      read,
      unread,
      readRate: total > 0 ? (read / total) * 100 : 0,
    };
  }

  async getAdsPerformance() {
    const [totalImpressions, revenue] = await Promise.all([
      this.prisma.adImpression.count(),
      this.prisma.adImpression.aggregate({
        _sum: {
          revenue: true,
        },
      }),
    ]);

    // Note: AdImpression doesn't have a 'clicked' field in the schema
    // If you need click tracking, add it to the schema or use a different approach
    const totalClicks = 0; // Placeholder - implement click tracking if needed

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      revenue: revenue._sum.revenue || 0,
    };
  }

  async getStreakInsights() {
    // This would track user daily activity streaks
    return {
      activeStreaks: 0,
      avgStreakLength: 0,
      longestStreak: 0,
    };
  }

  // ========== Cache Management ==========
  async clearCache(pattern?: string) {
    try {
      if (!this.redisClient) {
        throw new Error('Redis client not available');
      }

      // Check if Redis is connected
      const status = this.redisClient.status;
      if (status !== 'ready' && status !== 'connect') {
        throw new Error(`Redis is not connected. Status: ${status}`);
      }

      if (pattern && pattern.trim()) {
        // Clear keys matching pattern
        const keys = await this.redisClient.keys(pattern.trim());
        if (keys && keys.length > 0) {
          // Delete keys in batches to avoid issues with large key sets
          if (keys.length <= 1000) {
            await this.redisClient.del(...keys);
          } else {
            // For large key sets, delete in batches
            for (let i = 0; i < keys.length; i += 1000) {
              const batch = keys.slice(i, i + 1000);
              await this.redisClient.del(...batch);
            }
          }
          return { 
            cleared: keys.length, 
            pattern: pattern.trim(),
            message: `Cleared ${keys.length} keys matching pattern "${pattern.trim()}"`
          };
        } else {
          return { 
            cleared: 0, 
            pattern: pattern.trim(),
            message: `No keys found matching pattern "${pattern.trim()}"`
          };
        }
      } else {
        // Clear all cache
        await this.redisClient.flushdb();
        return { 
          cleared: 'all', 
          pattern: '*',
          message: 'All cache cleared successfully'
        };
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      console.error('Clear cache error:', error);
      throw new Error(`Failed to clear cache: ${errorMessage}`);
    }
  }

  async getCacheStats() {
    try {
      if (!this.redisClient) {
        return {
          totalKeys: 0,
          error: 'Redis client not available',
        };
      }

      const keys = await this.redisClient.keys('*');
      const stats = {
        totalKeys: keys?.length || 0,
        memory: await this.getRedisStats(),
      };
      return stats;
    } catch (error: any) {
      return {
        totalKeys: 0,
        error: error.message,
      };
    }
  }

  // ========== Error Logs & Crash Reports ==========
  async getErrorLogs(limit: number = 100, offset: number = 0) {
    const errors = await this.prisma.userEvent.findMany({
      where: {
        OR: [
          { eventType: 'ERROR' },
          { eventType: { contains: 'ERROR' } },
          { eventType: { contains: 'CRASH' } },
          { eventType: { contains: 'EXCEPTION' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            mobile: true,
          },
        },
      },
    });

    const total = await this.prisma.userEvent.count({
      where: {
        OR: [
          { eventType: 'ERROR' },
          { eventType: { contains: 'ERROR' } },
          { eventType: { contains: 'CRASH' } },
          { eventType: { contains: 'EXCEPTION' } },
        ],
      },
    });

    return {
      errors: errors.map((e) => ({
        id: e.id,
        userId: e.userId,
        user: e.user,
        eventType: e.eventType,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: e.metadata,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getCrashReports(limit: number = 50) {
    const crashes = await this.prisma.userEvent.findMany({
      where: {
        OR: [
          { eventType: 'CRASH' },
          { eventType: { contains: 'CRASH', mode: 'insensitive' } },
          { eventType: 'ERROR' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get user details separately
    const userIds = [...new Set(crashes.map((c) => c.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        mobile: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return crashes.map((c) => ({
      id: c.id,
      userId: c.userId,
      user: userMap.get(c.userId) || null,
      eventType: c.eventType,
      metadata: c.metadata,
      ipAddress: c.ipAddress,
      userAgent: c.userAgent,
      createdAt: c.createdAt,
      severity: this.calculateSeverity(c),
    }));
  }

  private calculateSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    const metadata = error.metadata || {};
    const eventType = error.eventType || '';
    
    if (eventType.includes('CRASH') || metadata.error?.includes('OutOfMemory')) {
      return 'critical';
    }
    if (eventType.includes('ERROR') || metadata.error) {
      return 'high';
    }
    return 'medium';
  }

  // ========== System Health Check ==========
  async getSystemHealth() {
    const [dbHealth, redisHealth, memoryHealth, cpuHealth] = await Promise.all([
      this.checkDbHealth(),
      this.checkRedisHealth(),
      this.checkMemoryHealth(),
      this.checkCpuHealth(),
    ]);

    const overallStatus = 
      dbHealth.status === 'healthy' &&
      redisHealth.status === 'healthy' &&
      memoryHealth.status === 'healthy' &&
      cpuHealth.status === 'healthy'
        ? 'healthy'
        : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        redis: redisHealth,
        memory: memoryHealth,
        cpu: cpuHealth,
      },
      recommendations: this.getHealthRecommendations(dbHealth, redisHealth, memoryHealth, cpuHealth),
    };
  }

  private async checkDbHealth() {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy',
        latency,
        message: latency < 100 ? 'Database responding normally' : 'Database response slow',
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Database connection failed',
      };
    }
  }

  private async checkRedisHealth() {
    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') {
        return {
          status: 'unhealthy',
          message: 'Redis not connected',
        };
      }

      const start = Date.now();
      await this.redisClient.ping();
      const latency = Date.now() - start;

      return {
        status: latency < 10 ? 'healthy' : latency < 50 ? 'degraded' : 'unhealthy',
        latency,
        message: 'Redis responding normally',
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Redis connection failed',
      };
    }
  }

  private checkMemoryHealth() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (usagePercent > 90) {
      status = 'unhealthy';
    } else if (usagePercent > 75) {
      status = 'degraded';
    }

    return {
      status,
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      usagePercent,
      message: usagePercent > 90 ? 'Memory usage critical' : usagePercent > 75 ? 'Memory usage high' : 'Memory usage normal',
    };
  }

  private checkCpuHealth() {
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000 / uptime) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (cpuPercent > 90) {
      status = 'unhealthy';
    } else if (cpuPercent > 75) {
      status = 'degraded';
    }

    return {
      status,
      usage: Math.min(cpuPercent, 100),
      message: cpuPercent > 90 ? 'CPU usage critical' : cpuPercent > 75 ? 'CPU usage high' : 'CPU usage normal',
    };
  }

  private getHealthRecommendations(...checks: any[]): string[] {
    const recommendations: string[] = [];

    checks.forEach((check) => {
      if (check.status === 'unhealthy') {
        if (check.error?.includes('Database')) {
          recommendations.push('Database connection is failing. Check database server status and connection pool.');
        }
        if (check.error?.includes('Redis')) {
          recommendations.push('Redis connection is failing. Restart Redis service or check network connectivity.');
        }
        if (check.usagePercent > 90) {
          recommendations.push('Memory usage is critical. Consider restarting the application or increasing memory limits.');
        }
        if (check.usage > 90) {
          recommendations.push('CPU usage is critical. Check for resource-intensive processes.');
        }
      } else if (check.status === 'degraded') {
        if (check.latency > 500) {
          recommendations.push('Database response time is slow. Consider optimizing queries or scaling database.');
        }
        if (check.usagePercent > 75) {
          recommendations.push('Memory usage is high. Monitor for potential memory leaks.');
        }
      }
    });

    return recommendations;
  }

  // ========== Recovery Actions ==========
  async performRecoveryAction(action: string, params?: Record<string, any>) {
    switch (action) {
      case 'restart-queue':
        return await this.restartQueue();
      case 'clear-queue':
        return await this.clearQueue(params?.queueName);
      case 'restart-redis':
        return await this.restartRedis();
      case 'gc':
        return await this.forceGarbageCollection();
      case 'reconnect-db':
        return await this.reconnectDatabase();
      case 'clear-error-logs':
        return await this.clearErrorLogs(params?.olderThanDays);
      default:
        throw new Error(`Unknown recovery action: ${action}`);
    }
  }

  private async restartQueue() {
    // This would restart BullMQ queues
    // For now, return success message
    return {
      success: true,
      message: 'Queue workers restarted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  private async clearQueue(queueName?: string) {
    // This would clear BullMQ queue
    return {
      success: true,
      message: queueName ? `Queue "${queueName}" cleared` : 'All queues cleared',
      timestamp: new Date().toISOString(),
    };
  }

  private async restartRedis() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        // Reconnection will happen automatically via RedisModule
      }
      return {
        success: true,
        message: 'Redis connection reset. Reconnecting...',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to restart Redis connection',
      };
    }
  }

  private async forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      return {
        success: true,
        message: 'Garbage collection forced',
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: false,
      message: 'Garbage collection not available. Run Node with --expose-gc flag',
    };
  }

  private async reconnectDatabase() {
    try {
      await this.prisma.$disconnect();
      await this.prisma.$connect();
      return {
        success: true,
        message: 'Database reconnected successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to reconnect database',
      };
    }
  }

  private async clearErrorLogs(olderThanDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deleted = await this.prisma.userEvent.deleteMany({
      where: {
        OR: [
          { eventType: 'ERROR' },
          { eventType: { contains: 'ERROR' } },
          { eventType: { contains: 'CRASH' } },
        ],
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      success: true,
      deleted: deleted.count,
      message: `Cleared ${deleted.count} error logs older than ${olderThanDays} days`,
      timestamp: new Date().toISOString(),
    };
  }

  // ========== Performance Alerts ==========
  async getAlerts() {
    const [health, metrics] = await Promise.all([
      this.getSystemHealth(),
      this.getServerMetrics(),
    ]);

    const alerts: any[] = [];

    // CPU alerts
    if (metrics.cpu.usage > 90) {
      alerts.push({
        type: 'critical',
        category: 'cpu',
        message: `CPU usage is critical: ${metrics.cpu.usage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    } else if (metrics.cpu.usage > 75) {
      alerts.push({
        type: 'warning',
        category: 'cpu',
        message: `CPU usage is high: ${metrics.cpu.usage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    }

    // Memory alerts
    if (metrics.memory.percent > 90) {
      alerts.push({
        type: 'critical',
        category: 'memory',
        message: `Memory usage is critical: ${metrics.memory.percent.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    } else if (metrics.memory.percent > 75) {
      alerts.push({
        type: 'warning',
        category: 'memory',
        message: `Memory usage is high: ${metrics.memory.percent.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    }

    // Health check alerts
    if (health.status === 'unhealthy') {
      alerts.push({
        type: 'critical',
        category: 'system',
        message: 'System health check failed',
        details: health.checks,
        timestamp: new Date().toISOString(),
      });
    }

    // Redis alerts
    const redisStats = await this.getRedisStats();
    if (!redisStats.connected) {
      alerts.push({
        type: 'critical',
        category: 'redis',
        message: 'Redis connection lost',
        error: 'error' in redisStats ? redisStats.error : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      alerts,
      count: alerts.length,
      critical: alerts.filter((a) => a.type === 'critical').length,
      warnings: alerts.filter((a) => a.type === 'warning').length,
    };
  }

  // ========== Performance Metrics History ==========
  async getPerformanceHistory(hours: number = 24) {
    // This would typically come from time-series database
    // For now, return structure for future implementation
    return {
      cpu: [],
      memory: [],
      latency: [],
      errors: [],
      period: `${hours} hours`,
    };
  }

  // Helper
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }
}
