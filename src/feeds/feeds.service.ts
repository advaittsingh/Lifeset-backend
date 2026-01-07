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
    experience?: string | number;
    jobType?: string;
    capacity?: string | number;
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
          // Job fields removed from schema - storing in metadata if needed
          metadata: {
            ...(data.companyName && { companyName: data.companyName }),
            ...(data.industry && { industry: data.industry }),
            ...(data.selectRole && { selectRole: data.selectRole }),
            ...(data.jobLocation && { jobLocation: data.jobLocation }),
            ...(data.clientToManage && { clientToManage: data.clientToManage }),
            ...(data.workingDays && { workingDays: data.workingDays }),
            ...(data.yearlySalary && { yearlySalary: data.yearlySalary }),
            ...(data.salaryMin && { salaryMin: data.salaryMin }),
            ...(data.salaryMax && { salaryMax: data.salaryMax }),
            ...(data.skills && data.skills.length > 0 && { skills: data.skills }),
            ...(data.jobFunction && { jobFunction: data.jobFunction }),
            ...(data.experience && { experience: String(data.experience) }),
            ...(data.jobType && { jobType: data.jobType }),
            ...(data.capacity && { capacity: String(data.capacity) }),
            ...(data.workTime && { workTime: data.workTime }),
            ...(data.perksAndBenefits && { perksAndBenefits: data.perksAndBenefits }),
            ...(data.candidateQualities && data.candidateQualities.length > 0 && { candidateQualities: data.candidateQualities }),
            ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
            ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
            ...(data.privateFiltersCollege && { privateFiltersCollege: data.privateFiltersCollege }),
            ...(data.privateFiltersCourse && { privateFiltersCourse: data.privateFiltersCourse }),
            ...(data.privateFiltersCourseCategory && { privateFiltersCourseCategory: data.privateFiltersCourseCategory }),
            ...(data.privateFiltersYear && { privateFiltersYear: data.privateFiltersYear }),
          },
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

  // Lightweight list endpoint for Feeds (optimized for list views)
  async getFeedsList(filters: {
    type?: FeedType;
    search?: string;
    category?: string;
    tags?: string[];
    college?: string;
    recency?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    userId?: string;
  }, userId?: string) {
    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    if (filters.type) {
      where.postType = filters.type;
    }

    const targetUserId = filters.userId || userId;
    if (targetUserId) {
      where.userId = targetUserId;
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

    const [feeds, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          postType: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              profileImage: true,
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
        orderBy: {
          createdAt: filters.recency === 'asc' ? 'asc' : 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Truncate description to 200 chars for list view
    const enhancedFeeds = feeds.map(feed => ({
      ...feed,
      description: feed.description && feed.description.length > 200
        ? feed.description.substring(0, 200) + '...'
        : feed.description,
    }));

    return {
      data: enhancedFeeds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    userId?: string; // Filter by user ID to get user's own posts
    // Job-specific filters
    isPublic?: boolean;
    isPrivate?: boolean;
    jobType?: string;
    industry?: string;
    function?: string;
    salaryMin?: number;
    salaryMax?: number;
  }, userId?: string) {
    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    if (filters.type) {
      where.postType = filters.type;
    }

    // Filter by userId FIRST if provided (for getting user's own posts)
    // Priority: filters.userId (from query param) > userId (from auth context)
    // This ensures userId filter is always applied and not overridden by other filters
    const targetUserId = filters.userId || userId;
    if (targetUserId) {
      where.userId = targetUserId;
      // Log for debugging
      console.log('[FeedsService] Filtering posts by userId:', targetUserId, {
        fromQuery: !!filters.userId,
        fromAuth: !!userId && !filters.userId,
      });
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

    // Log the where clause for debugging when userId filter is applied
    if (targetUserId) {
      console.log('[FeedsService] Query where clause:', JSON.stringify(where, null, 2));
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

    // Log results when userId filter is applied
    if (targetUserId) {
      console.log('[FeedsService] Posts found for userId:', targetUserId, 'Total:', total);
    }

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

    // Extract full content from metadata for articles
    const metadata = feed.metadata as any || {};
    return {
      ...feed,
      // Extract full content from metadata - this is the full article text with HTML formatting
      content: metadata.fullArticle || metadata.content || feed.description, // Use fullArticle (with HTML) if available, fallback to content, then description
      fullArticle: metadata.fullArticle || null, // Also return as fullArticle for clarity
      quickViewContent: metadata.quickViewContent || null,
      headline: metadata.headline || null,
      articleDate: metadata.articleDate || null,
    };
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
    try {
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
        return { bookmarked: false, message: 'Bookmark removed successfully' };
      }

      try {
        await this.prisma.postBookmark.create({
          data: {
            userId,
            postId: feedId,
          },
        });

        await this.analytics.trackEvent(userId, 'feed_save', 'feed', feedId);
        return { bookmarked: true, message: 'Bookmarked successfully' };
      } catch (createError: any) {
        // Handle unique constraint error (P2002) - item already bookmarked
        if (createError.code === 'P2002') {
          // Item is already bookmarked, return success response
          return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
        }
        throw createError;
      }
    } catch (error: any) {
      // If it's a unique constraint error, treat as already bookmarked
      if (error.code === 'P2002') {
        return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
      }
      throw error;
    }
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

  async getBookmarkedFeeds(userId: string, filters: {
    type?: FeedType;
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    // First, get all bookmarked post IDs for this user
    const bookmarks = await this.prisma.postBookmark.findMany({
      where: { userId },
      select: { postId: true },
    });

    const bookmarkedPostIds = bookmarks.map(b => b.postId);

    if (bookmarkedPostIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Build where clause for posts
    const where: any = {
      id: { in: bookmarkedPostIds }, // Only posts that are bookmarked by this user
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

    const [feeds, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
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

    // Extract full content from metadata for articles
    const feedsWithContent = feeds.map(feed => {
      const metadata = feed.metadata as any || {};
      return {
        ...feed,
        content: metadata.fullArticle || metadata.content || feed.description,
        fullArticle: metadata.fullArticle || null,
        quickViewContent: metadata.quickViewContent || null,
        headline: metadata.headline || null,
        articleDate: metadata.articleDate || null,
        isBookmarked: true, // All posts in this list are bookmarked
      };
    });

    return {
      data: feedsWithContent,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

