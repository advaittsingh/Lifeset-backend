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

    // All fields are now columns, return as-is
    return {
      ...post,
      isPublished: post.isPublished !== undefined ? post.isPublished : post.isActive,
    };
  }

  async getGeneralKnowledge(filters?: any) {
    const where: any = { 
      postType: 'COLLEGE_FEED',
      isActive: true,
      articleType: 'GENERAL_KNOWLEDGE', // Filter by articleType column
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

  async getGeneralKnowledgeById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'COLLEGE_FEED',
        isActive: true,
        articleType: 'GENERAL_KNOWLEDGE', // Filter by articleType column
      },
      include: { user: true, category: true },
    });

    if (!post) {
      throw new NotFoundException('General knowledge article not found');
    }

    // All fields are now columns, return as-is
    return {
      ...post,
      isPublished: post.isPublished !== undefined ? post.isPublished : post.isActive,
    };
  }
}

