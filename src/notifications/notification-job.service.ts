import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { mapNotificationTypeToDataType } from './utils/notification-type-mapper';

@Injectable()
export class NotificationJobService {
  private readonly logger = new Logger(NotificationJobService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createJob(data: {
    messageType: string;
    title: string;
    content: string;
    image?: string;
    redirectionLink?: string;
    scheduledAt: Date;
    language: 'ALL' | 'ENGLISH' | 'HINDI';
    frequency: 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    userIds?: string[];
    phoneNumbers?: string[];
    filterConditions?: any;
    createdBy: string;
  }) {
    // Validate that at least one targeting method is selected
    // Note: userIds can be null (broadcast to all), array (specific users), or undefined (not set)
    const hasUserIds = data.userIds !== undefined; // null or array both count as "set"
    const hasPhoneNumbers = data.phoneNumbers && data.phoneNumbers.length > 0;
    const hasFilterConditions = data.filterConditions && 
      Object.keys(data.filterConditions).length > 0 &&
      !(data.filterConditions.userIds && data.filterConditions.userIds.length === 0) &&
      !(data.filterConditions.phoneNumbers && data.filterConditions.phoneNumbers.length === 0);

    if (!hasUserIds && !hasPhoneNumbers && !hasFilterConditions) {
      throw new BadRequestException(
        'Please select at least one targeting method: specific users, phone numbers, or filter conditions'
      );
    }

    // Merge userIds and phoneNumbers into filterConditions for storage
    // Store null explicitly for "broadcast to all" scenario
    const filterConditions: any = {
      ...(data.filterConditions || {}),
    };
    
    // Store userIds: null for broadcast, array for specific users, or omit if undefined
    if (data.userIds !== undefined) {
      filterConditions.userIds = data.userIds; // Can be null or string[]
    }
    
    if (data.phoneNumbers && data.phoneNumbers.length > 0) {
      filterConditions.phoneNumbers = data.phoneNumbers;
    }
    // Calculate nextSendAt based on frequency
    let nextSendAt = new Date(data.scheduledAt);
    
    if (data.frequency === 'HOURLY') {
      nextSendAt = new Date(data.scheduledAt);
      nextSendAt.setHours(nextSendAt.getHours() + 1);
    } else if (data.frequency === 'DAILY') {
      nextSendAt = new Date(data.scheduledAt);
      nextSendAt.setDate(nextSendAt.getDate() + 1);
    } else if (data.frequency === 'WEEKLY') {
      nextSendAt = new Date(data.scheduledAt);
      nextSendAt.setDate(nextSendAt.getDate() + 7);
    } else if (data.frequency === 'MONTHLY') {
      nextSendAt = new Date(data.scheduledAt);
      nextSendAt.setMonth(nextSendAt.getMonth() + 1);
    }

    const job = await this.prisma.notificationJob.create({
      data: {
        messageType: data.messageType,
        title: data.title,
        content: data.content,
        image: data.image,
        redirectionLink: data.redirectionLink,
        scheduledAt: data.scheduledAt,
        language: data.language,
        frequency: data.frequency,
        filterConditions: filterConditions,
        createdBy: data.createdBy,
        nextSendAt: data.frequency === 'ONCE' ? null : nextSendAt,
        status: 'PENDING',
      },
    });

    this.logger.log(`✅ Created notification job ${job.id} scheduled for ${data.scheduledAt}`);
    return job;
  }

  async getJobs(filters?: {
    status?: string;
    messageType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.messageType) {
      where.messageType = filters.messageType;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.notificationJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { notifications: true },
          },
        },
      }),
      this.prisma.notificationJob.count({ where }),
    ]);

    // Extract userIds and phoneNumbers from filterConditions for easier frontend access
    const jobsWithExtractedFields = jobs.map(job => {
      const filters = (job.filterConditions as any) || {};
      return {
        ...job,
        // Preserve null explicitly (null = broadcast to all), otherwise return array or undefined
        userIds: filters.userIds !== undefined ? filters.userIds : undefined,
        phoneNumbers: filters.phoneNumbers || [],
      };
    });

    return {
      data: jobsWithExtractedFields,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobById(id: string) {
    const job = await this.prisma.notificationJob.findUnique({
      where: { id },
      include: {
        _count: {
          select: { notifications: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Notification job not found');
    }

    // Extract userIds and phoneNumbers from filterConditions for easier frontend access
    const filters = (job.filterConditions as any) || {};
    return {
      ...job,
      // Preserve null explicitly (null = broadcast to all), otherwise return array or undefined
      userIds: filters.userIds !== undefined ? filters.userIds : undefined,
      phoneNumbers: filters.phoneNumbers || [],
    };
  }

  async updateJob(id: string, data: Partial<{
    messageType: string;
    title: string;
    content: string;
    image: string;
    redirectionLink: string;
    scheduledAt: Date;
    language: 'ALL' | 'ENGLISH' | 'HINDI';
    frequency: 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    userIds?: string[];
    phoneNumbers?: string[];
    filterConditions: any;
    status: string;
  }>) {
    // If userIds or phoneNumbers are provided, merge them into filterConditions
    if (data.userIds !== undefined || data.phoneNumbers !== undefined) {
      const existingJob = await this.getJobById(id);
      const existingFilters = (existingJob.filterConditions as any) || {};
      
      const updatedFilters: any = {
        ...existingFilters,
        ...(data.filterConditions || {}),
      };

      // Update userIds if provided
      if (data.userIds !== undefined) {
        if (data.userIds.length > 0) {
          updatedFilters.userIds = data.userIds;
        } else {
          delete updatedFilters.userIds;
        }
      }

      // Update phoneNumbers if provided
      if (data.phoneNumbers !== undefined) {
        if (data.phoneNumbers.length > 0) {
          updatedFilters.phoneNumbers = data.phoneNumbers;
        } else {
          delete updatedFilters.phoneNumbers;
        }
      }

      // Validate that at least one targeting method is selected
      // Note: userIds can be null (broadcast to all), array (specific users), or undefined (not set)
      const hasUserIds = updatedFilters.userIds !== undefined; // null or array both count as "set"
      const hasPhoneNumbers = updatedFilters.phoneNumbers && Array.isArray(updatedFilters.phoneNumbers) && updatedFilters.phoneNumbers.length > 0;
      const hasOtherFilters = Object.keys(updatedFilters).some(key => {
        if (key === 'userIds' || key === 'phoneNumbers') return false;
        const value = updatedFilters[key];
        return value !== null && value !== undefined && value !== '' && 
               !(Array.isArray(value) && value.length === 0) &&
               !(typeof value === 'object' && Object.keys(value).length === 0);
      });

      if (!hasUserIds && !hasPhoneNumbers && !hasOtherFilters) {
        throw new BadRequestException(
          'Please select at least one targeting method: specific users, phone numbers, or filter conditions'
        );
      }

      data.filterConditions = updatedFilters;
      // Remove userIds and phoneNumbers from data as they're now in filterConditions
      delete (data as any).userIds;
      delete (data as any).phoneNumbers;
    }
    try {
      const existingJob = await this.getJobById(id);

      // Recalculate nextSendAt if scheduledAt or frequency changed
      let nextSendAt = existingJob.nextSendAt;
      if (data.scheduledAt || data.frequency) {
        const scheduledAt = data.scheduledAt || existingJob.scheduledAt;
        const frequency = data.frequency || existingJob.frequency;

        // Ensure scheduledAt is a Date object
        const scheduledDate = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
        
        if (isNaN(scheduledDate.getTime())) {
          throw new BadRequestException('Invalid scheduledAt date');
        }

        if (frequency === 'ONCE') {
          nextSendAt = null;
        } else if (frequency === 'HOURLY') {
          nextSendAt = new Date(scheduledDate);
          nextSendAt.setHours(nextSendAt.getHours() + 1);
        } else if (frequency === 'DAILY') {
          nextSendAt = new Date(scheduledDate);
          nextSendAt.setDate(nextSendAt.getDate() + 1);
        } else if (frequency === 'WEEKLY') {
          nextSendAt = new Date(scheduledDate);
          nextSendAt.setDate(nextSendAt.getDate() + 7);
        } else if (frequency === 'MONTHLY') {
          nextSendAt = new Date(scheduledDate);
          nextSendAt.setMonth(nextSendAt.getMonth() + 1);
        }
      }

      // Filter out undefined values and handle special cases
      const updateData: any = {};
      const allowedFields = ['messageType', 'title', 'content', 'image', 'redirectionLink', 'scheduledAt', 'language', 'frequency', 'filterConditions', 'status'];
      
      Object.keys(data).forEach(key => {
        // Only allow known fields
        if (!allowedFields.includes(key)) {
          this.logger.warn(`Skipping unknown field: ${key}`);
          return;
        }
        
        if (data[key] !== undefined) {
          // Handle image field - accept any string value (including data URIs)
          if (key === 'image') {
            const imageValue = data[key] as string;
            // If empty string, set to null, otherwise keep the value
            updateData[key] = imageValue && imageValue.trim() !== '' ? imageValue : null;
          } 
          // Handle filterConditions - ensure it's an object
          else if (key === 'filterConditions' && data[key] !== null) {
            updateData[key] = typeof data[key] === 'object' ? data[key] : {};
          }
          // Handle other fields normally
          else {
            updateData[key] = data[key];
          }
        }
      });

      // Add nextSendAt if it was recalculated
      if (data.scheduledAt || data.frequency) {
        updateData.nextSendAt = nextSendAt;
      }

      // Only update if there's actual data to update
      if (Object.keys(updateData).length === 0) {
        this.logger.warn(`No valid fields to update for notification job ${id}`);
        return existingJob;
      }

      this.logger.debug(`Updating notification job ${id} with fields: ${Object.keys(updateData).join(', ')}`);

      const updated = await this.prisma.notificationJob.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`✅ Updated notification job ${id}`);
      return updated;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating notification job ${id}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to update notification job: ${error.message}`);
    }
  }

  async deleteJob(id: string) {
    const job = await this.getJobById(id);
    
    // Only allow deletion if job hasn't sent any notifications yet
    if (job.totalSent > 0) {
      throw new BadRequestException('Cannot delete job that has already sent notifications');
    }

    await this.prisma.notificationJob.delete({
      where: { id },
    });

    this.logger.log(`✅ Deleted notification job ${id}`);
    return { success: true };
  }

  async executeJob(jobId: string) {
    const job = await this.getJobById(jobId);

    if (job.status === 'CANCELLED') {
      this.logger.warn(`⚠️ Job ${jobId} is cancelled, skipping execution`);
      return { success: false, reason: 'Job is cancelled' };
    }

    if (job.status === 'COMPLETED' && job.frequency === 'ONCE') {
      this.logger.warn(`⚠️ One-time job ${jobId} already completed`);
      return { success: false, reason: 'Job already completed' };
    }

    // Extract targeting information from filterConditions
    const filters = (job.filterConditions as any) || {};
    const targetUserIds = filters.userIds; // Can be null, array, or undefined
    const targetPhoneNumbers = filters.phoneNumbers || [];

    // Map messageType to data.type for mobile app filtering
    const dataType = mapNotificationTypeToDataType(job.messageType);

    // Prepare notification payload (matching immediate notification format)
    const notificationPayload = {
      title: job.title,
      body: job.content, // content → body
      data: {
        type: dataType,
        notificationType: job.messageType,
        jobId: job.id,
      },
      redirectUrl: job.redirectionLink, // redirectionLink → redirectUrl
      imageUrl: job.image, // image → imageUrl
    };

    let result: any;
    let successCount = 0;
    let failCount = 0;

    // Determine targeting strategy (same logic as immediate notifications)
    if (targetUserIds !== undefined) {
      // userIds is explicitly set (null = broadcast, array = specific users)
      if (targetUserIds === null || (Array.isArray(targetUserIds) && targetUserIds.length === 0)) {
        // Broadcast to all users
        this.logger.log(`📤 Executing job ${jobId}: Broadcasting to all users (userIds: null)`);
        
        // Get all users for notification records (apply language filter if needed)
        const where: any = { isActive: true };
        if (job.language !== 'ALL') {
          where.studentProfile = {
            preferredLanguage: job.language === 'ENGLISH' ? 'english' : 'hindi',
          };
        }
        
        const users = await this.prisma.user.findMany({
          where,
          select: { id: true },
        });

        // Create notification records
        await this.prisma.notification.createMany({
          data: users.map(user => ({
            userId: user.id,
            title: job.title,
            message: job.content,
            type: job.messageType as any,
            jobId: job.id,
          })),
        });

        // Send push notifications (broadcast)
        result = await this.notificationsService.sendNotification({
          userIds: null, // Explicitly null for broadcast
          notification: {
            title: job.title,
            body: job.content,
          },
          data: notificationPayload.data,
          redirectUrl: notificationPayload.redirectUrl,
          imageUrl: notificationPayload.imageUrl,
        });

        successCount = users.length;
      } else if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        // Send to specific users
        this.logger.log(`📤 Executing job ${jobId}: Targeting ${targetUserIds.length} specific users`);
        
        // Get users for notification records
        const users = await this.prisma.user.findMany({
          where: {
            id: { in: targetUserIds },
            isActive: true,
          },
          select: { id: true },
        });

        // Create notification records
        await this.prisma.notification.createMany({
          data: users.map(user => ({
            userId: user.id,
            title: job.title,
            message: job.content,
            type: job.messageType as any,
            jobId: job.id,
          })),
        });

        // Send push notifications to specific users
        result = await this.notificationsService.sendNotification({
          userIds: targetUserIds,
          notification: {
            title: job.title,
            body: job.content,
          },
          data: notificationPayload.data,
          redirectUrl: notificationPayload.redirectUrl,
          imageUrl: notificationPayload.imageUrl,
        });

        successCount = users.length;
      }
    } else if (targetPhoneNumbers && targetPhoneNumbers.length > 0) {
      // Find users by phone numbers
      this.logger.log(`📤 Executing job ${jobId}: Targeting ${targetPhoneNumbers.length} users by phone number`);
      
      const users = await this.prisma.user.findMany({
        where: {
          mobile: { in: targetPhoneNumbers },
          isActive: true,
        },
        select: { id: true },
      });

      if (users.length > 0) {
        const userIds = users.map(u => u.id);
        
        // Create notification records
        await this.prisma.notification.createMany({
          data: users.map(user => ({
            userId: user.id,
            title: job.title,
            message: job.content,
            type: job.messageType as any,
            jobId: job.id,
          })),
        });

        // Send push notifications
        result = await this.notificationsService.sendNotification({
          userIds: userIds,
          notification: {
            title: job.title,
            body: job.content,
          },
          data: notificationPayload.data,
          redirectUrl: notificationPayload.redirectUrl,
          imageUrl: notificationPayload.imageUrl,
        });

        successCount = users.length;
      }
    } else {
      // Use filter conditions (college, course, stage, etc.)
      this.logger.log(`📤 Executing job ${jobId}: Using filter conditions`);
      
      // Build user filter conditions
      const where: any = {
        isActive: true,
      };

      // Apply language filter
      if (job.language !== 'ALL') {
        where.studentProfile = {
          preferredLanguage: job.language === 'ENGLISH' ? 'english' : 'hindi',
        };
      }

      // Apply additional filter conditions from filterConditions JSON
      if (job.filterConditions && typeof job.filterConditions === 'object') {
        if (filters.collegeId) {
          where.studentProfile = {
            ...where.studentProfile,
            collegeId: filters.collegeId,
          };
        }
        
        if (filters.courseId) {
          where.studentProfile = {
            ...where.studentProfile,
            courseId: filters.courseId,
          };
        }
        
        if (filters.stage) {
          where.studentProfile = {
            ...where.studentProfile,
            stage: filters.stage,
          };
        }
      }

      // Get users matching filters
      const users = await this.prisma.user.findMany({
        where,
        select: { id: true },
      });

      if (users.length > 0) {
        const userIds = users.map(u => u.id);
        
        // Create notification records
        await this.prisma.notification.createMany({
          data: users.map(user => ({
            userId: user.id,
            title: job.title,
            message: job.content,
            type: job.messageType as any,
            jobId: job.id,
          })),
        });

        // Send push notifications
        result = await this.notificationsService.sendNotification({
          userIds: userIds,
          notification: {
            title: job.title,
            body: job.content,
          },
          data: notificationPayload.data,
          redirectUrl: notificationPayload.redirectUrl,
          imageUrl: notificationPayload.imageUrl,
        });

        successCount = users.length;
      } else {
        this.logger.warn(`⚠️ No users found matching filter conditions for job ${jobId}`);
      }
    }

    // Log push notification result if available
    if (result) {
      this.logger.log(`📊 Push notification result: ${JSON.stringify(result)}`);
    }

    // Update job status
    const updateData: any = {
      lastSentAt: new Date(),
      totalSent: { increment: successCount },
      totalFailed: { increment: failCount },
    };

    // Calculate next send time for recurring jobs
    if (job.frequency !== 'ONCE') {
      let nextSendAt = new Date();
      if (job.frequency === 'HOURLY') {
        nextSendAt.setHours(nextSendAt.getHours() + 1);
      } else if (job.frequency === 'DAILY') {
        nextSendAt.setDate(nextSendAt.getDate() + 1);
      } else if (job.frequency === 'WEEKLY') {
        nextSendAt.setDate(nextSendAt.getDate() + 7);
      } else if (job.frequency === 'MONTHLY') {
        nextSendAt.setMonth(nextSendAt.getMonth() + 1);
      }
      updateData.nextSendAt = nextSendAt;
      updateData.status = 'ACTIVE';
    } else {
      updateData.status = 'COMPLETED';
    }

    await this.prisma.notificationJob.update({
      where: { id: jobId },
      data: updateData,
    });

    this.logger.log(`✅ Job ${jobId} executed: ${successCount} sent, ${failCount} failed`);

    return {
      success: true,
      sent: successCount,
      failed: failCount,
      total: successCount, // Total notifications sent (notification records created)
    };
  }

  // Get jobs that need to be executed (scheduled time has passed)
  async getPendingJobs() {
    const now = new Date();
    
    return this.prisma.notificationJob.findMany({
      where: {
        status: { in: ['PENDING', 'ACTIVE'] },
        OR: [
          { scheduledAt: { lte: now } },
          { nextSendAt: { lte: now } },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
