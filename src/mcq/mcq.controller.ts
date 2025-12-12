import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { McqService } from './mcq.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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

  @Get('questions')
  @ApiOperation({ summary: 'Get MCQ questions' })
  async getQuestions(@Query() filters: any) {
    return this.mcqService.getQuestions(filters);
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Get question by ID' })
  async getQuestionById(@Param('id') id: string) {
    return this.mcqService.getQuestionById(id);
  }

  @Post('questions/:id/answer')
  @ApiOperation({ summary: 'Submit answer' })
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
  async getBookmarkedQuestions(@CurrentUser() user: any) {
    return this.mcqService.getBookmarkedQuestions(user.id);
  }

  @Get('attempts')
  @ApiOperation({ summary: 'Get user attempts' })
  async getUserAttempts(@CurrentUser() user: any, @Query('questionId') questionId?: string) {
    return this.mcqService.getUserAttempts(user.id, questionId);
  }
}

