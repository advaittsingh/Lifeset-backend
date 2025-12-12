import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BadgesService } from './badges.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Badges')
@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all badges' })
  async getAllBadges() {
    return this.badgesService.getAllBadges();
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-badges')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my badges' })
  async getUserBadges(@CurrentUser() user: any) {
    return this.badgesService.getUserBadges(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check-eligibility')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check badge eligibility' })
  async checkEligibility(@CurrentUser() user: any) {
    return this.badgesService.checkBadgeEligibility(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get badge progress' })
  async getBadgeProgress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.badgesService.getBadgeProgress(user.id, id);
  }
}

