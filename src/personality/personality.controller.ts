import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get personality quiz questions' })
  async getQuiz() {
    return this.personalityService.getQuizQuestions();
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
}

