import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class McqService {
  private readonly logger = new Logger(McqService.name);

  constructor(private prisma: PrismaService) {}

  async getCategories() {
    try {
      // MCQ questions use McqCategory model (not WallCategory)
      const categories = await this.prisma.mcqCategory.findMany({
        where: { 
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      
      this.logger.log(`📚 MCQ found ${categories.length} categories`);
      
      // Return as array for direct consumption
      // After TransformInterceptor: { success: true, data: [...categories], timestamp: "..." }
      return categories;
    } catch (error: any) {
      this.logger.error(`❌ Error fetching MCQ categories: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch MCQ categories: ${error.message}`);
    }
  }

  async getQuestions(filters: {
    categoryId?: string;
    difficulty?: string;
    tags?: string[];
    articleId?: string; // Support filtering by articleId
    page?: number;
    limit?: number;
  }) {
    try {
      // Log incoming filters for debugging
      this.logger.log(`📝 MCQ getQuestions called with filters: ${JSON.stringify(filters)}`);

      // Check if pagination was explicitly requested
      const hasExplicitPagination = filters.page !== undefined || filters.limit !== undefined;
      
      const page = parseInt(String(filters.page || 1), 10);
      // If no categoryId is provided and no limit specified, allow fetching more questions (for "get all" scenario)
      // Otherwise use default limit of 20
      const limit = parseInt(String(filters.limit || (filters.categoryId ? 20 : 1000)), 10);
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters.difficulty) {
        where.difficulty = filters.difficulty;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.articleId) {
        where.articleId = filters.articleId;
      }

      this.logger.log(`🔍 MCQ query where clause: ${JSON.stringify(where)}`);

      let questions;
      try {
        questions = await this.prisma.mcqQuestion.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (includeError: any) {
        this.logger.warn(`⚠️ Error including category, trying without include: ${includeError.message}`);
        // Try without category include if it fails (might be due to invalid categoryId)
        questions = await this.prisma.mcqQuestion.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
      }

      const total = await this.prisma.mcqQuestion.count({ where });

      this.logger.log(`✅ MCQ found ${questions.length} questions (total: ${total})`);

      // Always return consistent format for mobile app
      // Mobile app expects: { success: true, data: [...questions] } or { success: true, data: { data: [...], pagination: {...} } }
      if (!hasExplicitPagination) {
        // Return as array for direct consumption
        return questions;
      }

      // Return paginated structure
      return {
        data: questions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Error fetching MCQ questions: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch MCQ questions: ${error.message}`);
    }
  }

  async getQuestionById(id: string) {
    const question = await this.prisma.mcqQuestion.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async submitAnswer(userId: string, questionId: string, selectedAnswer: number, timeSpent?: number) {
    const question = await this.prisma.mcqQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const isCorrect = selectedAnswer === question.correctAnswer;

    const attempt = await this.prisma.mcqAttempt.create({
      data: {
        userId,
        questionId,
        selectedAnswer,
        isCorrect,
        timeSpent,
      },
    });

    return {
      attempt,
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  }

  async bookmarkQuestion(userId: string, questionId: string) {
    const existing = await this.prisma.mcqBookmark.findUnique({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
    });

    if (existing) {
      await this.prisma.mcqBookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false };
    }

    await this.prisma.mcqBookmark.create({
      data: {
        userId,
        questionId,
      },
    });

    return { bookmarked: true };
  }

  async getBookmarkedQuestions(userId: string) {
    return this.prisma.mcqBookmark.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserAttempts(userId: string, questionId?: string) {
    const where: any = { userId };
    if (questionId) {
      where.questionId = questionId;
    }

    return this.prisma.mcqAttempt.findMany({
      where,
      include: {
        question: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDailyDigestLinkedMcqs(articleId?: string, categoryId?: string) {
    // Get MCQs linked to a specific article or category for daily digest
    const where: any = {};
    
    if (articleId) {
      where.articleId = articleId;
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // If no filters, return random MCQs
    const questions = await this.prisma.mcqQuestion.findMany({
      where,
      include: {
        category: true,
      },
      take: 10, // Get more for randomization
    });

    // Shuffle and return 5 random questions
    const shuffled = questions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
  }
}

