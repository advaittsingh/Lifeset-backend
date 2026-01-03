import { Controller, Get, Post, Body, UseGuards, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PersonalityService } from './personality.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Personality')
@Controller('personality')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PersonalityController {
  constructor(private readonly personalityService: PersonalityService) {}

  @Get('quiz')
  @ApiOperation({ summary: 'Get personality quiz questions (up to 70 unanswered)' })
  async getQuiz(@CurrentUser() user: any) {
    return this.personalityService.getQuizQuestions(user?.id);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit personality quiz answers' })
  async submitQuiz(@CurrentUser() user: any, @Body() data: { answers: Record<string, number> }) {
    return this.personalityService.evaluateAnswers(user.id, data.answers);
  }

  @Get('result')
  @ApiOperation({ summary: 'Get user personality result' })
  async getResult(@CurrentUser() user: any) {
    return this.personalityService.getPersonalityResult(user.id);
  }

  @Get('daily-digest-questions')
  @ApiOperation({ summary: 'Get 2 unanswered personality questions for daily digest' })
  async getDailyDigestQuestions(
    @CurrentUser() user: any,
    @Query('excludeAnswered') excludeAnswered?: string,
  ) {
    const excludeAnsweredBool = excludeAnswered === 'true' || excludeAnswered === undefined;
    return this.personalityService.getDailyDigestQuestions(user.id, excludeAnsweredBool);
  }

  @Post('track-view/:questionId')
  @ApiOperation({ summary: 'Track when a personality question is viewed' })
  async trackView(
    @CurrentUser() user: any,
    @Param('questionId') questionId: string,
  ) {
    return this.personalityService.trackView(user?.id, questionId);
  }

  @Post('track-duration/:questionId')
  @ApiOperation({ summary: 'Track time spent viewing a personality question' })
  async trackDuration(
    @CurrentUser() user: any,
    @Param('questionId') questionId: string,
    @Body() data: { duration: number },
  ) {
    return this.personalityService.trackDuration(user?.id, questionId, data.duration);
  }

  @Post('submit-answer')
  @ApiOperation({ summary: 'Submit answer for a single personality question' })
  async submitAnswer(
    @CurrentUser() user: any,
    @Body() data: { questionId: string; answerIndex: number },
  ) {
    return this.personalityService.submitAnswer(user.id, data.questionId, data.answerIndex);
  }

  @Post('report')
  @ApiOperation({ summary: 'Report a personality question with feedback' })
  async reportQuestion(
    @CurrentUser() user: any,
    @Body() data: { questionId: string; feedback: string },
  ) {
    return this.personalityService.reportQuestion(user.id, data.questionId, data.feedback);
  }
}

