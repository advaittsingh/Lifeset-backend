import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(private prisma: PrismaService) {}

  async getPages() {
    // Placeholder - implement when Pages model is added
    return [];
  }

  async getNews(filters?: any) {
    // Placeholder - implement when News model is added
    return [];
  }

  async getGallery(filters?: any) {
    // Placeholder - implement when Gallery model is added
    return [];
  }

  async getFaqs() {
    // Placeholder - implement when FAQ model is added
    return [];
  }

  async getCurrentAffairs(filters?: any, userId?: string) {
    const where: any = { 
      postType: 'CURRENT_AFFAIRS',
      isActive: true,
    };
    
    // Filter last 24 hours if requested
    if (filters?.filterLast24Hours === 'true' || filters?.filterLast24Hours === true) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      where.createdAt = { gte: yesterday };
    }
    
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { user: true, category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Get read status for user if provided
    let readStatusMap: Record<string, { isRead: boolean; readAt: Date | null }> = {};
    if (userId) {
      const readRecords = await this.prisma.postRead.findMany({
        where: {
          userId,
          postId: { in: posts.map(p => p.id) },
        },
      });
      readStatusMap = readRecords.reduce((acc, record) => {
        acc[record.postId] = { isRead: true, readAt: record.readAt };
        return acc;
      }, {} as Record<string, { isRead: boolean; readAt: Date | null }>);
    }

    // Add searchText and read status to each post
    const postsWithMetadata = posts.map(post => {
      const metadata = (post.metadata as any) || {};
      const searchText = [
        post.title,
        post.description,
        metadata.fullArticle || metadata.content || '',
        metadata.headline || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ')
        .trim();

      const readStatus = readStatusMap[post.id] || { isRead: false, readAt: null };

      return {
        ...post,
        searchText,
        isRead: readStatus.isRead,
        readAt: readStatus.readAt,
      };
    });

    return {
      data: postsWithMetadata,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCurrentAffairById(id: string, userId?: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'CURRENT_AFFAIRS',
        isActive: true 
      },
      include: { user: true, category: true },
    });

    if (!post) {
      throw new NotFoundException('Current affair not found');
    }

    // Get read status for user if provided
    let isRead = false;
    let readAt: Date | null = null;
    if (userId) {
      const readRecord = await this.prisma.postRead.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: id,
          },
        },
      });
      if (readRecord) {
        isRead = true;
        readAt = readRecord.readAt;
      }
    }

    // Return post with metadata fields extracted
    const metadata = post.metadata as any || {};
    
    // Create searchText field
    const searchText = [
      post.title,
      post.description,
      metadata.fullArticle || metadata.content || '',
      metadata.headline || '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      ...post,
      // Extract full content from metadata - this is the full article text with HTML formatting
      content: metadata.fullArticle || metadata.content || post.description, // Use fullArticle (with HTML) if available, fallback to content, then description
      fullArticle: metadata.fullArticle || null, // Also return as fullArticle for clarity (preserves HTML formatting)
      quickViewContent: metadata.quickViewContent || null,
      isPublished: metadata.isPublished !== undefined ? metadata.isPublished : post.isActive,
      // Include other metadata fields that might be useful
      headline: metadata.headline || null,
      articleDate: metadata.articleDate || null,
      // Add searchText for enhanced search
      searchText,
      // Add read status
      isRead,
      readAt,
    };
  }

  async getGeneralKnowledge(filters?: any) {
    const where: any = { 
      postType: 'COLLEGE_FEED',
      isActive: true,
      // Note: articleType filtering removed - all COLLEGE_FEED posts are returned
    };
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { user: true, category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Add searchText to each post for enhanced search
    const postsWithSearchText = posts.map(post => {
      const metadata = (post.metadata as any) || {};
      const searchText = [
        post.title,
        post.description,
        metadata.fullArticle || metadata.content || '',
        metadata.headline || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ')
        .trim();

      return {
        ...post,
        searchText,
      };
    });

    return {
      data: postsWithSearchText,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGeneralKnowledgeById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'COLLEGE_FEED',
        isActive: true,
        // Note: articleType filtering removed
      },
      include: { user: true, category: true },
    });

    if (!post) {
      throw new NotFoundException('General knowledge article not found');
    }

    // Return post with metadata fields extracted
    const metadata = post.metadata as any || {};
    
    // Create searchText field by combining title, description, and metadata content
    const searchText = [
      post.title,
      post.description,
      metadata.fullArticle || metadata.content || '',
      metadata.headline || '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      ...post,
      // Extract full content from metadata - this is the full article text with HTML formatting
      content: metadata.fullArticle || metadata.content || post.description, // Use fullArticle (with HTML) if available, fallback to content, then description
      fullArticle: metadata.fullArticle || null, // Also return as fullArticle for clarity (preserves HTML formatting)
      quickViewContent: metadata.quickViewContent || null,
      isPublished: metadata.isPublished !== undefined ? metadata.isPublished : post.isActive,
      // Include other metadata fields that might be useful
      headline: metadata.headline || null,
      articleDate: metadata.articleDate || null,
      // Add searchText for enhanced search
      searchText,
    };
  }

  async getCurrentAffairsDailyDigest() {
    // Get last 24 hours current affairs
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const posts = await this.prisma.post.findMany({
      where: {
        postType: 'CURRENT_AFFAIRS',
        isActive: true,
        createdAt: {
          gte: yesterday,
        },
      },
      include: { user: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 50, // Get more to allow filtering
    });

    // Filter by metadata.isPublished if available
    const publishedPosts = posts.filter(post => {
      const metadata = post.metadata as any || {};
      return metadata.isPublished !== false; // Include if not explicitly false
    });

    return {
      data: publishedPosts.slice(0, 20), // Return top 20
      count: publishedPosts.length,
    };
  }

  async getGeneralKnowledgeDailyDigest(excludePublished: boolean = true) {
    try {
      // Get posts that haven't been shown in daily digest in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let excludedPostIds: string[] = [];
      if (excludePublished) {
        const shownPosts = await this.prisma.dailyDigestGkArticle.findMany({
          where: {
            shownAt: { gte: sevenDaysAgo },
          },
          select: { postId: true },
        });
        excludedPostIds = shownPosts.map(sp => sp.postId);
      }

      // Get 20 random general knowledge articles (excluding already shown ones)
      const posts = await this.prisma.post.findMany({
        where: {
          postType: 'COLLEGE_FEED',
          isActive: true,
          ...(excludedPostIds.length > 0 && {
            id: { notIn: excludedPostIds },
          }),
        },
        include: { user: true, category: true },
        take: excludedPostIds.length > 0 ? 100 : 20, // Get more for randomization if we have exclusions
      });

      // Shuffle and take 20 random
      const shuffled = posts.sort(() => 0.5 - Math.random());
      const randomPosts = shuffled.slice(0, 20);

      // Track the articles shown in daily digest
      if (randomPosts.length > 0) {
        try {
          await this.prisma.dailyDigestGkArticle.createMany({
            data: randomPosts.map(post => ({
              postId: post.id,
              shownAt: new Date(),
            })),
            skipDuplicates: true,
          });
        } catch (trackError: any) {
          // Log but don't fail if tracking fails
          this.logger.warn(`⚠️ Failed to track shown GK articles: ${trackError.message}`);
        }
      }

      this.logger.log(`✅ Returning ${randomPosts.length} GK articles for daily digest`);
      return {
        data: randomPosts,
        count: randomPosts.length,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting general knowledge daily digest: ${error.message}`, error.stack);
      // Return empty array on error
      return {
        data: [],
        count: 0,
      };
    }
  }

  async getSubcategories(categoryId: string) {
    try {
      // Verify category exists
      const category = await this.prisma.wallCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      // Get subcategories (categories where parentCategoryId = categoryId)
      const subcategories = await this.prisma.wallCategory.findMany({
        where: {
          parentCategoryId: categoryId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      return {
        data: subcategories,
        count: subcategories.length,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting subcategories for category ${categoryId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to get subcategories: ${error.message}`);
    }
  }

  async getSections(subCategoryId: string) {
    try {
      // Verify subcategory exists
      const subCategory = await this.prisma.wallCategory.findUnique({
        where: { id: subCategoryId },
      });

      if (!subCategory) {
        throw new NotFoundException(`Subcategory with ID ${subCategoryId} not found`);
      }

      // Get sections (categories where parentCategoryId = subCategoryId)
      const sections = await this.prisma.wallCategory.findMany({
        where: {
          parentCategoryId: subCategoryId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      return {
        data: sections,
        count: sections.length,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting sections for subcategory ${subCategoryId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to get sections: ${error.message}`);
    }
  }

  async bookmarkArticle(userId: string, articleId: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'COLLEGE_FEED',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('General knowledge article not found');
      }

      // Check if bookmark already exists
      const existingBookmark = await this.prisma.postBookmark.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingBookmark) {
        // Remove bookmark
        await this.prisma.postBookmark.delete({
          where: { id: existingBookmark.id },
        });
        this.logger.log(`Bookmark removed for article ${articleId} by user ${userId}`);
        return { bookmarked: false, message: 'Article unbookmarked successfully' };
      }

      // Create bookmark
      await this.prisma.postBookmark.create({
        data: {
          userId,
          postId: articleId,
        },
      });

      this.logger.log(`Article ${articleId} bookmarked by user ${userId}`);
      return { bookmarked: true, message: 'Article bookmarked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error bookmarking article ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to bookmark article: ${error.message}`);
    }
  }

  async reportArticle(userId: string, articleId: string, reason?: string, description?: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'COLLEGE_FEED',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('General knowledge article not found');
      }

      // Check if user has already reported this article
      const existingReport = await this.prisma.postReport.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingReport) {
        // Update existing report
        await this.prisma.postReport.update({
          where: { id: existingReport.id },
          data: {
            reason: reason || existingReport.reason,
            description: description || existingReport.description,
            status: 'pending', // Reset to pending if updating
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Report updated for article ${articleId} by user ${userId}`);
        return { success: true, message: 'Report updated successfully' };
      }

      // Create new report
      await this.prisma.postReport.create({
        data: {
          userId,
          postId: articleId,
          reason: reason || null,
          description: description || null,
          status: 'pending',
        },
      });

      this.logger.log(`Article ${articleId} reported by user ${userId}`);
      return { success: true, message: 'Article reported successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error reporting article ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to report article: ${error.message}`);
    }
  }

  async bookmarkCurrentAffair(userId: string, articleId: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'CURRENT_AFFAIRS',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('Current affair article not found');
      }

      // Check if bookmark already exists
      const existingBookmark = await this.prisma.postBookmark.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingBookmark) {
        // Remove bookmark
        await this.prisma.postBookmark.delete({
          where: { id: existingBookmark.id },
        });
        this.logger.log(`Bookmark removed for current affair ${articleId} by user ${userId}`);
        return { bookmarked: false, message: 'Article unbookmarked successfully' };
      }

      // Create bookmark
      await this.prisma.postBookmark.create({
        data: {
          userId,
          postId: articleId,
        },
      });

      this.logger.log(`Current affair ${articleId} bookmarked by user ${userId}`);
      return { bookmarked: true, message: 'Article bookmarked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error bookmarking current affair ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to bookmark article: ${error.message}`);
    }
  }

  async reportCurrentAffair(userId: string, articleId: string, reason?: string, description?: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'CURRENT_AFFAIRS',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('Current affair article not found');
      }

      // Check if user has already reported this article
      const existingReport = await this.prisma.postReport.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingReport) {
        // Update existing report
        await this.prisma.postReport.update({
          where: { id: existingReport.id },
          data: {
            reason: reason || existingReport.reason,
            description: description || existingReport.description,
            status: 'pending', // Reset to pending if updating
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Report updated for current affair ${articleId} by user ${userId}`);
        return { success: true, message: 'Report updated successfully' };
      }

      // Create new report
      await this.prisma.postReport.create({
        data: {
          userId,
          postId: articleId,
          reason: reason || null,
          description: description || null,
          status: 'pending',
        },
      });

      this.logger.log(`Current affair ${articleId} reported by user ${userId}`);
      return { success: true, message: 'Article reported successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error reporting current affair ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to report article: ${error.message}`);
    }
  }

  async trackView(articleId: string, userId?: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'CURRENT_AFFAIRS',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('Current affair article not found');
      }

      // Create view record
      await this.prisma.postView.create({
        data: {
          postId: articleId,
          userId: userId || null,
        },
      });

      this.logger.log(`View tracked for current affair ${articleId} by user ${userId || 'anonymous'}`);
      return { success: true, message: 'View tracked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error tracking view for current affair ${articleId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track view: ${error.message}`);
    }
  }

  async trackViewDuration(articleId: string, duration: number, userId?: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'CURRENT_AFFAIRS',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('Current affair article not found');
      }

      // Validate duration (should be positive)
      if (duration < 0) {
        throw new BadRequestException('Duration must be a positive number');
      }

      // Create view duration record
      await this.prisma.postViewDuration.create({
        data: {
          postId: articleId,
          userId: userId || null,
          duration,
        },
      });

      // If user is authenticated and duration >= 20 seconds, mark as read
      if (userId && duration >= 20) {
        // Check if already read
        const existingRead = await this.prisma.postRead.findUnique({
          where: {
            userId_postId: {
              userId,
              postId: articleId,
            },
          },
        });

        if (!existingRead) {
          await this.prisma.postRead.create({
            data: {
              userId,
              postId: articleId,
            },
          });
          this.logger.log(`Article ${articleId} marked as read by user ${userId} (duration: ${duration}s)`);
        }
      }

      this.logger.log(`View duration tracked for current affair ${articleId}: ${duration}s by user ${userId || 'anonymous'}`);
      return { success: true, message: 'View duration tracked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error tracking view duration for current affair ${articleId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track view duration: ${error.message}`);
    }
  }
}

