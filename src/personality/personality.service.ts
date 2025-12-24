import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from '../file/file.service';
import axios from 'axios';

@Injectable()
export class PersonalityService {
  private readonly logger = new Logger(PersonalityService.name);
  private openaiApiKey: string;
  private openaiBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private fileService: FileService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.openaiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
  }

  /**
   * Transform image URL to accessible URL
   * Handles S3 keys, relative paths, and full URLs
   */
  private async transformImageUrl(imageUrl: string | null | undefined): Promise<string | null> {
    if (!imageUrl || imageUrl.trim() === '') {
      return null;
    }

    const trimmedUrl = imageUrl.trim();

    // If it's already a full URL (http/https) or data URI, return as-is
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('data:')) {
      return trimmedUrl;
    }

    // If it looks like an S3 key (no protocol, might contain path separators)
    // Try to get a signed URL or construct public URL
    try {
      const bucket = this.configService.get<string>('S3_BUCKET_NAME');
      const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
      const cloudfrontUrl = this.configService.get<string>('CLOUDFRONT_URL');
      
      // If CloudFront URL is configured, use it (faster and cheaper than signed URLs)
      if (cloudfrontUrl) {
        // Remove trailing slash from CloudFront URL if present
        const baseUrl = cloudfrontUrl.endsWith('/') ? cloudfrontUrl.slice(0, -1) : cloudfrontUrl;
        // Remove leading slash from key if present
        const key = trimmedUrl.startsWith('/') ? trimmedUrl.slice(1) : trimmedUrl;
        return `${baseUrl}/${key}`;
      }
      
      // If AWS is configured, try to get signed URL
      if (bucket && this.configService.get('AWS_ACCESS_KEY_ID')) {
        try {
          const signedUrl = await this.fileService.getSignedUrl(trimmedUrl, 3600 * 24); // 24 hours
          return signedUrl;
        } catch (error) {
          this.logger.warn(`Failed to get signed URL for ${trimmedUrl}, trying public URL: ${error.message}`);
        }
      }

      // Fallback: construct public S3 URL
      if (bucket) {
        // Remove leading slash from key if present
        const key = trimmedUrl.startsWith('/') ? trimmedUrl.slice(1) : trimmedUrl;
        // Try different S3 URL formats
        const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
        return s3Url;
      }

      // If no bucket configured, return as-is (might be a relative path that frontend can handle)
      return trimmedUrl;
    } catch (error) {
      this.logger.warn(`Error transforming image URL ${trimmedUrl}: ${error.message}`);
      return trimmedUrl; // Return original URL as fallback
    }
  }

  async getQuizQuestions() {
    try {
      this.logger.log('📝 Getting personality quiz questions');
      
      // Get personality quiz questions from database or return default set
      const questions = await this.prisma.personalityQuiz.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        take: 20,
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

      this.logger.log(`✅ Found ${questions.length} personality quiz questions`);

      if (questions.length === 0) {
        this.logger.warn('⚠️ No questions in database, returning default questions');
        // Return default questions if none in database
        return this.getDefaultQuestions();
      }

      // Transform image URLs to accessible URLs
      const questionsWithImages = await Promise.all(
        questions.map(async (q) => ({
          ...q,
          imageUrl: await this.transformImageUrl(q.imageUrl),
        }))
      );

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
        },
        {
          id: '2',
          question: 'I enjoy solving complex problems',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 2,
        },
        {
          id: '3',
          question: 'I am comfortable taking risks',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 3,
        },
        {
          id: '4',
          question: 'I prefer structured and organized environments',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 4,
        },
        {
          id: '5',
          question: 'I enjoy creative and innovative tasks',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          imageUrl: null,
          order: 5,
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

      // Transform image URLs to accessible URLs
      const questionsWithImages = await Promise.all(
        questions.map(async (q) => ({
          ...q,
          imageUrl: await this.transformImageUrl(q.imageUrl),
        }))
      );

      this.logger.log(`✅ Returning ${questionsWithImages.length} personality questions for user ${userId}`);
      return { questions: questionsWithImages };
    } catch (error: any) {
      this.logger.error(`❌ Error getting daily digest questions for user ${userId}: ${error.message}`, error.stack);
      // Return empty array on error instead of throwing
      return { questions: [] };
    }
  }
}
