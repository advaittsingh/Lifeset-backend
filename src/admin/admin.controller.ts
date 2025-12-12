import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserType, NotificationType } from '@/shared';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserType.ADMIN)
export class AdminController {
  constructor(private prisma: PrismaService) {}

  // Users Management
  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin)' })
  async getUsers(@Query() filters: any) {
    const where: any = {};
    
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { mobile: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    if (filters.userType) {
      where.userType = filters.userType;
    }

    const limit = filters.limit ? parseInt(filters.limit.toString()) : 100;
    const page = filters.page ? parseInt(filters.page.toString()) : 1;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          studentProfile: true,
          companyProfile: true,
          collegeProfile: true,
          adminProfile: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate user' })
  async activateUser(@Param('id') id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  @Patch('users/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate user' })
  async deactivateUser(@Param('id') id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Posts Management
  @Get('posts')
  @ApiOperation({ summary: 'Get all posts (Admin)' })
  async getPosts(@Query() filters: any) {
    const where: any = {};
    
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    if (filters.postType) {
      where.postType = filters.postType;
    }
    
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    const limit = filters.limit ? parseInt(filters.limit.toString()) : 100;
    const page = filters.page ? parseInt(filters.page.toString()) : 1;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              mobile: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Update post' })
  async updatePost(@Param('id') id: string, @Body() data: any) {
    return this.prisma.post.update({
      where: { id },
      data,
    });
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete post' })
  async deletePost(@Param('id') id: string) {
    return this.prisma.post.delete({
      where: { id },
    });
  }

  // Analytics
  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get analytics overview' })
  async getAnalyticsOverview() {
    const [totalUsers, activeUsers, totalPosts, totalJobs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.post.count(),
      this.prisma.jobPost.count(),
    ]);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const newUsers = await this.prisma.user.count({
      where: { createdAt: { gte: monthAgo } },
    });

    return {
      totalUsers,
      activeUsers,
      newUsers,
      totalPosts,
      totalJobs,
      totalApplications: await this.prisma.jobApplication.count(),
      engagementRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
      retentionRate: 78.5, // This would be calculated from actual data
    };
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get comprehensive dashboard statistics' })
  async getDashboardStats() {
    // LifeSet Panel Data
    const [
      appInstalled, // Using active users with mobile as proxy for app installations
      courseCategories,
      awards, // Using Awarded count
      specializations, // Using Specialisation count
      wallCategories,
      institutes,
      institutesNewRequest, // Institutes created in last 7 days
      courseSpeRequest, // Courses/Specializations pending (can be extended later)
    ] = await Promise.all([
      this.prisma.user.count({ where: { mobile: { not: null }, isActive: true } }),
      this.prisma.courseCategory.count(),
      this.prisma.awarded.count(),
      this.prisma.specialisation.count(),
      this.prisma.wallCategory.count(),
      this.prisma.collegeProfile.count(),
      this.prisma.collegeProfile.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      Promise.resolve(0), // Placeholder for course/specialization requests
    ]);

    // Institutes Panel
    const totalInstitutes = institutes;
    const institutesNewRequests = institutesNewRequest;

    // Members Panel
    const [members, invitedMembers] = await Promise.all([
      this.prisma.user.count({ where: { userType: 'AMS' } }),
      this.prisma.user.count({
        where: {
          userType: 'AMS',
          isVerified: false,
        },
      }),
    ]);

    // Students Panel
    const [students, studentsNewRequest, studentsQueries] = await Promise.all([
      this.prisma.studentProfile.count(),
      this.prisma.studentProfile.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.chatMessage.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Companies Panel
    const [companies, companiesNewRequest] = await Promise.all([
      this.prisma.companyProfile.count(),
      this.prisma.companyProfile.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Referral Panel
    const referralStudents = await this.prisma.referral.count({
      where: {
        status: 'completed',
        referredId: { not: null },
      },
    });

    return {
      lifesetPanel: {
        appInstalled,
        courseCategories,
        awards,
        specializations,
        wallCategories,
        courseSpeRequest,
      },
      institutesPanel: {
        institutes: totalInstitutes,
        institutesNewRequest: institutesNewRequests,
      },
      membersPanel: {
        members,
        invitedMembers,
      },
      studentsPanel: {
        students,
        studentsNewRequest,
        studentsQueries,
      },
      companiesPanel: {
        companies,
        companiesNewRequest,
      },
      referralPanel: {
        referralStudents,
      },
    };
  }

  @Get('analytics/user-growth')
  @ApiOperation({ summary: 'Get user growth data' })
  async getUserGrowth(@Query('period') period: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    const data: any[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now);
      const end = new Date(now);
      
      if (period === 'month') {
        start.setMonth(start.getMonth() - i - 1);
        end.setMonth(end.getMonth() - i);
      } else if (period === 'week') {
        start.setDate(start.getDate() - (i + 1) * 7);
        end.setDate(end.getDate() - i * 7);
      } else {
        start.setDate(start.getDate() - i - 1);
        end.setDate(end.getDate() - i);
      }

      const [users, active] = await Promise.all([
        this.prisma.user.count({
          where: { createdAt: { lt: end } },
        }),
        this.prisma.user.count({
          where: {
            createdAt: { lt: end },
            isActive: true,
          },
        }),
      ]);

      data.push({
        period: period === 'month' ? end.toLocaleDateString('en-US', { month: 'short' }) :
                period === 'week' ? `Week ${6 - i}` :
                end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        users,
        active,
      });
    }

    return data;
  }

  // Jobs Management
  @Get('jobs')
  @ApiOperation({ summary: 'Get all jobs (Admin)' })
  async getJobs(@Query() filters: any) {
    const where: any = {};
    
    if (filters.search) {
      where.OR = [
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
        { jobDescription: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        include: {
          post: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  mobile: true,
                },
              },
            },
          },
          company: {
            select: {
              companyName: true,
            },
          },
          _count: {
            select: {
              jobApplications: true,
            },
          },
        },
        skip: filters.page ? (filters.page - 1) * (filters.limit || 10) : 0,
        take: filters.limit ? parseInt(filters.limit) : 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total,
        totalPages: Math.ceil(total / (filters.limit || 10)),
      },
    };
  }

  // Notifications
  @Post('notifications')
  @ApiOperation({ summary: 'Send notification (Admin)' })
  async sendNotification(@Body() data: { 
    userId?: string; 
    title: string; 
    message: string; 
    type: string; 
    sendToAll?: boolean;
    filters?: {
      userType?: string;
      collegeId?: string;
      collegeProfileId?: string;
      courseId?: string;
      city?: string;
      state?: string;
      isActive?: boolean;
      isVerified?: boolean;
      registrationDateFrom?: string;
      registrationDateTo?: string;
    };
  }) {
    const where: any = {};

    if (data.sendToAll) {
      // Apply filters if provided
      if (data.filters) {
        if (data.filters.userType) {
          where.userType = data.filters.userType;
        }
        if (data.filters.isActive !== undefined) {
          where.isActive = data.filters.isActive;
        }
        if (data.filters.isVerified !== undefined) {
          where.isVerified = data.filters.isVerified;
        }
        if (data.filters.registrationDateFrom || data.filters.registrationDateTo) {
          where.createdAt = {};
          if (data.filters.registrationDateFrom) {
            where.createdAt.gte = new Date(data.filters.registrationDateFrom);
          }
          if (data.filters.registrationDateTo) {
            where.createdAt.lte = new Date(data.filters.registrationDateTo);
          }
        }

        // Filter by student profile fields
        if (data.filters.collegeId || data.filters.collegeProfileId || data.filters.courseId || data.filters.city || data.filters.state) {
          where.studentProfile = {};
          if (data.filters.collegeId) {
            where.studentProfile.collegeId = data.filters.collegeId;
          }
          if (data.filters.collegeProfileId) {
            where.studentProfile.collegeProfileId = data.filters.collegeProfileId;
          }
          if (data.filters.courseId) {
            where.studentProfile.courseId = data.filters.courseId;
          }
          if (data.filters.city) {
            where.studentProfile.city = { contains: data.filters.city, mode: 'insensitive' };
          }
          if (data.filters.state) {
            where.studentProfile.state = { contains: data.filters.state, mode: 'insensitive' };
          }
        }
      } else {
        // Default: only active users
        where.isActive = true;
      }

      const users = await this.prisma.user.findMany({ 
        where,
        include: {
          studentProfile: true,
        },
      });

      const notifications = users.map(user => ({
        userId: user.id,
        title: data.title,
        message: data.message,
        type: data.type as NotificationType,
      }));
      
      return this.prisma.notification.createMany({
        data: notifications,
      });
    } else if (data.userId) {
      return this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type as NotificationType,
        },
      });
    }
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get all notifications (Admin)' })
  async getAllNotifications(@Query() filters: any) {
    const where: any = {};
    
    if (filters.userId) {
      where.userId = filters.userId;
    }
    
    if (filters.type) {
      where.type = filters.type;
    }
    
    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead === 'true';
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              mobile: true,
            },
          },
        },
        skip: filters.page ? (filters.page - 1) * (filters.limit || 10) : 0,
        take: filters.limit ? parseInt(filters.limit) : 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total,
        totalPages: Math.ceil(total / (filters.limit || 10)),
      },
    };
  }

  // Settings
  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  async getSettings() {
    // In a real app, this would be stored in a settings table
    // For now, return default settings
    return {
      security: {
        sessionTimeout: 60,
        passwordPolicy: {
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          minLength: 8,
        },
      },
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      system: {
        platformName: 'LifeSet Platform',
        maintenanceMode: false,
      },
    };
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update platform settings' })
  async updateSettings(@Body() data: any) {
    // In a real app, this would save to a settings table
    // For now, just return the updated settings
    return {
      ...data,
      updatedAt: new Date(),
    };
  }

  // Ad Campaign Management
  @Get('ad-campaigns')
  @ApiOperation({ summary: 'Get all ad campaigns' })
  async getAdCampaigns(@Query() filters: any) {
    const where: any = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { supportingText: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const limit = filters.limit ? parseInt(filters.limit.toString()) : 100;
    const page = filters.page ? parseInt(filters.page.toString()) : 1;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      this.prisma.adCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adCampaign.count({ where }),
    ]);

    return {
      data: campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('ad-campaigns/:id')
  @ApiOperation({ summary: 'Get ad campaign by ID' })
  async getAdCampaign(@Param('id') id: string) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new Error('Ad campaign not found');
    }

    return campaign;
  }

  @Post('ad-campaigns')
  @ApiOperation({ summary: 'Create ad campaign' })
  async createAdCampaign(@Body() data: any) {
    try {
      // Calculate estimated users based on filters
      const estimatedUsers = await this.calculateEstimatedUsers(data);
      
      // Convert date strings to Date objects
      const campaignData: any = {
        ...data,
        estimatedUsers,
        status: data.status || 'draft',
      };

      // Handle date conversions
      if (data.startDate) {
        campaignData.startDate = new Date(data.startDate);
      }
      if (data.endDate) {
        campaignData.endDate = new Date(data.endDate);
      }
      if (data.advertiserStartDay) {
        campaignData.advertiserStartDay = new Date(data.advertiserStartDay);
      }
      if (data.advertiserEndDay) {
        campaignData.advertiserEndDay = new Date(data.advertiserEndDay);
      }

      // Ensure hourlyAllocations is properly formatted
      if (data.hourlyAllocations && typeof data.hourlyAllocations === 'object') {
        campaignData.hourlyAllocations = data.hourlyAllocations;
      }

      const campaign = await this.prisma.adCampaign.create({
        data: campaignData,
      });

      return campaign;
    } catch (error: any) {
      console.error('Error creating ad campaign:', error);
      throw new Error(error.message || 'Failed to create ad campaign');
    }
  }

  @Put('ad-campaigns/:id')
  @ApiOperation({ summary: 'Update ad campaign' })
  async updateAdCampaign(@Param('id') id: string, @Body() data: any) {
    try {
      // Recalculate estimated users if filters changed
      const existing = await this.prisma.adCampaign.findUnique({ where: { id } });
      const filtersChanged = 
        existing?.country !== data.country ||
        existing?.state !== data.state ||
        existing?.city !== data.city ||
        existing?.courseCategory !== data.courseCategory ||
        existing?.gender !== data.gender ||
        existing?.age !== data.age ||
        existing?.userGroup !== data.userGroup;

      if (filtersChanged) {
        data.estimatedUsers = await this.calculateEstimatedUsers(data);
      }

      // Handle date conversions
      const updateData: any = { ...data };
      if (data.startDate) {
        updateData.startDate = new Date(data.startDate);
      }
      if (data.endDate) {
        updateData.endDate = new Date(data.endDate);
      }
      if (data.advertiserStartDay) {
        updateData.advertiserStartDay = new Date(data.advertiserStartDay);
      }
      if (data.advertiserEndDay) {
        updateData.advertiserEndDay = new Date(data.advertiserEndDay);
      }

      const campaign = await this.prisma.adCampaign.update({
        where: { id },
        data: updateData,
      });

      return campaign;
    } catch (error: any) {
      console.error('Error updating ad campaign:', error);
      throw new Error(error.message || 'Failed to update ad campaign');
    }
  }

  @Delete('ad-campaigns/:id')
  @ApiOperation({ summary: 'Delete ad campaign' })
  async deleteAdCampaign(@Param('id') id: string) {
    await this.prisma.adCampaign.delete({
      where: { id },
    });

    return { success: true };
  }

  @Post('ad-campaigns/:id/publish')
  @ApiOperation({ summary: 'Publish ad campaign' })
  async publishAdCampaign(@Param('id') id: string) {
    const campaign = await this.prisma.adCampaign.update({
      where: { id },
      data: { status: 'active' },
    });

    return campaign;
  }

  @Get('ad-campaigns/performance/predictions')
  @ApiOperation({ summary: 'Get ad performance predictions' })
  async getAdPerformancePredictions(@Query() query: any) {
    const slot = query.slot || '7PM - 7:59PM';
    const dailyPrediction = 10000;
    const adOpportunityDaily = 2000;
    const slotAdOpportunity = 120;

    // Get all active campaigns
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        dailyBudget: true,
        slotAllocation: true,
      },
    });

    // Calculate performance metrics
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.dailyBudget || 0), 0);
    const ads = campaigns.map((campaign, index) => {
      const money = campaign.slotAllocation || 21;
      const percentageShare = totalBudget > 0 ? (money / totalBudget) * 100 : 0;
      const visibilityPrediction = Math.floor(percentageShare * 0.26); // Simplified calculation

      return {
        id: `Ad ${index + 1}`,
        money,
        percentageShare: percentageShare.toFixed(2),
        visibilityPrediction,
      };
    });

    // Fill up to 10 ads if needed
    while (ads.length < 10) {
      ads.push({
        id: `Ad ${ads.length + 1}`,
        money: 21,
        percentageShare: '7.27',
        visibilityPrediction: 9,
      });
    }

    return {
      dailyPrediction,
      adOpportunityDaily,
      slotAdOpportunity,
      selectedSlot: slot,
      ads: ads.slice(0, 10),
    };
  }

  @Post('ad-campaigns/estimate-users')
  @ApiOperation({ summary: 'Estimate users based on filters' })
  async estimateUsers(@Body() filters: any) {
    const estimatedUsers = await this.calculateEstimatedUsers(filters);
    return { estimatedUsers };
  }

  @Get('ad-campaigns/active-users')
  @ApiOperation({ summary: 'Get active users by hour for each day of week' })
  async getActiveUsersByHour() {
    try {
      // Get active users for each day of week and hour
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const hours = Array.from({ length: 24 }, (_, i) => i);
      
      const activeUsersData: Record<string, Record<string, number>> = {};

      for (const day of days) {
        activeUsersData[day] = {};
        
        for (const hour of hours) {
          // Calculate day of week (0 = Sunday, 1 = Monday, etc.)
          const dayIndex = days.indexOf(day);
          const today = new Date();
          const currentDay = today.getDay();
          const daysFromToday = (dayIndex - currentDay + 7) % 7;
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + daysFromToday);
          targetDate.setHours(hour, 0, 0, 0);
          const nextHour = new Date(targetDate);
          nextHour.setHours(hour + 1, 0, 0, 0);

          // Get user events in this hour range (simulated based on historical data)
          // In production, this would query actual session/activity data
          const baseCount = await this.prisma.user.count({
            where: {
              isActive: true,
              isVerified: true,
            },
          });

          // Simulate hourly distribution (peak hours: 7-9 AM, 6-10 PM)
          let multiplier = 0.3; // Base activity
          if (hour >= 7 && hour <= 9) multiplier = 0.8; // Morning peak
          if (hour >= 18 && hour <= 22) multiplier = 1.0; // Evening peak
          if (hour >= 0 && hour <= 5) multiplier = 0.1; // Night low
          if (day === 'Sat' || day === 'Sun') multiplier *= 1.2; // Weekend boost

          activeUsersData[day][hour.toString()] = Math.floor(baseCount * multiplier);
        }
      }

      return activeUsersData;
    } catch (error: any) {
      console.error('Error getting active users:', error);
      // Return mock data on error
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const mockData: Record<string, Record<string, number>> = {};
      days.forEach(day => {
        mockData[day] = {};
        hours.forEach(hour => {
          const base = 1000;
          let multiplier = 0.3;
          if (hour >= 7 && hour <= 9) multiplier = 0.8;
          if (hour >= 18 && hour <= 22) multiplier = 1.0;
          if (hour >= 0 && hour <= 5) multiplier = 0.1;
          if (day === 'Sat' || day === 'Sun') multiplier *= 1.2;
          mockData[day][hour.toString()] = Math.floor(base * multiplier);
        });
      });
      return mockData;
    }
  }

  private async calculateEstimatedUsers(filters: any): Promise<number> {
    try {
      // Build query based on filters
      const where: any = {
        isActive: true,
        isVerified: true,
      };

      if (filters.gender && filters.gender !== 'all') {
        where.studentProfile = {
          gender: filters.gender,
        };
      }

      if (filters.state) {
        where.studentProfile = {
          ...where.studentProfile,
          state: filters.state,
        };
      }

      if (filters.city) {
        where.studentProfile = {
          ...where.studentProfile,
          city: filters.city,
        };
      }

      // Count matching users
      const count = await this.prisma.user.count({ where });

      // Apply some multiplier based on other filters (simplified)
      let multiplier = 1;
      if (filters.courseCategory) multiplier *= 1.2;
      if (filters.userGroup) multiplier *= 1.1;
      if (filters.age) multiplier *= 0.9;

      return Math.max(0, Math.floor(count * multiplier));
    } catch (error: any) {
      console.error('Error calculating estimated users:', error);
      return 0;
    }
  }

  // Wall Categories Management
  @Get('wall-categories')
  @ApiOperation({ summary: 'Get all wall categories (Admin)' })
  async getWallCategories() {
    const categories = await this.prisma.wallCategory.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((cat) => ({
      ...cat,
      postCount: cat._count.posts,
    }));
  }

  @Post('wall-categories')
  @ApiOperation({ summary: 'Create wall category (Admin)' })
  async createWallCategory(@Body() data: { name: string; description?: string; categoryFor?: string; parentCategoryId?: string; isActive?: boolean }) {
    // Note: parentCategoryId and categoryFor would need schema changes to support
    // Currently, WallCategory model doesn't have a metadata field in the schema
    return this.prisma.wallCategory.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  @Put('wall-categories/:id')
  @ApiOperation({ summary: 'Update wall category (Admin)' })
  async updateWallCategory(@Param('id') id: string, @Body() data: { name?: string; description?: string; categoryFor?: string; parentCategoryId?: string; isActive?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    // Note: categoryFor and parentCategoryId would need schema changes to support
    // Currently, WallCategory model doesn't have a metadata field in the schema
    // These fields are ignored for now

    return this.prisma.wallCategory.update({
      where: { id },
      data: updateData,
    });
  }

  @Delete('wall-categories/:id')
  @ApiOperation({ summary: 'Delete wall category (Admin)' })
  async deleteWallCategory(@Param('id') id: string) {
    // Check if category has posts
    const category = await this.prisma.wallCategory.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (category?._count.posts > 0) {
      throw new Error('Cannot delete category with existing posts. Please reassign or delete posts first.');
    }

    return this.prisma.wallCategory.delete({
      where: { id },
    });
  }
}

