import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NetworkService } from './network.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Network')
@Controller('network')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users for networking' })
  async searchUsers(@Query('q') query: string, @Query() filters: any) {
    return this.networkService.searchUsers(query, filters);
  }

  @Get('connections')
  @ApiOperation({ summary: 'Get my network' })
  async getMyNetwork(@CurrentUser() user: any) {
    return this.networkService.getMyNetwork(user.id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get connection requests' })
  async getConnectionRequests(@CurrentUser() user: any) {
    return this.networkService.getConnectionRequests(user.id);
  }

  @Post('request')
  @ApiOperation({ summary: 'Send connection request' })
  async sendConnectionRequest(
    @CurrentUser() user: any,
    @Body() data: { receiverId: string; message?: string },
  ) {
    return this.networkService.sendConnectionRequest(user.id, data.receiverId, data.message);
  }

  @Post('connections/:id/accept')
  @ApiOperation({ summary: 'Accept connection request' })
  async acceptConnection(@CurrentUser() user: any, @Param('id') id: string) {
    return this.networkService.acceptConnection(user.id, id);
  }

  @Post('connections/:id/decline')
  @ApiOperation({ summary: 'Decline connection request' })
  async declineConnection(@CurrentUser() user: any, @Param('id') id: string) {
    return this.networkService.declineConnection(user.id, id);
  }

  @Get('my-card')
  @ApiOperation({ summary: 'Get my user card' })
  async getMyCard(@CurrentUser() user: any) {
    return this.networkService.generateUserCard(user.id);
  }
}

