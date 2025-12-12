import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class McqService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.mcqCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getQuestions(filters: {
    categoryId?: string;
    difficulty?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
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

    const [questions, total] = await Promise.all([
      this.prisma.mcqQuestion.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
        },
      }),
      this.prisma.mcqQuestion.count({ where }),
    ]);

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
}

