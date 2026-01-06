import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PersonalityService {
  private readonly logger = new Logger(PersonalityService.name);
  private openaiApiKey: string;
  private openaiBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.openaiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
  }

  async getQuizQuestions(userId?: string) {
    try {
      this.logger.log('📝 Getting personality quiz questions');
      
      // If userId provided, get only unanswered questions (up to 70)
      let questions;
      if (userId) {
        // Get answered question IDs for this user
        const answeredRecords = await this.prisma.personalityAnswered.findMany({
          where: { userId },
          select: { questionId: true },
        });
        const answeredQuestionIds = answeredRecords.map(r => r.questionId);
        
        questions = await this.prisma.personalityQuiz.findMany({
          where: {
            isActive: true,
            ...(answeredQuestionIds.length > 0 && {
              id: { notIn: answeredQuestionIds },
            }),
          },
          orderBy: { order: 'asc' },
          take: 70, // Return up to 70 unanswered questions
          select: {
            id: true,
            question: true,
            options: true,
            imageUrl: true,
            order: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      } else {
        // No userId - return all active questions (up to 70)
        questions = await this.prisma.personalityQuiz.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          take: 70,
          select: {
            id: true,
            question: true,
            options: true,
            imageUrl: true,
            order: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      this.logger.log(`✅ Found ${questions.length} personality quiz questions`);

      if (questions.length === 0) {
        this.logger.warn('⚠️ No questions in database, returning default questions');
        // Return default questions if none in database
        return this.getDefaultQuestions();
      }

      // Ensure imageUrl is included in response (even if null)
      const questionsWithImages = questions.map(q => ({
        ...q,
        imageUrl: q.imageUrl || null, // Explicitly include imageUrl
        hideTag: true, // Hide the PERSONALITY tag on the card
      }));

      return { questions: questionsWithImages };
    } catch (error: any) {
      this.logger.error(`❌ Error fetching personality quiz questions: ${error.message}`, error.stack);
      // Return default questions as fallback instead of throwing error
      this.logger.warn('⚠️ Returning default questions as fallback');
      return this.getDefaultQuestions();
    }
  }

  async evaluateAnswers(userId: string, answers: Record<string, number>) {
    try {
      // Get question details
      const questionIds = Object.keys(answers);
      const questions = await this.prisma.personalityQuiz.findMany({
        where: { id: { in: questionIds } },
      });

      // Prepare data for AI analysis
      const answerData = questions.map((q) => ({
        question: q.question,
        answer: (q.options as string[])[answers[q.id]],
      }));

      // Call AI service for personality analysis
      const personalityResult = await this.analyzePersonalityWithAI(answerData);

      // Save result to database
      const result = await this.prisma.personalityResult.create({
        data: {
          userId,
          personalityType: personalityResult.type,
          traits: personalityResult.traits,
          description: personalityResult.description,
          recommendations: personalityResult.recommendations,
          rawData: personalityResult,
        },
      });

      return result;
    } catch (error) {
      console.error('Error evaluating personality quiz:', error);
      // Fallback to rule-based analysis if AI fails
      return this.evaluateAnswersFallback(userId, answers);
    }
  }

  private async analyzePersonalityWithAI(answerData: any[]) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Analyze the following personality quiz answers and provide:
1. Personality type (e.g., Analyst, Diplomat, Sentinel, Explorer)
2. Key traits with scores (0-100)
3. A brief description
4. Career recommendations

Answers:
${answerData.map((a, i) => `${i + 1}. ${a.question}\n   Answer: ${a.answer}`).join('\n\n')}

Respond in JSON format:
{
  "type": "personality type name",
  "description": "brief description",
  "traits": [
    {"name": "trait name", "score": 85},
    {"name": "trait name", "score": 72}
  ],
  "recommendations": ["career 1", "career 2", "career 3"]
}`;

    try {
      const response = await axios.post(
        `${this.openaiBaseUrl}/chat/completions`,
        {
          model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a personality analysis expert. Analyze quiz answers and provide structured JSON responses.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  private async evaluateAnswersFallback(userId: string, answers: Record<string, number>) {
    // Simple rule-based fallback analysis
    const answerValues = Object.values(answers);
    const avgAnswer = answerValues.reduce((a, b) => a + b, 0) / answerValues.length;

    let personalityType = 'Analyst';
    if (avgAnswer < 2) personalityType = 'Explorer';
    else if (avgAnswer < 3) personalityType = 'Diplomat';
    else if (avgAnswer < 4) personalityType = 'Sentinel';

    const result = await this.prisma.personalityResult.create({
      data: {
        userId,
        personalityType,
        traits: [
          { name: 'Openness', score: Math.round(avgAnswer * 20) },
          { name: 'Conscientiousness', score: Math.round(avgAnswer * 18) },
          { name: 'Extraversion', score: Math.round(avgAnswer * 22) },
        ],
        description: `You are a ${personalityType} with balanced traits.`,
        recommendations: ['Software Engineer', 'Data Analyst', 'Product Manager'],
        rawData: { fallback: true },
      },
    });

    return result;
  }

  private getDefaultQuestions() {
    return {
      questions: [
        {
          id: '1',
          question: 'I prefer working in a team rather than alone',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 1,
          hideTag: true, // Hide the PERSONALITY tag on the card
        },
        {
          id: '2',
          question: 'I enjoy solving complex problems',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 2,
          hideTag: true, // Hide the PERSONALITY tag on the card
        },
        {
          id: '3',
          question: 'I am comfortable taking risks',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 3,
          hideTag: true, // Hide the PERSONALITY tag on the card
        },
        {
          id: '4',
          question: 'I prefer structured and organized environments',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 4,
          hideTag: true, // Hide the PERSONALITY tag on the card
        },
        {
          id: '5',
          question: 'I enjoy creative and innovative tasks',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 5,
          hideTag: true, // Hide the PERSONALITY tag on the card
        },
      ],
    };
  }

  async getPersonalityResult(userId: string) {
    return this.prisma.personalityResult.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async trackView(userId: string | undefined, questionId: string) {
    try {
      await this.prisma.personalityView.create({
        data: {
          userId: userId || null,
          questionId,
        },
      });
      this.logger.log(`✅ Tracked view for personality question ${questionId} by user ${userId || 'anonymous'}`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error tracking view: ${error.message}`);
      // Don't throw - tracking is non-critical
      return { success: false, error: error.message };
    }
  }

  async trackDuration(userId: string | undefined, questionId: string, duration: number) {
    try {
      await this.prisma.personalityViewDuration.create({
        data: {
          userId: userId || null,
          questionId,
          duration,
        },
      });
      this.logger.log(`✅ Tracked duration ${duration}s for personality question ${questionId} by user ${userId || 'anonymous'}`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error tracking duration: ${error.message}`);
      // Don't throw - tracking is non-critical
      return { success: false, error: error.message };
    }
  }

  async submitAnswer(userId: string, questionId: string, answerIndex: number) {
    try {
      // Check if question exists
      const question = await this.prisma.personalityQuiz.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new Error('Question not found');
      }

      // Validate answer index
      const options = question.options as string[];
      if (answerIndex < 0 || answerIndex >= options.length) {
        throw new Error('Invalid answer index');
      }

      // Upsert answer (update if exists, create if not)
      const answered = await this.prisma.personalityAnswered.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
        update: {
          answerIndex,
          answeredAt: new Date(),
        },
        create: {
          userId,
          questionId,
          answerIndex,
        },
      });

      this.logger.log(`✅ User ${userId} submitted answer ${answerIndex} for question ${questionId}`);
      return { success: true, data: answered };
    } catch (error: any) {
      this.logger.error(`❌ Error submitting answer: ${error.message}`);
      throw error;
    }
  }

  async reportQuestion(userId: string, questionId: string, feedback: string) {
    try {
      // Check if question exists
      const question = await this.prisma.personalityQuiz.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new Error('Question not found');
      }

      // Upsert report (update if exists, create if not)
      const report = await this.prisma.personalityReport.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
        update: {
          description: feedback,
          status: 'pending',
          updatedAt: new Date(),
        },
        create: {
          userId,
          questionId,
          description: feedback,
          status: 'pending',
        },
      });

      this.logger.log(`✅ User ${userId} reported question ${questionId}`);
      return { success: true, data: report };
    } catch (error: any) {
      this.logger.error(`❌ Error reporting question: ${error.message}`);
      throw error;
    }
  }

  async getDailyDigestQuestions(userId: string, excludeAnswered: boolean = true) {
    try {
      this.logger.log(`📝 Getting daily digest questions for user ${userId}, excludeAnswered: ${excludeAnswered}`);

      // Get questions user has already answered (from PersonalityResult)
      const answeredQuestionIds = new Set<string>();
      if (excludeAnswered) {
        const answeredResults = await this.prisma.personalityResult.findMany({
          where: { userId },
          select: { rawData: true },
        });

        answeredResults.forEach(result => {
          if (result.rawData && typeof result.rawData === 'object') {
            const rawData = result.rawData as any;
            if (rawData.answeredQuestions && Array.isArray(rawData.answeredQuestions)) {
              rawData.answeredQuestions.forEach((id: string) => answeredQuestionIds.add(id));
            }
          }
        });
      }

      // Get questions shown in daily digest in the last 7 days (to avoid repetition)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const shownQuestions = await this.prisma.dailyDigestPersonalityQuestion.findMany({
        where: {
          userId,
          shownAt: { gte: sevenDaysAgo },
        },
        select: { questionId: true },
      });

      const shownQuestionIds = new Set(shownQuestions.map(sq => sq.questionId));

      // Combine answered and shown question IDs
      const excludedQuestionIds = Array.from(new Set([...answeredQuestionIds, ...shownQuestionIds]));

      // Get 2 unanswered and unshown questions
      let questions = await this.prisma.personalityQuiz.findMany({
        where: {
          isActive: true,
          ...(excludedQuestionIds.length > 0 && {
            id: { notIn: excludedQuestionIds },
          }),
        },
        orderBy: { order: 'asc' },
        take: 2,
        select: {
          id: true,
          question: true,
          options: true,
          imageUrl: true,
          order: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // If we don't have enough questions, get any 2 active questions (excluding only answered ones)
      if (questions.length < 2 && excludeAnswered) {
        const allQuestions = await this.prisma.personalityQuiz.findMany({
          where: {
            isActive: true,
            ...(answeredQuestionIds.size > 0 && {
              id: { notIn: Array.from(answeredQuestionIds) },
            }),
          },
          orderBy: { order: 'asc' },
          take: 2,
          select: {
            id: true,
            question: true,
            options: true,
            imageUrl: true,
            order: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        questions = allQuestions;
      }

      // If still not enough, get any 2 active questions
      if (questions.length < 2) {
        const allQuestions = await this.prisma.personalityQuiz.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          take: 2,
          select: {
            id: true,
            question: true,
            options: true,
            imageUrl: true,
            order: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        questions = allQuestions;
      }

      // Track the questions shown to this user
      if (questions.length > 0) {
        try {
          await this.prisma.dailyDigestPersonalityQuestion.createMany({
            data: questions.map(q => ({
              userId,
              questionId: q.id,
              shownAt: new Date(),
            })),
            skipDuplicates: true,
          });
          this.logger.log(`✅ Tracked ${questions.length} personality questions shown to user ${userId}`);
        } catch (trackError: any) {
          // Log but don't fail if tracking fails
          this.logger.warn(`⚠️ Failed to track shown questions for user ${userId}: ${trackError.message}`);
        }
      }

      // Ensure imageUrl is included
      const questionsWithImages = questions.map(q => ({
        ...q,
        imageUrl: q.imageUrl || null,
        hideTag: true, // Hide the PERSONALITY tag on the card
      }));

      // Log image status for debugging
      const questionsWithImagesCount = questionsWithImages.filter(q => q.imageUrl).length;
      this.logger.log(`✅ Returning ${questionsWithImages.length} personality questions for user ${userId} (${questionsWithImagesCount} with images)`);
      
      // Log each question's image status for debugging
      questionsWithImages.forEach((q, index) => {
        this.logger.debug(`Question ${index + 1} (${q.id}): imageUrl = ${q.imageUrl ? 'present' : 'null'}`);
      });
      
      return { questions: questionsWithImages };
    } catch (error: any) {
      this.logger.error(`❌ Error getting daily digest questions for user ${userId}: ${error.message}`, error.stack);
      // Return empty array on error instead of throwing
      return { questions: [] };
    }
  }
}
