import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ReferralService {
  private whatsappApiKey: string;
  private whatsappApiUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.whatsappApiKey = this.configService.get<string>('WHATSAPP_API_KEY') || '';
    this.whatsappApiUrl = this.configService.get<string>('WHATSAPP_API_URL') || '';
  }

  async createReferral(referrerId: string, referredId?: string) {
    // Generate referral code
    const referralCode = this.generateReferralCode(referrerId);
    
    // Create referral
    const referral = await this.prisma.referral.create({
      data: {
        referrerId,
        referredId: referredId || null,
        referralCode,
        status: 'PENDING',
      },
    });

    return referral;
  }

  async getMyReferralCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user?.referralCode) {
      // Generate referral code if doesn't exist
      const code = this.generateReferralCode(userId);
      await this.prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
      return { referralCode: code };
    }

    return { referralCode: user.referralCode };
  }

  async getMyReferrals(userId: string) {
    return this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            id: true,
            email: true,
            mobile: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeaderboard(limit: number = 10) {
    const referrals = await this.prisma.referral.groupBy({
      by: ['referrerId'],
      where: {
        status: 'COMPLETED',
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    const userIds = referrals.map((r) => r.referrerId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        mobile: true,
      },
    });

    return referrals.map((ref) => ({
      user: users.find((u) => u.id === ref.referrerId),
      referralCount: ref._count.id,
    }));
  }

  async sendWhatsAppInvite(phoneNumber: string, referralCode: string, referrerName: string) {
    if (!this.whatsappApiKey || !this.whatsappApiUrl) {
      console.warn('WhatsApp API not configured');
      return { success: false, message: 'WhatsApp API not configured' };
    }

    const message = `Hi! ${referrerName} invited you to join LifeSet!\n\nUse referral code: ${referralCode}\n\nDownload the app and start your journey! 🚀`;

    try {
      const response = await axios.post(
        `${this.whatsappApiUrl}/send`,
        {
          to: phoneNumber,
          message: message,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.whatsappApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error('WhatsApp API error:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyReferralCode(code: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { referralCode: code },
      include: {
        referrer: {
          select: {
            id: true,
            email: true,
            mobile: true,
          },
        },
      },
    });

    if (!referral) {
      return { valid: false, message: 'Invalid referral code' };
    }

    if (referral.status !== 'PENDING') {
      return { valid: false, message: 'Referral code already used' };
    }

    return { valid: true, referral };
  }

  async useReferralCode(userId: string, code: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { referralCode: code },
    });

    if (!referral) {
      throw new Error('Invalid referral code');
    }

    if (referral.status !== 'PENDING') {
      throw new Error('Referral code already used');
    }

    if (referral.referrerId === userId) {
      throw new Error('Cannot use your own referral code');
    }

    // Update referral status
    const updated = await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        referredId: userId,
        status: 'COMPLETED',
      },
    });

    return updated;
  }

  async getAnalytics() {
    // Total referrals
    const totalReferrals = await this.prisma.referral.count();
    
    // Completed referrals
    const completedReferrals = await this.prisma.referral.count({
      where: { status: 'COMPLETED' },
    });
    
    // Pending referrals
    const pendingReferrals = await this.prisma.referral.count({
      where: { status: 'PENDING' },
    });
    
    // Unique referrers
    const uniqueReferrers = await this.prisma.referral.groupBy({
      by: ['referrerId'],
    });
    
    // Referrals by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReferrals = await this.prisma.referral.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });
    
    // Group by date (day level)
    const referralsByDateMap = new Map<string, number>();
    recentReferrals.forEach((ref) => {
      const dateKey = ref.createdAt.toISOString().split('T')[0];
      referralsByDateMap.set(dateKey, (referralsByDateMap.get(dateKey) || 0) + 1);
    });
    
    const referralsByDate = Array.from(referralsByDateMap.entries()).map(([date, count]) => ({
      date: new Date(date),
      count,
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Top 10 referrers
    const topReferrers = await this.prisma.referral.groupBy({
      by: ['referrerId'],
      where: {
        status: 'COMPLETED',
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
    
    const referrerIds = topReferrers.map((r) => r.referrerId);
    const referrers = await this.prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: {
        id: true,
        email: true,
        mobile: true,
        studentProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    const topReferrersWithDetails = topReferrers.map((ref) => {
      const user = referrers.find((u) => u.id === ref.referrerId);
      return {
        userId: ref.referrerId,
        user: user || null,
        referralCount: ref._count.id,
      };
    });

    // Recent referrals (last 50)
    const recentReferralsList = await this.prisma.referral.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: {
          select: {
            id: true,
            email: true,
            mobile: true,
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        referred: {
          select: {
            id: true,
            email: true,
            mobile: true,
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Referral codes usage stats
    const totalUsersWithReferralCodes = await this.prisma.user.count({
      where: {
        referralCode: { not: null },
      },
    });

    // Conversion rate (completed / total)
    const conversionRate = totalReferrals > 0 
      ? ((completedReferrals / totalReferrals) * 100).toFixed(2)
      : '0.00';
    
    return {
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      uniqueReferrers: uniqueReferrers.length,
      topReferrers: topReferrersWithDetails,
      referralsByDate,
      recentReferrals: recentReferralsList,
      totalUsersWithReferralCodes,
      conversionRate: parseFloat(conversionRate),
    };
  }

  private generateReferralCode(userId: string): string {
    // Generate a unique referral code
    const prefix = 'LS';
    const timestamp = Date.now().toString(36).toUpperCase();
    const userIdShort = userId.substring(0, 4).toUpperCase();
    return `${prefix}${timestamp}${userIdShort}`;
  }
}
