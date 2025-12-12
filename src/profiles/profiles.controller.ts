import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Profiles')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.profilesService.getProfile(user.id);
  }

  @Put('me/basic-info')
  @ApiOperation({ summary: 'Update basic info' })
  async updateBasicInfo(@CurrentUser() user: any, @Body() data: any) {
    return this.profilesService.updateBasicInfo(user.id, data);
  }

  @Put('me/education')
  @ApiOperation({ summary: 'Update education' })
  async updateEducation(@CurrentUser() user: any, @Body() data: any) {
    return this.profilesService.updateEducation(user.id, data);
  }

  @Put('me/skills')
  @ApiOperation({ summary: 'Update skills' })
  async updateSkills(@CurrentUser() user: any, @Body() data: any) {
    return this.profilesService.updateSkills(user.id, data);
  }

  @Put('me/interests')
  @ApiOperation({ summary: 'Update interests' })
  async updateInterests(@CurrentUser() user: any, @Body() data: { interests: string[] }) {
    return this.profilesService.updateInterests(user.id, data.interests);
  }

  @Post('me/profile-image')
  @ApiOperation({ summary: 'Upload profile image' })
  async uploadProfileImage(@CurrentUser() user: any, @Body() data: { imageUrl: string }) {
    return this.profilesService.uploadProfileImage(user.id, data.imageUrl);
  }

  @Get('me/completion')
  @ApiOperation({ summary: 'Get profile completion percentage' })
  async getProfileCompletion(@CurrentUser() user: any) {
    return this.profilesService.getProfileCompletion(user.id);
  }
}

