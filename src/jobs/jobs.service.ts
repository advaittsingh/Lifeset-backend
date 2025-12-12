import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

  async createJobPost(companyId: string, postId: string, data: {
    jobTitle: string;
    jobDescription: string;
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    experience?: string;
    skills?: string[];
    applicationDeadline?: Date;
  }) {
    return this.prisma.jobPost.create({
      data: {
        postId,
        jobTitle: data.jobTitle,
        jobDescription: data.jobDescription,
        location: data.location,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        experience: data.experience,
        skills: data.skills || [],
        applicationDeadline: data.applicationDeadline,
      },
    });
  }

  async getJobs(filters: {
    search?: string;
    location?: string;
    skills?: string[];
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      post: { isActive: true },
    };

    if (filters.search) {
      where.OR = [
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
        { jobDescription: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.skills && filters.skills.length > 0) {
      where.skills = { hasSome: filters.skills };
    }

    const [jobs, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        skip,
        take: limit,
        include: {
          post: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  profileImage: true,
                },
              },
            },
          },
          _count: {
            select: {
              jobApplications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jobPost.count({ where }),
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

  async getJobById(id: string, userId?: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            jobApplications: true,
            viewActivities: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Track view
    if (userId) {
      await this.prisma.jobViewActivity.create({
        data: {
          jobPostId: id,
          userId,
        },
      });

      await this.prisma.jobPost.update({
        where: { id },
        data: { views: { increment: 1 } },
      });

      await this.analytics.trackEvent(userId, 'job_view', 'job', id);
    }

    return job;
  }

  async applyForJob(userId: string, jobPostId: string, postId: string, coverLetter?: string) {
    const existing = await this.prisma.jobApplication.findFirst({
      where: {
        userId,
        jobPostId,
      },
    });

    if (existing) {
      throw new Error('Already applied for this job');
    }

    const application = await this.prisma.jobApplication.create({
      data: {
        userId,
        jobPostId,
        postId,
        coverLetter,
        status: 'pending',
      },
    });

    await this.prisma.jobPost.update({
      where: { id: jobPostId },
      data: { applications: { increment: 1 } },
    });

    await this.analytics.trackEvent(userId, 'job_apply', 'job', jobPostId);

    return application;
  }

  async getApplications(jobPostId: string) {
    return this.prisma.jobApplication.findMany({
      where: { jobPostId },
      include: {
        user: {
          include: {
            studentProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async shortlistCandidate(applicationId: string, status: string) {
    return this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
    });
  }
}

