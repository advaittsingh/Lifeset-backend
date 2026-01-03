import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserType } from '@/shared';

@ApiTags('App Config')
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('icon')
  @ApiOperation({ summary: 'Get app icon configuration (public)' })
  async getAppIcon() {
    return this.appConfigService.getAppIconConfig();
  }

  @Put('icon')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update app icon configuration (admin only)' })
  async updateAppIcon(
    @Body() data: {
      ios?: string;
      android?: string;
      default?: string;
    },
  ) {
    return this.appConfigService.updateAppIcon(data);
  }

  @Get('referral-carousel')
  @ApiOperation({ summary: 'Get referral carousel configuration (public)' })
  async getReferralCarousel() {
    return this.appConfigService.getReferralCarousel();
  }

  @Put('referral-carousel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update referral carousel configuration (admin only)' })
  async updateReferralCarousel(
    @Body() data: {
      items: Array<{
        id?: string;
        type: 'image' | 'topPerformer';
        imageUrl?: string;
        title?: string;
        subtitle?: string;
        redirectLink?: string;
        order?: number;
      }>;
    },
  ) {
    return this.appConfigService.updateReferralCarousel(data);
  }
}
