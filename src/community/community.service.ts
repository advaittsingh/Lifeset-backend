import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    // Placeholder - implement when CommunityCategory model is added
    return [];
  }

  async getPosts(categoryId?: string) {
    // Placeholder - implement community posts
    return [];
  }
}

