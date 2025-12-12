import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Performance')
@Controller('performance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('score')
  @ApiOperation({ summary: 'Get user score' })
  async getScore(@CurrentUser() user: any) {
    return this.performanceService.getScore(user.id);
  }

  @Get('score/weekly')
  @ApiOperation({ summary: 'Get weekly score' })
  async getWeeklyScore(@CurrentUser() user: any) {
    return this.performanceService.getWeeklyScore(user.id);
  }

  @Get('score/monthly')
  @ApiOperation({ summary: 'Get monthly score' })
  async getMonthlyScore(@CurrentUser() user: any) {
    return this.performanceService.getMonthlyScore(user.id);
  }

  @Get('score/history')
  @ApiOperation({ summary: 'Get score history' })
  async getScoreHistory(@CurrentUser() user: any, @Query('period') period: string) {
    return this.performanceService.getScoreHistory(user.id, period as any);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard' })
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.performanceService.getLeaderboard(limit);
  }
}

