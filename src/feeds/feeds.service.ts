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
    metadata?: any;
  }) {
    // Handle job-specific validations and processing
    // Clone metadata to avoid mutating the original object
    let processedMetadata = data.metadata 
      ? (typeof data.metadata === 'object' ? JSON.parse(JSON.stringify(data.metadata)) : {})
      : {};

    if (data.postType === 'JOB' && processedMetadata) {
      // Validate isPublic and isPrivate are mutually exclusive
      if (processedMetadata.isPublic === true && processedMetadata.isPrivate === true) {
        throw new BadRequestException('isPublic and isPrivate cannot both be true');
      }

      // Validate privateFilters if isPrivate is true
      if (processedMetadata.isPrivate === true) {
        const privateFilters = processedMetadata.privateFilters || {};
        const hasFilter = 
          privateFilters.selectCollege || 
          privateFilters.selectCourse || 
          privateFilters.selectCourseCategory || 
          privateFilters.selectYear;
        
        if (!hasFilter) {
          throw new BadRequestException('At least one private filter must be provided when isPrivate is true');
        }

        // Validate college exists if provided
        if (privateFilters.selectCollege) {
          try {
            const college = await this.prisma.college.findUnique({
              where: { id: privateFilters.selectCollege },
            });
            if (!college) {
              throw new BadRequestException(`College with ID ${privateFilters.selectCollege} not found`);
            }
          } catch (error: any) {
            if (error instanceof BadRequestException) {
              throw error;
            }
            throw new BadRequestException(`Error validating college: ${error.message}`);
          }
        }

        // Validate course exists if provided
        if (privateFilters.selectCourse) {
          try {
            const course = await this.prisma.course.findUnique({
              where: { id: privateFilters.selectCourse },
            });
            if (!course) {
              throw new BadRequestException(`Course with ID ${privateFilters.selectCourse} not found`);
            }
          } catch (error: any) {
            if (error instanceof BadRequestException) {
              throw error;
            }
            throw new BadRequestException(`Error validating course: ${error.message}`);
          }
        }

        // Validate year if provided
        if (privateFilters.selectYear && !['1', '2', '3', '4'].includes(String(privateFilters.selectYear))) {
          throw new BadRequestException('selectYear must be "1", "2", "3", or "4"');
        }
      }

      // Validate candidate qualities
      if (processedMetadata.candidateQualities && !validateCandidateQualities(processedMetadata.candidateQualities)) {
        throw new BadRequestException('Invalid candidate quality. Valid values: outgoing, realistic, structured, prioritizes_fairness, reserved, conceptual, open_ended, people_impact');
      }

      // Parse yearlySalary and populate salaryMin/salaryMax
      if (processedMetadata.yearlySalary) {
        const { salaryMin, salaryMax } = parseYearlySalary(processedMetadata.yearlySalary);
        processedMetadata.salaryMin = processedMetadata.salaryMin ?? salaryMin;
        processedMetadata.salaryMax = processedMetadata.salaryMax ?? salaryMax;
      }

      // Set defaults for isPublic/isPrivate if not provided
      if (processedMetadata.isPublic === undefined && processedMetadata.isPrivate === undefined) {
        processedMetadata.isPublic = true;
        processedMetadata.isPrivate = false;
      }

      // Remove privateFilters if isPrivate is false
      if (processedMetadata.isPrivate === false) {
        delete processedMetadata.privateFilters;
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
          metadata: processedMetadata || {},
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
        data: { ...data, metadata: data.metadata ? 'present' : 'missing' },
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

    // Job-specific filtering using Prisma JSONB syntax
    if (filters.type === 'JOB') {
      const metadataFilters: any[] = [];
      
      if (filters.isPublic !== undefined) {
        metadataFilters.push({
          metadata: { path: ['isPublic'], equals: filters.isPublic },
        });
      }
      if (filters.isPrivate !== undefined) {
        metadataFilters.push({
          metadata: { path: ['isPrivate'], equals: filters.isPrivate },
        });
      }
      if (filters.jobType) {
        metadataFilters.push({
          metadata: { path: ['jobType'], equals: filters.jobType },
        });
      }
      if (filters.industry) {
        metadataFilters.push({
          metadata: { path: ['industry'], equals: filters.industry },
        });
      }
      if (filters.function) {
        metadataFilters.push({
          metadata: { path: ['function'], equals: filters.function },
        });
      }
      
      // Combine metadata filters with AND logic
      if (metadataFilters.length > 0) {
        where.AND = [...(where.AND || []), ...metadataFilters];
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

