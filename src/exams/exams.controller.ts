import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  @ApiOperation({ summary: 'Get exams list' })
  async getExams() {
    return this.examsService.getExams();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam by ID' })
  async getExamById(@Param('id') id: string) {
    return this.examsService.getExamById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/attempt')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit exam attempt' })
  async submitExam(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { answers: any },
  ) {
    return this.examsService.submitExam(user.id, id, data.answers);
  }
}

