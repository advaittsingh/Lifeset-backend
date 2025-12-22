import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class McqService {
  private readonly logger = new Logger(McqService.name);

  constructor(private prisma: PrismaService) {}

  async getCategories() {
    try {
      // MCQ questions now use WallCategory (shared with General Knowledge)
      // Get all parent categories (where parentCategoryId is null) that can be used for MCQs
      const categories = await this.prisma.wallCategory.findMany({
        where: { 
          parentCategoryId: null,
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
    randomUnanswered?: boolean | string;
    page?: number;
    limit?: number;
  }, userId?: string) {
    try {
      // Log incoming filters for debugging
      this.logger.log(`📝 MCQ getQuestions called with filters: ${JSON.stringify(filters)}, userId: ${userId || 'none'}`);

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

      // Filter unanswered questions if requested and userId provided
      const randomUnanswered = filters.randomUnanswered === true || filters.randomUnanswered === 'true';
      if (randomUnanswered && userId) {
        // Get answered question IDs for this user
        const answeredRecords = await this.prisma.mcqAnswered.findMany({
          where: { userId },
          select: { questionId: true },
        });
        const answeredQuestionIds = answeredRecords.map(r => r.questionId);
        
        if (answeredQuestionIds.length > 0) {
          where.id = { notIn: answeredQuestionIds };
        }
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
          orderBy: randomUnanswered ? undefined : { createdAt: 'desc' },
        });
      } catch (includeError: any) {
        this.logger.warn(`⚠️ Error including category, trying without include: ${includeError.message}`);
        // Try without category include if it fails (might be due to invalid categoryId)
        questions = await this.prisma.mcqQuestion.findMany({
          where,
          skip,
          take: limit,
          orderBy: randomUnanswered ? undefined : { createdAt: 'desc' },
        });
      }

      // Shuffle if randomUnanswered
      if (randomUnanswered && questions.length > 0) {
        questions = questions.sort(() => 0.5 - Math.random());
      }

      const total = await this.prisma.mcqQuestion.count({ where });

      this.logger.log(`✅ MCQ found ${questions.length} questions (total: ${total})`);

      // Get answered status for user if provided
      let answeredStatusMap: Record<string, { isAnswered: boolean; answeredAt: Date | null }> = {};
      if (userId) {
        const answeredRecords = await this.prisma.mcqAnswered.findMany({
          where: {
            userId,
            questionId: { in: questions.map(q => q.id) },
          },
        });
        answeredStatusMap = answeredRecords.reduce((acc, record) => {
          acc[record.questionId] = { isAnswered: true, answeredAt: record.answeredAt };
          return acc;
        }, {} as Record<string, { isAnswered: boolean; answeredAt: Date | null }>);
      }

      // Add answered status, solution, and articleId to each question
      const questionsWithMetadata = questions.map(question => {
        const answeredStatus = answeredStatusMap[question.id] || { isAnswered: false, answeredAt: null };
        return {
          ...question,
          isAnswered: answeredStatus.isAnswered,
          answeredAt: answeredStatus.answeredAt,
          solution: question.solution || null,
          articleId: question.articleId || null,
        };
      });

      // Always return consistent format for mobile app
      // Mobile app expects: { success: true, data: [...questions] } or { success: true, data: { data: [...], pagination: {...} } }
      if (!hasExplicitPagination) {
        // Return as array for direct consumption
        return questionsWithMetadata;
      }

      // Return paginated structure
      return {
        data: questionsWithMetadata,
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

  async getQuestionById(id: string, userId?: string) {
    const question = await this.prisma.mcqQuestion.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Get answered status for user if provided
    let isAnswered = false;
    let answeredAt: Date | null = null;
    if (userId) {
      const answeredRecord = await this.prisma.mcqAnswered.findUnique({
        where: {
          userId_questionId: {
            userId,
            questionId: id,
          },
        },
      });
      if (answeredRecord) {
        isAnswered = true;
        answeredAt = answeredRecord.answeredAt;
      }
    }

    return {
      ...question,
      isAnswered,
      answeredAt,
      solution: question.solution || null,
      articleId: question.articleId || null,
    };
  }

  async submitAnswer(userId: string, questionId: string, selectedAnswer: number, timeSpent?: number) {
    const question = await this.prisma.mcqQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const isCorrect = selectedAnswer === question.correctAnswer;

    // Create attempt record
    const attempt = await this.prisma.mcqAttempt.create({
      data: {
        userId,
        questionId,
        selectedAnswer,
        isCorrect,
        timeSpent,
      },
    });

    // Mark question as answered
    const existingAnswered = await this.prisma.mcqAnswered.findUnique({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
    });

    if (!existingAnswered) {
      await this.prisma.mcqAnswered.create({
        data: {
          userId,
          questionId,
        },
      });
      this.logger.log(`Question ${questionId} marked as answered by user ${userId}`);
    }

    return {
      attempt,
      isCorrect,
      correctAnswer: question.correctAnswer,
      correctAnswerIndex: question.correctAnswer, // Same as correctAnswer for consistency
      explanation: question.explanation || null,
      solution: question.solution || null,
      // Flag to prevent auto-advance - user must click next button
      shouldAutoAdvance: false,
      waitForUserAction: true,
    };
  }

  async bookmarkQuestion(userId: string, questionId: string) {
    try {
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
        return { bookmarked: false, message: 'Bookmark removed successfully' };
      }

      try {
        await this.prisma.mcqBookmark.create({
          data: {
            userId,
            questionId,
          },
        });

        return { bookmarked: true, message: 'Bookmarked successfully' };
      } catch (createError: any) {
        // Handle unique constraint error (P2002) - item already bookmarked
        if (createError.code === 'P2002') {
          // Item is already bookmarked, return success response
          return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
        }
        throw createError;
      }
    } catch (error: any) {
      // If it's a unique constraint error, treat as already bookmarked
      if (error.code === 'P2002') {
        return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
      }
      throw error;
    }
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

  async reportQuestion(userId: string, questionId: string, reason?: string, description?: string) {
    try {
      // Verify question exists
      const question = await this.prisma.mcqQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new NotFoundException('MCQ question not found');
      }

      // Check if user has already reported this question
      const existingReport = await this.prisma.mcqReport.findUnique({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
      });

      if (existingReport) {
        // Update existing report
        await this.prisma.mcqReport.update({
          where: { id: existingReport.id },
          data: {
            reason: reason || existingReport.reason,
            description: description || existingReport.description,
            status: 'pending', // Reset to pending if updating
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Report updated for MCQ question ${questionId} by user ${userId}`);
        return { success: true, message: 'Report updated successfully' };
      }

      // Create new report
      await this.prisma.mcqReport.create({
        data: {
          userId,
          questionId,
          reason: reason || null,
          description: description || null,
          status: 'pending',
        },
      });

      this.logger.log(`MCQ question ${questionId} reported by user ${userId}`);
      return { success: true, message: 'Question reported successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error reporting MCQ question ${questionId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to report question: ${error.message}`);
    }
  }

  async trackView(questionId: string, userId?: string) {
    try {
      // Verify question exists
      const question = await this.prisma.mcqQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new NotFoundException('MCQ question not found');
      }

      // Create view record
      await this.prisma.mcqView.create({
        data: {
          questionId,
          userId: userId || null,
        },
      });

      this.logger.log(`View tracked for MCQ question ${questionId} by user ${userId || 'anonymous'}`);
      return { success: true, message: 'View tracked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error tracking view for MCQ question ${questionId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track view: ${error.message}`);
    }
  }

  async trackViewDuration(questionId: string, duration: number, userId?: string) {
    try {
      // Verify question exists
      const question = await this.prisma.mcqQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new NotFoundException('MCQ question not found');
      }

      // Validate duration (should be positive)
      if (duration < 0) {
        throw new BadRequestException('Duration must be a positive number');
      }

      // Create view duration record
      await this.prisma.mcqViewDuration.create({
        data: {
          questionId,
          userId: userId || null,
          duration,
        },
      });

      // If user is authenticated and duration >= 20 seconds, mark as read
      if (userId && duration >= 20) {
        // Check if already read
        const existingRead = await this.prisma.mcqRead.findUnique({
          where: {
            userId_questionId: {
              userId,
              questionId,
            },
          },
        });

        if (!existingRead) {
          await this.prisma.mcqRead.create({
            data: {
              userId,
              questionId,
            },
          });
          this.logger.log(`MCQ question ${questionId} marked as read by user ${userId} (duration: ${duration}s)`);
        }
      }

      this.logger.log(`View duration tracked for MCQ question ${questionId}: ${duration}s by user ${userId || 'anonymous'}`);
      return { success: true, message: 'View duration tracked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error tracking view duration for MCQ question ${questionId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track view duration: ${error.message}`);
    }
  }
}

