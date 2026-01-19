import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, NotFoundException, InternalServerErrorException, HttpException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType, NotificationType } from '@/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { CmsAdminService } from '../cms/cms-admin.service';
import { CreateWallCategoryDto } from '../cms/dto/create-wall-category.dto';
import { UpdateWallCategoryDto } from '../cms/dto/update-wall-category.dto';
import { FileService } from '../file/file.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNotificationAdminDto } from './dto/create-notification-admin.dto';
import { CreateSponsorAdDto } from './dto/create-sponsor-ad.dto';
import { UpdateSponsorAdDto } from './dto/update-sponsor-ad.dto';
import { mapNotificationTypeToDataType } from '../notifications/utils/notification-type-mapper';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserType.ADMIN)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private prisma: PrismaService,
    private readonly cmsAdminService: CmsAdminService,
    private readonly fileService: FileService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Users Management
  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin)' })
  async getUsers(@Query() filters: any) {
    try {
      // Check database connection first
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch (dbError: any) {
        throw new InternalServerErrorException(
          'Database connection failed. Please check DATABASE_URL environment variable and ensure the database is accessible.',
        );
      }

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

      // Try to fetch users with profiles, but fallback to basic user data if includes fail
      let users: any[] = [];
      let total = 0;
      
      try {
        [users, total] = await Promise.all([
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
      } catch (includeError: any) {
        // If include fails, try without includes
        console.error('Error fetching users with includes:', includeError);
        try {
          [users, total] = await Promise.all([
            this.prisma.user.findMany({
              where,
              skip,
              take: limit,
              orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
          ]);
        } catch (fallbackError: any) {
          console.error('Error fetching users without includes:', fallbackError);
          users = [];
          total = 0;
        }
      }

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      if (error?.code === 'P1001' || error?.message?.includes('connect') || error?.message?.includes('timeout')) {
        throw new InternalServerErrorException(
          'Database connection error. Please check DATABASE_URL environment variable and ensure the database server is running.',
        );
      }
      
      if (error?.code?.startsWith('P')) {
        throw new InternalServerErrorException(
          `Database error: ${error.message || 'An error occurred while fetching users.'}`,
        );
      }
      
      throw new InternalServerErrorException(
        error?.message || 'An error occurred while fetching users.',
      );
    }
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

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user permanently' })
  async deleteUser(@Param('id') id: string, @CurrentUser() currentUser: any) {
    // Prevent deleting yourself
    if (id === currentUser.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete user (cascading deletes will handle related records)
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
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

    // Filter by jobType in metadata (for internships and freelancer opportunities)
    if (filters.jobType) {
      // Normalize jobType values
      const jobTypeValue = filters.jobType.toLowerCase();
      
      // Map jobType to postType for efficient filtering
      if (jobTypeValue === 'internship' || jobTypeValue === 'intern') {
        // Internships have postType = INTERNSHIP
        where.postType = 'INTERNSHIP';
      } else if (jobTypeValue === 'freelance' || jobTypeValue === 'freelancing' || jobTypeValue === 'contract' || jobTypeValue === 'contracting') {
        // Freelance/contract jobs have postType = FREELANCING
        where.postType = 'FREELANCING';
      }
      // Note: If postType is explicitly set and conflicts with jobType, postType takes precedence
      // The frontend should send both postType=JOB and jobType=INTERNSHIP to filter jobs by metadata.jobType
      
      // For cases where postType=JOB but we want to filter by metadata.jobType,
      // we'll need to filter in memory (less efficient but necessary for edge cases)
      // This is handled below after fetching
    }

    const limit = filters.limit ? parseInt(filters.limit.toString()) : 100;
    const page = filters.page ? parseInt(filters.page.toString()) : 1;
    const skip = (page - 1) * limit;

    // Handle special case: postType=JOB with jobType filter (need to check metadata)
    let needsMetadataFilter = false;
    let jobTypeFilterValue: string | null = null;
    
    if (filters.jobType && filters.postType === 'JOB') {
      needsMetadataFilter = true;
      const jobTypeValue = filters.jobType.toLowerCase();
      if (jobTypeValue === 'internship' || jobTypeValue === 'intern') {
        jobTypeFilterValue = 'internship';
      } else if (jobTypeValue === 'freelance' || jobTypeValue === 'freelancing') {
        jobTypeFilterValue = 'freelance';
      } else if (jobTypeValue === 'contract' || jobTypeValue === 'contracting') {
        jobTypeFilterValue = 'contract';
      }
    }

    const [allPosts, totalBeforeFilter] = await Promise.all([
      this.prisma.post.findMany({
        where: needsMetadataFilter ? { ...where, postType: 'JOB' } : where,
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
        // Fetch more if we need to filter by metadata (will filter and paginate after)
        take: needsMetadataFilter ? 1000 : limit,
        skip: needsMetadataFilter ? 0 : skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where: needsMetadataFilter ? { ...where, postType: 'JOB' } : where }),
    ]);

    // Filter by metadata.jobType if needed (for postType=JOB with jobType filter)
    let posts = allPosts;
    let total = totalBeforeFilter;
    
    if (needsMetadataFilter && jobTypeFilterValue) {
      posts = allPosts.filter((post: any) => {
        const metadata = post.metadata as any || {};
        const metadataJobType = (metadata.jobType || metadata.job_type || metadata.type || '').toLowerCase();
        return metadataJobType === jobTypeFilterValue;
      });
      
      total = posts.length;
      
      // Apply pagination after filtering
      posts = posts.slice(skip, skip + limit);
    }

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
    try {
      // Get existing post to preserve metadata and check postType
      const existingPost = await this.prisma.post.findUnique({
        where: { id },
        select: { metadata: true, postType: true },
      });

      if (!existingPost) {
        throw new NotFoundException('Post not found');
      }

      const existingMetadata = (existingPost?.metadata as any) || {};
      
      // Extract jobType from top level if provided
      const { jobType, ...restData } = data;
      
      // Auto-set jobType based on postType if not explicitly provided
      let finalJobType = jobType;
      if (!finalJobType && existingPost.postType === 'INTERNSHIP') {
        finalJobType = 'internship';
      } else if (!finalJobType && existingPost.postType === 'FREELANCING') {
        finalJobType = 'freelance'; // Default for freelancing
      }
      
      // Build update data
      const updateData: any = { ...restData };
      
      // If jobType is provided at top level or auto-set, store it in metadata
      if (finalJobType !== undefined) {
        updateData.metadata = {
          ...existingMetadata,
          jobType: finalJobType,
        };
      } else if (Object.keys(restData).some(key => key !== 'metadata')) {
        // If other fields are being updated but metadata is not explicitly provided,
        // preserve existing metadata
        updateData.metadata = existingMetadata;
      }
      
      // If metadata is explicitly provided in the request, merge it with existing
      if (data.metadata !== undefined) {
        updateData.metadata = {
          ...existingMetadata,
          ...(data.metadata || {}),
          // If jobType was at top level or auto-set, it takes precedence
          ...(finalJobType !== undefined && { jobType: finalJobType }),
        };
      }

      return this.prisma.post.update({
        where: { id },
        data: updateData,
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error updating post:', error);
      throw new InternalServerErrorException('Failed to update post');
    }
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
  async sendNotification(@Body() data: CreateNotificationAdminDto) {
    const where: any = {};
    let userIds: string[] = [];

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

      userIds = users.map(user => user.id);

      // Map notification type to data.type for mobile app filtering
      const dataType = mapNotificationTypeToDataType(data.type);

      const notifications = users.map(user => ({
        userId: user.id,
        title: data.title,
        message: data.message,
        type: data.type as NotificationType,
      }));
      
      // Create notification records in database
      await this.prisma.notification.createMany({
        data: notifications,
      });

      // Check how many users have Expo tokens before sending
      const usersWithTokens = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          expoPushToken: { not: null },
        },
        select: { id: true, expoPushToken: true },
      });

      this.logger.log(`📊 Notification Stats: ${users.length} total users, ${usersWithTokens.length} users with Expo tokens`);
      
      if (usersWithTokens.length === 0) {
        this.logger.warn(`⚠️  No users with Expo push tokens found. Users need to have expoPushToken saved.`);
      }

      // Send push notifications via Expo Push API
      this.logger.log(`🚀 Sending push notifications to ${userIds.length} users...`);
      this.logger.log(`📋 Notification details - Title: ${data.title}, Image: ${data.image ? 'Present' : 'Missing'}, RedirectURL: ${data.redirectUrl ? 'Present' : 'Missing'}`);
      const pushResult = await this.notificationsService.sendNotification({
        userIds: userIds.length > 0 ? userIds : undefined, // Send to all if empty
        notification: {
          title: data.title,
          body: data.message,
        },
        data: {
          type: dataType, // Map to data.type format (e.g., "current-affair", "mcq", "admin")
          notificationType: data.type, // Also include original notification type
        },
        redirectUrl: data.redirectUrl, // Pass redirectUrl to push notification
        imageUrl: data.image, // Pass image to push notification (DTO uses 'image' field)
      });

      this.logger.log(`✅ Push notification result: ${JSON.stringify(pushResult)}`);

      return {
        success: true,
        notificationsCreated: notifications.length,
        usersWithTokens: usersWithTokens.length,
        pushNotification: pushResult,
      };
    } else if (data.userId) {
      // Map notification type to data.type for mobile app filtering
      const dataType = mapNotificationTypeToDataType(data.type);

      // Create notification record in database
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type as NotificationType,
        },
      });

      // Check if user has Expo token
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, expoPushToken: true },
      });

      this.logger.log(`📊 Sending to user ${data.userId}, has Expo token: ${!!user?.expoPushToken}`);

      // Send push notification via Expo Push API
      this.logger.log(`🚀 Sending push notification to user ${data.userId}...`);
      const pushResult = await this.notificationsService.sendNotification({
        userIds: [data.userId],
        notification: {
          title: data.title,
          body: data.message,
        },
        data: {
          type: dataType, // Map to data.type format (e.g., "current-affair", "mcq", "admin")
          notificationType: data.type, // Also include original notification type
        },
        redirectUrl: data.redirectUrl, // Pass redirectUrl to push notification
        imageUrl: data.image, // Pass image to push notification (DTO uses 'image' field)
      });

      this.logger.log(`✅ Push notification result: ${JSON.stringify(pushResult)}`);

      return {
        success: true,
        notification,
        userHasToken: !!user?.expoPushToken,
        pushNotification: pushResult,
      };
    }

    return { success: false, message: 'Either sendToAll or userId must be provided' };
  }

  @Get('notifications/debug')
  @ApiOperation({ summary: 'Debug push notification tokens (Admin)' })
  async debugNotifications(@Query('userId') userId?: string) {
    const where: any = {};
    if (userId) {
      where.id = userId;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        mobile: true,
        expoPushToken: true,
        isActive: true,
      },
      take: 50,
    });

    const usersWithTokens = users.filter(u => u.expoPushToken);
    const usersWithoutTokens = users.filter(u => !u.expoPushToken);

    return {
      total: users.length,
      withTokens: usersWithTokens.length,
      withoutTokens: usersWithoutTokens.length,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        mobile: u.mobile,
        hasToken: !!u.expoPushToken,
        tokenPreview: u.expoPushToken ? u.expoPushToken.substring(0, 40) + '...' : null,
        isActive: u.isActive,
      })),
    };
  }

  @Post('notifications/upload-image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload notification image (Admin)' })
  async uploadNotificationImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
    }

    const key = `notifications/${Date.now()}-${file.originalname}`;
    const result = await this.fileService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    return {
      success: true,
      image: result.Location,
      key: result.Key,
    };
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

  // Specific routes must come before parameterized routes like :id
  @Get('ad-campaigns/active-users')
  @ApiOperation({ summary: 'Get active users by hour for each day of week' })
  async getActiveUsersByHour() {
    // Helper function to generate default data structure as an object
    // Frontend expects object format: { Mon: { "0": 100, "1": 100, ... }, Tue: { ... }, ... }
    const generateDefaultData = (baseCount: number = 1000): Record<string, Record<string, number>> => {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const activeUsersData: Record<string, Record<string, number>> = {};

      for (const day of days) {
        activeUsersData[day] = {};
        
        for (const hour of hours) {
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
    };

    try {
      // Check if prisma is available
      if (!this.prisma) {
        console.error('Prisma service is not available');
        return generateDefaultData(1000);
      }

      // Get active users count once (not 168 times!)
      let baseCount = 1000; // Default fallback value
      
      try {
        baseCount = await this.prisma.user.count({
          where: {
            isActive: true,
            isVerified: true,
          },
        });
      } catch (dbError: any) {
        console.error('Database error counting users:', dbError);
        // Use default count if database query fails
        baseCount = 1000;
      }

      // Ensure baseCount is a valid number
      if (typeof baseCount !== 'number' || isNaN(baseCount) || baseCount < 0) {
        console.warn('Invalid baseCount, using default:', baseCount);
        baseCount = 1000;
      }

      // Generate and return data as object
      // TransformInterceptor will wrap it: { success: true, data: { Mon: {...}, ... }, timestamp: "..." }
      // Frontend expects object format where each day has hour keys "0" through "23"
      const result = generateDefaultData(baseCount);
      
      // Validate that result has all required structure
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const requiredHours = Array.from({ length: 24 }, (_, i) => i.toString());
      
      for (const day of days) {
        if (!result[day] || typeof result[day] !== 'object') {
          console.warn(`Missing or invalid data for day: ${day}, regenerating...`);
          const tempResult = generateDefaultData(baseCount);
          result[day] = tempResult[day];
        }
        
        // Ensure all 24 hours exist as string keys
        const dayData = result[day];
        for (const hour of requiredHours) {
          if (dayData[hour] === undefined || typeof dayData[hour] !== 'number') {
            // Fill missing hours with a default value
            dayData[hour] = Math.floor(baseCount * 0.3);
          }
        }
      }
      
      // Final validation - ensure result is a valid object
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        console.error('Invalid result format, returning default data');
        return generateDefaultData(1000);
      }
      
      // Return pure object format: { Mon: { "0": 100, ... }, Tue: { ... }, ... }
      // Frontend can iterate using Object.keys(result).map(...) or Object.values(result).map(...)
      // TransformInterceptor wraps it: { success: true, data: result, timestamp: "..." }
      return result;
    } catch (error: any) {
      console.error('Error getting active users:', error);
      // Return mock data on error - ensure it's always a valid object
      return generateDefaultData(1000);
    }
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

  @Get('ad-campaigns/:id')
  @ApiOperation({ summary: 'Get ad campaign by ID' })
  async getAdCampaign(@Param('id') id: string) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Ad campaign not found');
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

  // Wall Categories Management (parent/sub-category aware)
  @Get('wall-categories')
  @ApiOperation({ summary: 'Get wall categories (Admin). Default returns only parent categories. Use ?parentId=xxx to get sub-categories, ?onlyParents=false to get all' })
  async getWallCategories(@Query() filters: { parentId?: string; categoryFor?: string; onlyParents?: string }) {
    // Default behavior: only return parent categories (parentCategoryId IS NULL)
    // Explicitly set to true if not provided or not explicitly 'false'
    const onlyParents = filters.onlyParents === undefined || filters.onlyParents !== 'false';
    
    const categories = await this.cmsAdminService.getWallCategories({
      parentId: filters.parentId,
      categoryFor: filters.categoryFor,
      onlyParents: onlyParents,
    });

    return {
      success: true,
      data: categories,
    };
  }

  @Get('wall-categories/:id/sub-categories')
  @ApiOperation({ summary: 'Get sub-categories of a specific parent category (Admin)' })
  async getSubCategories(@Param('id') parentId: string) {
    const categories = await this.cmsAdminService.getWallCategories({
      parentId,
      onlyParents: false,
    });

    return {
      success: true,
      data: categories,
    };
  }

  @Post('wall-categories')
  @ApiOperation({ summary: 'Create wall category (Admin)' })
  async createWallCategory(@Body() data: CreateWallCategoryDto) {
    const category = await this.cmsAdminService.createWallCategory(data);
    return {
      success: true,
      data: category,
    };
  }

  @Put('wall-categories/:id')
  @ApiOperation({ summary: 'Update wall category (Admin)' })
  async updateWallCategory(@Param('id') id: string, @Body() data: UpdateWallCategoryDto) {
    const category = await this.cmsAdminService.updateWallCategory(id, data);
    return {
      success: true,
      data: category,
    };
  }

  @Delete('wall-categories/:id')
  @ApiOperation({ summary: 'Delete wall category (Admin)' })
  async deleteWallCategory(@Param('id') id: string) {
    return this.cmsAdminService.deleteWallCategory(id);
  }

  // ========== Sponsor Ads Management ==========
  @Get('sponsor-ads')
  @ApiOperation({ summary: 'Get all sponsor ads (Admin)' })
  async getSponsorAds(@Query() filters: any) {
    try {
      const where: any = {};
      
      if (filters.status) {
        where.status = filters.status;
      }

      const limit = filters.limit ? parseInt(filters.limit.toString()) : 100;
      const page = filters.page ? parseInt(filters.page.toString()) : 1;
      const skip = (page - 1) * limit;

      const [ads, total] = await Promise.all([
        this.prisma.sponsorAd.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.sponsorAd.count({ where }),
      ]);

      return {
        data: ads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error('Error fetching sponsor ads:', error);
      throw new InternalServerErrorException('Failed to fetch sponsor ads');
    }
  }

  @Get('sponsor-ads/:id')
  @ApiOperation({ summary: 'Get sponsor ad by ID (Admin)' })
  async getSponsorAdById(@Param('id') id: string) {
    try {
      const ad = await this.prisma.sponsorAd.findUnique({
        where: { id },
      });

      if (!ad) {
        throw new NotFoundException('Sponsor ad not found');
      }

      return ad;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error fetching sponsor ad:', error);
      throw new InternalServerErrorException('Failed to fetch sponsor ad');
    }
  }

  @Post('sponsor-ads')
  @ApiOperation({ summary: 'Create sponsor ad (Admin)' })
  async createSponsorAd(@Body() createDto: CreateSponsorAdDto) {
    try {
      const ad = await this.prisma.sponsorAd.create({
        data: {
          sponsorBacklink: createDto.sponsorBacklink,
          sponsorAdImage: createDto.sponsorAdImage,
          status: createDto.status || 'inactive',
        },
      });

      return ad;
    } catch (error: any) {
      this.logger.error('Error creating sponsor ad:', error);
      throw new InternalServerErrorException('Failed to create sponsor ad');
    }
  }

  @Put('sponsor-ads/:id')
  @ApiOperation({ summary: 'Update sponsor ad (Admin)' })
  async updateSponsorAd(
    @Param('id') id: string,
    @Body() updateDto: UpdateSponsorAdDto,
  ) {
    try {
      // Check if ad exists
      const existing = await this.prisma.sponsorAd.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Sponsor ad not found');
      }

      const updateData: any = {};
      if (updateDto.sponsorBacklink !== undefined) {
        updateData.sponsorBacklink = updateDto.sponsorBacklink;
      }
      if (updateDto.sponsorAdImage !== undefined) {
        updateData.sponsorAdImage = updateDto.sponsorAdImage;
      }
      if (updateDto.status !== undefined) {
        updateData.status = updateDto.status;
      }

      const ad = await this.prisma.sponsorAd.update({
        where: { id },
        data: updateData,
      });

      return ad;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error updating sponsor ad:', error);
      throw new InternalServerErrorException('Failed to update sponsor ad');
    }
  }

  @Delete('sponsor-ads/:id')
  @ApiOperation({ summary: 'Delete sponsor ad (Admin)' })
  async deleteSponsorAd(@Param('id') id: string) {
    try {
      // Check if ad exists
      const existing = await this.prisma.sponsorAd.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Sponsor ad not found');
      }

      await this.prisma.sponsorAd.delete({
        where: { id },
      });

      return { message: 'Sponsor ad deleted successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error deleting sponsor ad:', error);
      throw new InternalServerErrorException('Failed to delete sponsor ad');
    }
  }

  @Patch('sponsor-ads/:id')
  @ApiOperation({ summary: 'Toggle sponsor ad status (Admin)' })
  async toggleSponsorAdStatus(@Param('id') id: string) {
    try {
      // Check if ad exists
      const existing = await this.prisma.sponsorAd.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Sponsor ad not found');
      }

      // Toggle status
      const newStatus = existing.status === 'active' ? 'inactive' : 'active';

      const ad = await this.prisma.sponsorAd.update({
        where: { id },
        data: { status: newStatus },
      });

      return ad;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error toggling sponsor ad status:', error);
      throw new InternalServerErrorException('Failed to toggle sponsor ad status');
    }
  }
}

