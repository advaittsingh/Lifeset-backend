import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-code')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my referral code' })
  async getMyCode(@CurrentUser() user: any) {
    return this.referralService.getMyReferralCode(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-referrals')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my referrals' })
  async getMyReferrals(@CurrentUser() user: any) {
    return this.referralService.getMyReferrals(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('send-whatsapp')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send WhatsApp invite' })
  async sendWhatsAppInvite(
    @CurrentUser() user: any,
    @Body() data: { phoneNumber: string },
  ) {
    const referralCode = await this.referralService.getMyReferralCode(user.id);
    return this.referralService.sendWhatsAppInvite(
      data.phoneNumber,
      referralCode.referralCode,
      user.email?.split('@')[0] || 'Friend',
    );
  }

  @Public()
  @Post('verify-code')
  @ApiOperation({ summary: 'Verify referral code' })
  async verifyCode(@Body() data: { code: string }) {
    return this.referralService.verifyReferralCode(data.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('use-code')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Use referral code' })
  async useCode(@CurrentUser() user: any, @Body() data: { code: string }) {
    return this.referralService.useReferralCode(user.id, data.code);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get referral leaderboard' })
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.referralService.getLeaderboard(limit ? parseInt(limit.toString()) : 10);
  }
}

