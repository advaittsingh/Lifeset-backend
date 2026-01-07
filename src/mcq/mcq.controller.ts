import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { McqService } from './mcq.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('MCQ')
@Controller('mcq')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class McqController {
  constructor(private readonly mcqService: McqService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get MCQ categories' })
  async getCategories() {
    return this.mcqService.getCategories();
  }

  @Get('questions/list')
  @ApiOperation({ summary: 'Get MCQ questions list (lightweight, optimized for list views)' })
  async getQuestionsList(@Query() filters: any) {
    return this.mcqService.getQuestionsList(filters);
  }

  @Get('questions')
  @ApiOperation({ summary: 'Get MCQ questions' })
  async getQuestions(
    @Query() filters: any,
    @CurrentUser() user?: any,
  ) {
    return this.mcqService.getQuestions(filters, user?.id);
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Get question by ID' })
  async getQuestionById(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.mcqService.getQuestionById(id, user?.id);
  }

  @Post('questions/:id/answer')
  @ApiOperation({ summary: 'Submit answer (returns isCorrect, correctAnswerIndex, solution)' })
  async submitAnswer(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { selectedAnswer: number; timeSpent?: number },
  ) {
    return this.mcqService.submitAnswer(user.id, id, data.selectedAnswer, data.timeSpent);
  }

  @Post('questions/:id/bookmark')
  @ApiOperation({ summary: 'Bookmark question' })
  async bookmarkQuestion(@CurrentUser() user: any, @Param('id') id: string) {
    return this.mcqService.bookmarkQuestion(user.id, id);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'Get bookmarked questions' })
  async getBookmarkedQuestions(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    return this.mcqService.getBookmarkedQuestions(user.id, limitNum);
  }

  @Get('attempts')
  @ApiOperation({ summary: 'Get user attempts' })
  async getUserAttempts(@CurrentUser() user: any, @Query('questionId') questionId?: string) {
    return this.mcqService.getUserAttempts(user.id, questionId);
  }

  @Get('daily-digest-linked')
  @ApiOperation({ summary: 'Get linked MCQs based on current affairs or general knowledge articles' })
  async getDailyDigestLinkedMcqs(
    @CurrentUser() user: any,
    @Query('articleId') articleId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.mcqService.getDailyDigestLinkedMcqs(articleId, categoryId);
  }

  @Post('questions/:id/report')
  @ApiOperation({ summary: 'Report a MCQ question' })
  async reportQuestion(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { reason?: string; description?: string },
  ) {
    return this.mcqService.reportQuestion(user.id, id, data.reason, data.description);
  }

  @Public()
  @Post('questions/:id/view')
  @ApiOperation({ summary: 'Track view for a MCQ question' })
  async trackView(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.mcqService.trackView(id, user?.id);
  }

  @Public()
  @Post('questions/:id/view-duration')
  @ApiOperation({ summary: 'Track view duration for a MCQ question' })
  async trackViewDuration(
    @Param('id') id: string,
    @Body() data: { duration: number },
    @CurrentUser() user?: any,
  ) {
    return this.mcqService.trackViewDuration(id, data.duration, user?.id);
  }
}

