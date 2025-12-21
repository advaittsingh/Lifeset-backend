import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CmsService {
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

  async getCurrentAffairs(filters?: any) {
    const where: any = { 
      postType: 'CURRENT_AFFAIRS',
      isActive: true,
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

  async getCurrentAffairById(id: string) {
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

    // Return post with metadata fields extracted
    const metadata = post.metadata as any || {};
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

  async getGeneralKnowledgeDailyDigest() {
    // Get 20 random general knowledge articles
    const posts = await this.prisma.post.findMany({
      where: {
        postType: 'COLLEGE_FEED',
        isActive: true,
      },
      include: { user: true, category: true },
      take: 100, // Get more for randomization
    });

    // Shuffle and take 20 random
    const shuffled = posts.sort(() => 0.5 - Math.random());
    const randomPosts = shuffled.slice(0, 20);

    return {
      data: randomPosts,
      count: randomPosts.length,
    };
  }
}

