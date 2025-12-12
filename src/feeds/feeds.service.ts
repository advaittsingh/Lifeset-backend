import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeedType } from '@/shared';

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
    const feed = await this.prisma.post.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        postType: data.postType,
        categoryId: data.categoryId,
        images: data.images || [],
        metadata: data.metadata || {},
      },
    });

    // Track event
    await this.analytics.trackEvent(userId, 'feed_created', 'feed', feed.id);

    return feed;
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
  }) {
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

