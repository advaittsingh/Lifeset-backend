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

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
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

    return post;
  }

  async getGeneralKnowledge(filters?: any) {
    const where: any = { 
      postType: 'COLLEGE_FEED',
      isActive: true,
    };
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const allPosts = await this.prisma.post.findMany({
      where,
      include: { user: true, category: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit * 2, // Get more to filter by metadata
    });

    // Filter by metadata type
    const filtered = allPosts.filter((post: any) => {
      const metadata = post.metadata as any;
      return metadata?.type === 'GENERAL_KNOWLEDGE';
    });

    const total = await this.prisma.post.count({
      where: {
        ...where,
        // Note: Can't filter by metadata in Prisma count, so this is approximate
      },
    });

    return {
      data: filtered.slice(0, limit),
      pagination: {
        page,
        limit,
        total: Math.min(total, filtered.length),
        totalPages: Math.ceil(Math.min(total, filtered.length) / limit),
      },
    };
  }

  async getGeneralKnowledgeById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'COLLEGE_FEED',
        isActive: true 
      },
      include: { user: true, category: true },
    });

    if (!post) {
      throw new NotFoundException('General knowledge article not found');
    }

    const metadata = post.metadata as any;
    if (metadata?.type !== 'GENERAL_KNOWLEDGE') {
      throw new NotFoundException('General knowledge article not found');
    }

    return post;
  }
}

