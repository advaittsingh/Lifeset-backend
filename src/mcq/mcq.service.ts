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

  // Lightweight list endpoint for MCQ Questions (optimized for list views)
  async getQuestionsList(filters: {
    categoryId?: string;
    difficulty?: string;
    tags?: string[];
    articleId?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = parseInt(String(filters.page || 1), 10);
      const limit = parseInt(String(filters.limit || 20), 10);
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
          select: {
            id: true,
            question: true,
            options: true,
            difficulty: true,
            tags: true,
            questionImage: true,
            language: true,
            createdAt: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                attempts: true,
                bookmarks: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.mcqQuestion.count({ where }),
      ]);

      // Truncate question text to 150 chars for list view
      const enhancedQuestions = questions.map(q => ({
        ...q,
        question: q.question && q.question.length > 150 
          ? q.question.substring(0, 150) + '...' 
          : q.question,
      }));

      return {
        data: enhancedQuestions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching MCQ questions list: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch MCQ questions list: ${error.message}`);
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
          select: {
            id: true,
            question: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            solution: true,
            difficulty: true,
            tags: true,
            articleId: true,
            questionImage: true,
            explanationImage: true,
            language: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
              },
            },
          },
          skip,
          take: limit,
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

      // Get answered status and attempt information for user if provided
      let answeredStatusMap: Record<string, { isAnswered: boolean; answeredAt: Date | null; isCorrect: boolean | null; lastAttemptId: string | null }> = {};
      if (userId && questions.length > 0) {
        const questionIds = questions.map(q => q.id);
        
        // Fetch answered records and attempts in parallel
        const [answeredRecords, attempts] = await Promise.all([
          this.prisma.mcqAnswered.findMany({
            where: {
              userId,
              questionId: { in: questionIds },
            },
          }),
          this.prisma.mcqAttempt.findMany({
            where: {
              userId,
              questionId: { in: questionIds },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              questionId: true,
              isCorrect: true,
            },
          }),
        ]);

        // Group attempts by questionId to get the most recent one
        const attemptsByQuestion = new Map<string, { id: string; isCorrect: boolean }>();
        attempts.forEach(attempt => {
          if (!attemptsByQuestion.has(attempt.questionId)) {
            attemptsByQuestion.set(attempt.questionId, { id: attempt.id, isCorrect: attempt.isCorrect });
          }
        });

        // Build answered status map
        answeredRecords.forEach(record => {
          const lastAttempt = attemptsByQuestion.get(record.questionId);
          answeredStatusMap[record.questionId] = {
            isAnswered: true,
            answeredAt: record.answeredAt,
            isCorrect: lastAttempt ? lastAttempt.isCorrect : null,
            lastAttemptId: lastAttempt ? lastAttempt.id : null,
          };
        });
      }

      // Batch fetch subcategories and chapters to avoid N+1 queries
      const subCategoryIds = questions
        .map(q => (q.metadata as any)?.subCategoryId)
        .filter(Boolean);
      const chapterIds = questions
        .map(q => (q.metadata as any)?.chapterId)
        .filter(Boolean);

      const [subCategories, chapters] = await Promise.all([
        subCategoryIds.length > 0
          ? this.prisma.wallCategory.findMany({
              where: { id: { in: subCategoryIds } },
              select: { id: true, name: true },
            })
          : [],
        chapterIds.length > 0
          ? this.prisma.chapter.findMany({
              where: { id: { in: chapterIds } },
              select: { id: true, name: true },
            })
          : [],
      ]);

      // Create lookup maps for O(1) access
      const subCategoryMap = new Map<string, string>(subCategories.map(sc => [sc.id, sc.name] as [string, string]));
      const chapterMap = new Map<string, string>(chapters.map(ch => [ch.id, ch.name] as [string, string]));

      // Enhance questions using maps (O(1) lookup instead of N queries)
      const enhancedQuestions = questions.map(question => {
        const metadata = (question.metadata as any) || {};
        const subCategoryId = metadata.subCategoryId;
        const chapterId = metadata.chapterId;
        
        const subCategoryName = subCategoryMap.get(subCategoryId) || metadata.subCategory || metadata.subCategoryName || '';
        const sectionName = chapterMap.get(chapterId) || metadata.section || metadata.sectionName || '';
        
        // Update metadata with names
        const updatedMetadata = {
          ...metadata,
          ...(subCategoryName && { subCategory: subCategoryName, subCategoryName }),
          ...(sectionName && { section: sectionName, sectionName }),
        };
        
        return {
          ...question,
          metadata: updatedMetadata,
          subCategory: subCategoryName ? { name: subCategoryName } : null,
        };
      });

      // Add answered status, attempt info, solution, and articleId to each question
      const questionsWithMetadata = enhancedQuestions.map(question => {
        const answeredStatus = answeredStatusMap[question.id] || {
          isAnswered: false,
          answeredAt: null,
          isCorrect: null,
          lastAttemptId: null,
        };
        return {
          ...question,
          isAnswered: answeredStatus.isAnswered,
          answeredAt: answeredStatus.answeredAt,
          isCorrect: answeredStatus.isCorrect, // Include whether the last attempt was correct
          lastAttemptId: answeredStatus.lastAttemptId,
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

    // Get answered status and attempt information for user if provided
    let isAnswered = false;
    let answeredAt: Date | null = null;
    let isCorrect: boolean | null = null;
    let lastAttemptId: string | null = null;
    
    if (userId) {
      const [answeredRecord, lastAttempt] = await Promise.all([
        this.prisma.mcqAnswered.findUnique({
          where: {
            userId_questionId: {
              userId,
              questionId: id,
            },
          },
        }),
        this.prisma.mcqAttempt.findFirst({
          where: {
            userId,
            questionId: id,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            isCorrect: true,
          },
        }),
      ]);
      
      if (answeredRecord) {
        isAnswered = true;
        answeredAt = answeredRecord.answeredAt;
      }
      
      if (lastAttempt) {
        isCorrect = lastAttempt.isCorrect;
        lastAttemptId = lastAttempt.id;
      }
    }

    return {
      ...question,
      isAnswered,
      answeredAt,
      isCorrect,
      lastAttemptId,
      solution: question.solution || null,
      articleId: question.articleId || null,
    };
  }

  async submitAnswer(userId: string, questionId: string, selectedAnswer: number, timeSpent?: number) {
    const question = await this.prisma.mcqQuestion.findUnique({
      where: { id: questionId },
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

    // Mark question as answered (upsert to handle race conditions)
    await this.prisma.mcqAnswered.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
      create: {
        userId,
        questionId,
      },
      update: {
        answeredAt: new Date(), // Update timestamp if already exists
      },
    });

    this.logger.log(`Question ${questionId} answered by user ${userId} - ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    // Return complete response with updated question state
    return {
      attempt,
      isCorrect,
      correctAnswer: question.correctAnswer,
      correctAnswerIndex: question.correctAnswer, // Same as correctAnswer for consistency
      explanation: question.explanation || null,
      solution: question.solution || null,
      // Updated question state for frontend to use immediately
      question: {
        id: question.id,
        isAnswered: true,
        answeredAt: new Date(),
        isCorrect,
        lastAttemptId: attempt.id,
        solution: question.solution || null,
        articleId: question.articleId || null,
      },
      // Flag to prevent auto-advance - user must click next button
      shouldAutoAdvance: false,
      waitForUserAction: true,
    };
  }

  async bookmarkQuestion(userId: string, questionId: string) {
    try {
      // Verify question exists
      const question = await this.prisma.mcqQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new NotFoundException('MCQ question not found');
      }

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
      // Re-throw NotFoundException
      if (error instanceof NotFoundException) {
        throw error;
      }
      // If it's a unique constraint error, treat as already bookmarked
      if (error.code === 'P2002') {
        return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
      }
      throw error;
    }
  }

  async getBookmarkedQuestions(userId: string, limit: number = 1000) {
    const bookmarks = await this.prisma.mcqBookmark.findMany({
      where: { userId },
      include: {
        question: {
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
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (bookmarks.length === 0) {
      return {
        data: [],
        count: 0,
      };
    }

    const questionIds = bookmarks.map(b => b.question.id);

    // Get answered status and attempt information
    const [answeredRecords, attempts] = await Promise.all([
      this.prisma.mcqAnswered.findMany({
        where: {
          userId,
          questionId: { in: questionIds },
        },
      }),
      this.prisma.mcqAttempt.findMany({
        where: {
          userId,
          questionId: { in: questionIds },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          questionId: true,
          isCorrect: true,
        },
      }),
    ]);

    // Group attempts by questionId to get the most recent one
    const attemptsByQuestion = new Map<string, { id: string; isCorrect: boolean }>();
    attempts.forEach(attempt => {
      if (!attemptsByQuestion.has(attempt.questionId)) {
        attemptsByQuestion.set(attempt.questionId, { id: attempt.id, isCorrect: attempt.isCorrect });
      }
    });

    // Build answered status map
    const answeredStatusMap: Record<string, { isAnswered: boolean; answeredAt: Date | null; isCorrect: boolean | null; lastAttemptId: string | null }> = {};
    answeredRecords.forEach(record => {
      const lastAttempt = attemptsByQuestion.get(record.questionId);
      answeredStatusMap[record.questionId] = {
        isAnswered: true,
        answeredAt: record.answeredAt,
        isCorrect: lastAttempt ? lastAttempt.isCorrect : null,
        lastAttemptId: lastAttempt ? lastAttempt.id : null,
      };
    });

    // Add isBookmarked flag and answered status to all questions
    const questionsWithBookmarkFlag = bookmarks.map(bookmark => {
      const answeredStatus = answeredStatusMap[bookmark.question.id] || {
        isAnswered: false,
        answeredAt: null,
        isCorrect: null,
        lastAttemptId: null,
      };
      return {
        ...bookmark.question,
        isBookmarked: true,
        isAnswered: answeredStatus.isAnswered,
        answeredAt: answeredStatus.answeredAt,
        isCorrect: answeredStatus.isCorrect,
        lastAttemptId: answeredStatus.lastAttemptId,
        solution: bookmark.question.solution || null,
        articleId: bookmark.question.articleId || null,
      };
    });

    return {
      data: questionsWithBookmarkFlag,
      count: bookmarks.length,
    };
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

  async getDailyDigestLinkedMcqs(articleId?: string, categoryId?: string, userId?: string) {
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
    const selectedQuestions = shuffled.slice(0, 5);

    // Get answered status and attempt information for user if provided
    if (userId && selectedQuestions.length > 0) {
      const questionIds = selectedQuestions.map(q => q.id);
      
      // Fetch answered records and attempts in parallel
      const [answeredRecords, attempts] = await Promise.all([
        this.prisma.mcqAnswered.findMany({
          where: {
            userId,
            questionId: { in: questionIds },
          },
        }),
        this.prisma.mcqAttempt.findMany({
          where: {
            userId,
            questionId: { in: questionIds },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            questionId: true,
            isCorrect: true,
          },
        }),
      ]);

      // Group attempts by questionId to get the most recent one
      const attemptsByQuestion = new Map<string, { id: string; isCorrect: boolean }>();
      attempts.forEach(attempt => {
        if (!attemptsByQuestion.has(attempt.questionId)) {
          attemptsByQuestion.set(attempt.questionId, { id: attempt.id, isCorrect: attempt.isCorrect });
        }
      });

      // Build answered status map
      const answeredStatusMap: Record<string, { isAnswered: boolean; answeredAt: Date | null; isCorrect: boolean | null; lastAttemptId: string | null }> = {};
      answeredRecords.forEach(record => {
        const lastAttempt = attemptsByQuestion.get(record.questionId);
        answeredStatusMap[record.questionId] = {
          isAnswered: true,
          answeredAt: record.answeredAt,
          isCorrect: lastAttempt ? lastAttempt.isCorrect : null,
          lastAttemptId: lastAttempt ? lastAttempt.id : null,
        };
      });

      // Enhance questions with answered status and attempt info
      return selectedQuestions.map(question => {
        const answeredStatus = answeredStatusMap[question.id] || {
          isAnswered: false,
          answeredAt: null,
          isCorrect: null,
          lastAttemptId: null,
        };
        return {
          ...question,
          isAnswered: answeredStatus.isAnswered,
          answeredAt: answeredStatus.answeredAt,
          isCorrect: answeredStatus.isCorrect,
          lastAttemptId: answeredStatus.lastAttemptId,
          solution: question.solution || null,
          articleId: question.articleId || null,
        };
      });
    }

    // Return questions without answered status if no userId provided
    return selectedQuestions.map(question => ({
      ...question,
      isAnswered: false,
      answeredAt: null,
      isCorrect: null,
      lastAttemptId: null,
      solution: question.solution || null,
      articleId: question.articleId || null,
    }));
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

  async getReport(userId: string) {
    try {
      // Get all attempts for the user with question details
      const attempts = await this.prisma.mcqAttempt.findMany({
        where: { userId },
        include: {
          question: {
            select: {
              id: true,
              question: true,
              options: true,
              correctAnswer: true,
              difficulty: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate statistics
      const totalAttempts = attempts.length;
      const correctAnswers = attempts.filter((attempt) => attempt.isCorrect).length;
      const incorrectAnswers = totalAttempts - correctAnswers;
      const accuracy = totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0;

      // Get recent submissions (last 10 attempts)
      const recentSubmissions = attempts.slice(0, 10).map((attempt) => ({
        id: attempt.id,
        questionId: attempt.questionId,
        question: attempt.question.question,
        selectedAnswer: attempt.selectedAnswer,
        correctAnswer: attempt.question.correctAnswer,
        isCorrect: attempt.isCorrect,
        timeSpent: attempt.timeSpent || null,
        difficulty: attempt.question.difficulty,
        category: attempt.question.category,
        submittedAt: attempt.createdAt,
      }));

      return {
        totalAttempts,
        correctAnswers,
        incorrectAnswers,
        accuracy: Math.round(accuracy * 100) / 100, // Round to 2 decimal places
        recentSubmissions,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching MCQ report for user ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch MCQ report: ${error.message}`);
    }
  }
}

