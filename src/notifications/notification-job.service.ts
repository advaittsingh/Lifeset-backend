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
    filterConditions?: any;
    createdBy: string;
  }) {
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
        filterConditions: data.filterConditions || {},
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

    return {
      data: jobs,
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

    return job;
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
    filterConditions: any;
    status: string;
  }>) {
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
      const filters = job.filterConditions as any;
      
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
      select: {
        id: true,
        studentProfile: {
          select: {
            preferredLanguage: true,
          },
        },
      },
    });

    this.logger.log(`📤 Executing job ${jobId} for ${users.length} users`);

    let successCount = 0;
    let failCount = 0;

    // Send notifications to all matching users
    for (const user of users) {
      try {
        // Check language filter if specified
        if (job.language !== 'ALL') {
          const userLang = user.studentProfile?.preferredLanguage?.toUpperCase() || 'ENGLISH';
          const jobLang = job.language;
          if (jobLang !== 'ALL' && userLang !== jobLang) {
            continue; // Skip user if language doesn't match
          }
        }

        // Map messageType to data.type for mobile app filtering
        const dataType = mapNotificationTypeToDataType(job.messageType);

        await this.notificationsService.createNotification(user.id, {
          title: job.title,
          message: job.content,
          type: job.messageType as any,
          jobId: job.id, // Link notification to job
          notificationData: {
            type: dataType, // Set data.type for mobile app filtering
            notificationType: job.messageType, // Also include original type
            jobId: job.id,
            ...(job.redirectionLink && { redirectUrl: job.redirectionLink }),
            ...(job.image && { image: job.image }),
          },
        });

        successCount++;
      } catch (error: any) {
        this.logger.error(`❌ Failed to send notification to user ${user.id}: ${error.message}`);
        failCount++;
      }
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
      total: users.length,
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
