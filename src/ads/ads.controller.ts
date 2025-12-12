import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdsService } from './ads.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Public()
  @Get('slots')
  @ApiOperation({ summary: 'Get ad slots' })
  async getAdSlots() {
    return this.adsService.getAdSlots();
  }

  @Public()
  @Post('impression')
  @ApiOperation({ summary: 'Track ad impression' })
  async trackImpression(
    @Body() data: { adSlotId: string },
    @CurrentUser() user?: any,
  ) {
    return this.adsService.trackImpression(data.adSlotId, user?.id);
  }

  @Get('analytics/:id')
  @ApiOperation({ summary: 'Get ad analytics' })
  async getAdAnalytics(@Param('id') id: string) {
    return this.adsService.getAdAnalytics(id);
  }
}

