import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TrackEngagementDto } from './dto/track-engagement.dto';

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

  // ========== Daily Digest Engagement ==========
  @Post('daily-digest/engagement')
  @ApiOperation({ summary: 'Track daily digest engagement' })
  @ApiBody({ type: TrackEngagementDto })
  async trackEngagement(
    @CurrentUser() user: any,
    @Body() dto: TrackEngagementDto,
  ) {
    return this.performanceService.trackEngagement(user.id, dto);
  }

  // ========== Weekly Performance Meter ==========
  @Get('weekly-meter')
  @ApiOperation({ summary: 'Get weekly performance meter (last 7 days)' })
  async getWeeklyMeter(@CurrentUser() user: any) {
    return this.performanceService.getWeeklyMeter(user.id);
  }

  // ========== Badge Status ==========
  @Get('badge-status')
  @ApiOperation({ summary: 'Get user badge status based on 6-month activity' })
  async getBadgeStatus(@CurrentUser() user: any) {
    return this.performanceService.getBadgeStatus(user.id);
  }
}

