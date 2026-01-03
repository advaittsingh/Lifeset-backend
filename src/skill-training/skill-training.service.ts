import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SkillTrainingService {
  constructor(private prisma: PrismaService) {}

  async getRecommendedCards(userId: string) {
    // Get 2 recommended skill training cards
    // Skill training cards are posts with postType that might be skill-related
    // For now, we'll return posts that could be skill training content
    // You may want to add a specific postType or category for skill training
    
    const cards = await this.prisma.post.findMany({
      where: {
        isActive: true,
        // Add specific filtering for skill training if you have a category or type
        // For now, returning any active posts as skill training cards
      },
      include: {
        user: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // Get more for randomization
    });

    // Shuffle and return 2 random cards
    const shuffled = cards.sort(() => 0.5 - Math.random());
    return {
      data: shuffled.slice(0, 2),
      count: 2,
    };
  }
}




