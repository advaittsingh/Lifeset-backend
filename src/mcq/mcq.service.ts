import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class McqService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    // MCQ questions now use WallCategory instead of McqCategory
    // Filter by categoryFor: 'MCQ' to ensure we only get MCQ categories
    const categories = await this.prisma.wallCategory.findMany({
      where: { 
        isActive: true,
        // categoryFor removed from schema - using basic query
        // categoryFor: 'MCQ',
      },
      orderBy: { name: 'asc' },
    });
    
    // Return as array for direct consumption
    // After TransformInterceptor: { success: true, data: [...categories], timestamp: "..." }
    return categories;
  }

  async getQuestions(filters: {
    categoryId?: string;
    difficulty?: string;
    tags?: string[];
    articleId?: string; // Support filtering by articleId
    page?: number;
    limit?: number;
  }) {
    // Check if pagination was explicitly requested
    const hasExplicitPagination = filters.page !== undefined || filters.limit !== undefined;
    
    const page = filters.page || 1;
    // If no categoryId is provided and no limit specified, allow fetching more questions (for "get all" scenario)
    // Otherwise use default limit of 20
    const limit = filters.limit || (filters.categoryId ? 20 : 1000);
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

    const [questions, total] = await Promise.all([
      this.prisma.mcqQuestion.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mcqQuestion.count({ where }),
    ]);

    // If no explicit pagination parameters were provided, return questions directly as array
    // This matches the categories endpoint structure and is easier for mobile app to consume
    // After TransformInterceptor: { success: true, data: [...questions], timestamp: "..." }
    // Mobile app can access: response.data directly
    if (!hasExplicitPagination) {
      return questions;
    }

    // Otherwise return paginated structure
    // After TransformInterceptor: { success: true, data: { data: [...], pagination: {...} }, timestamp: "..." }
    // Mobile app should access: response.data.data for questions array
    return {
      data: questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

