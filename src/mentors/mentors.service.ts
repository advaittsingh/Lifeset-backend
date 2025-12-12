import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MentorsService {
  constructor(private prisma: PrismaService) {}

  async getMentors(filters?: any) {
    // Placeholder - implement when Mentor model is added
    return [];
  }

  async getMentorById(id: string) {
    // Placeholder
    return null;
  }
}

