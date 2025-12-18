import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeedType } from '@/shared';
import { parseYearlySalary, validateCandidateQualities } from '../common/utils/validation.helpers';
import { updateCategoryPostCount } from '../common/utils/category.helpers';

@Injectable()
export class FeedsService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

  async createFeed(userId: string, data: {
    title: string;
    description: string;
    postType: FeedType;
    categoryId?: string;
    images?: string[];
    // Job fields (now as direct properties, not in metadata)
    companyName?: string;
    industry?: string;
    selectRole?: string;
    jobLocation?: string;
    clientToManage?: string;
    workingDays?: string;
    yearlySalary?: string;
    salaryMin?: number;
    salaryMax?: number;
    skills?: string[];
    jobFunction?: string;
    experience?: string;
    jobType?: string;
    capacity?: string;
    workTime?: string;
    perksAndBenefits?: string;
    candidateQualities?: string[];
    isPublic?: boolean;
    isPrivate?: boolean;
    privateFiltersCollege?: string;
    privateFiltersCourse?: string;
    privateFiltersCourseCategory?: string;
    privateFiltersYear?: string;
  }) {
    // Handle job-specific validations
    if (data.postType === 'JOB') {
      // Validate isPublic and isPrivate are mutually exclusive
      if (data.isPublic === true && data.isPrivate === true) {
        throw new BadRequestException('isPublic and isPrivate cannot both be true');
      }

      // Validate privateFilters if isPrivate is true
      if (data.isPrivate === true) {
        const hasFilter = 
          data.privateFiltersCollege || 
          data.privateFiltersCourse || 
          data.privateFiltersCourseCategory || 
          data.privateFiltersYear;
        
        if (!hasFilter) {
          throw new BadRequestException('At least one private filter must be provided when isPrivate is true');
        }

        // Validate college exists if provided
        if (data.privateFiltersCollege) {
          try {
            const college = await this.prisma.college.findUnique({
              where: { id: data.privateFiltersCollege },
            });
            if (!college) {
              throw new BadRequestException(`College with ID ${data.privateFiltersCollege} not found`);
            }
          } catch (error: any) {
            if (error instanceof BadRequestException) {
              throw error;
            }
            throw new BadRequestException(`Error validating college: ${error.message}`);
          }
        }

        // Validate course exists if provided
        if (data.privateFiltersCourse) {
          try {
            const course = await this.prisma.course.findUnique({
              where: { id: data.privateFiltersCourse },
            });
            if (!course) {
              throw new BadRequestException(`Course with ID ${data.privateFiltersCourse} not found`);
            }
          } catch (error: any) {
            if (error instanceof BadRequestException) {
              throw error;
            }
            throw new BadRequestException(`Error validating course: ${error.message}`);
          }
        }

        // Validate year if provided
        if (data.privateFiltersYear && !['1', '2', '3', '4'].includes(String(data.privateFiltersYear))) {
          throw new BadRequestException('privateFiltersYear must be "1", "2", "3", or "4"');
        }
      }

      // Validate candidate qualities
      if (data.candidateQualities && !validateCandidateQualities(data.candidateQualities)) {
        throw new BadRequestException('Invalid candidate quality. Valid values: outgoing, realistic, structured, prioritizes_fairness, reserved, conceptual, open_ended, people_impact');
      }

      // Parse yearlySalary and populate salaryMin/salaryMax
      if (data.yearlySalary) {
        const { salaryMin, salaryMax } = parseYearlySalary(data.yearlySalary);
        data.salaryMin = data.salaryMin ?? salaryMin;
        data.salaryMax = data.salaryMax ?? salaryMax;
      }

      // Set defaults for isPublic/isPrivate if not provided
      if (data.isPublic === undefined && data.isPrivate === undefined) {
        data.isPublic = true;
        data.isPrivate = false;
      }
    }

    try {
      const feed = await this.prisma.post.create({
        data: {
          userId,
          title: data.title,
          description: data.description,
          postType: data.postType,
          categoryId: data.categoryId,
          images: data.images || [],
          // Job fields (now as columns)
          companyName: data.companyName,
          industry: data.industry,
          selectRole: data.selectRole,
          jobLocation: data.jobLocation,
          clientToManage: data.clientToManage,
          workingDays: data.workingDays,
          yearlySalary: data.yearlySalary,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          skills: data.skills || [],
          jobFunction: data.jobFunction,
          experience: data.experience,
          jobType: data.jobType as any, // Cast to enum
          capacity: data.capacity,
          workTime: data.workTime,
          perksAndBenefits: data.perksAndBenefits,
          candidateQualities: data.candidateQualities || [],
          isPublic: data.isPublic,
          isPrivate: data.isPrivate,
          privateFiltersCollege: data.privateFiltersCollege,
          privateFiltersCourse: data.privateFiltersCourse,
          privateFiltersCourseCategory: data.privateFiltersCourseCategory,
          privateFiltersYear: data.privateFiltersYear,
        },
      });

      // Track event (don't fail if analytics fails)
      try {
        await this.analytics.trackEvent(userId, 'feed_created', 'feed', feed.id);
      } catch (analyticsError) {
        // Log but don't fail the request if analytics fails
        console.warn('Analytics tracking failed:', analyticsError);
      }

      // Update category postCount
      if (feed.categoryId) {
        await updateCategoryPostCount(this.prisma, feed.categoryId);
      }

      return feed;
    } catch (error: any) {
      // Provide more helpful error messages
      if (error.code === 'P2002') {
        throw new BadRequestException('A feed with this information already exists');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('Invalid reference: category or user not found');
      }
      // Log the error for debugging
      console.error('Error creating feed:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        data: { title: data.title, postType: data.postType },
      });
      throw error;
    }
  }

  async getFeeds(filters: {
    type?: FeedType;
    search?: string;
    category?: string;
    tags?: string[];
    college?: string;
    recency?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    // Job-specific filters
    isPublic?: boolean;
    isPrivate?: boolean;
    jobType?: string;
    industry?: string;
    function?: string;
    salaryMin?: number;
    salaryMax?: number;
  }, userId?: string) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    if (filters.type) {
      where.postType = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.category) {
      where.categoryId = filters.category;
    }

    // Job-specific filtering using direct columns
    if (filters.type === 'JOB') {
      if (filters.isPublic !== undefined) {
        where.isPublic = filters.isPublic;
      }
      if (filters.isPrivate !== undefined) {
        where.isPrivate = filters.isPrivate;
      }
      if (filters.jobType) {
        where.jobType = filters.jobType;
      }
      if (filters.industry) {
        where.industry = filters.industry;
      }
      if (filters.function) {
        where.jobFunction = filters.function;
      }
      if (filters.salaryMin !== undefined) {
        where.salaryMin = { gte: filters.salaryMin };
      }
      if (filters.salaryMax !== undefined) {
        where.salaryMax = { lte: filters.salaryMax };
      }
    }

    const [feeds, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: filters.recency === 'asc' ? 'asc' : 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              mobile: true,
              profileImage: true,
            },
          },
          category: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: feeds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeedById(id: string) {
    const feed = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            mobile: true,
            profileImage: true,
          },
        },
        category: true,
        likes: true,
        comments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    return feed;
  }

  async likeFeed(userId: string, feedId: string) {
    const existing = await this.prisma.postLike.findUnique({
      where: {
        userId_postId: {
          userId,
          postId: feedId,
        },
      },
    });

    if (existing) {
      await this.prisma.postLike.delete({
        where: { id: existing.id },
      });
      await this.analytics.trackEvent(userId, 'feed_unlike', 'feed', feedId);
      return { liked: false };
    }

    await this.prisma.postLike.create({
      data: {
        userId,
        postId: feedId,
      },
    });

    await this.analytics.trackEvent(userId, 'feed_like', 'feed', feedId);

    return { liked: true };
  }

  async bookmarkFeed(userId: string, feedId: string) {
    const existing = await this.prisma.postBookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId: feedId,
        },
      },
    });

    if (existing) {
      await this.prisma.postBookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false };
    }

    await this.prisma.postBookmark.create({
      data: {
        userId,
        postId: feedId,
      },
    });

    await this.analytics.trackEvent(userId, 'feed_save', 'feed', feedId);

    return { bookmarked: true };
  }

  async commentOnFeed(userId: string, feedId: string, comment: string) {
    const commentRecord = await this.prisma.postComment.create({
      data: {
        userId,
        postId: feedId,
        comment,
      },
    });

    return commentRecord;
  }
}

