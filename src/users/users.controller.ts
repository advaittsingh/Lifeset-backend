import { Controller, Get, Post, Param, Query, Body, UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  async searchUsers(@Query('q') query: string, @Query() filters: any) {
    return this.usersService.searchUsers(query, filters);
  }

  @Post('save-push-token')
  @ApiOperation({ summary: 'Save Expo push token to user record (mobile app endpoint)' })
  async savePushToken(
    @CurrentUser() user: any,
    @Body() data: { pushToken?: string; token?: string },
  ) {
    // Support both 'pushToken' and 'token' field names for compatibility
    const token = data.pushToken || data.token;
    if (!token) {
      throw new BadRequestException('pushToken or token is required');
    }
    return this.notificationsService.saveExpoPushToken(user.id, token);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}

