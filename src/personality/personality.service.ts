import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PersonalityService {
  private openaiApiKey: string;
  private openaiBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.openaiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
  }

  async getQuizQuestions() {
    // Get personality quiz questions from database or return default set
    const questions = await this.prisma.personalityQuiz.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      take: 20,
    });

    if (questions.length === 0) {
      // Return default questions if none in database
      return this.getDefaultQuestions();
    }

    return { questions };
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
          order: 1,
        },
        {
          id: '2',
          question: 'I enjoy solving complex problems',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          order: 2,
        },
        {
          id: '3',
          question: 'I am comfortable taking risks',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          order: 3,
        },
        {
          id: '4',
          question: 'I prefer structured and organized environments',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          order: 4,
        },
        {
          id: '5',
          question: 'I enjoy creative and innovative tasks',
          options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
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
}
