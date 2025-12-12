import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedsService } from './feeds.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Feeds')
@Controller('feeds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get()
  @ApiOperation({ summary: 'Get feeds list' })
  async getFeeds(@Query() filters: any) {
    return this.feedsService.getFeeds(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feed by ID' })
  async getFeedById(@Param('id') id: string) {
    return this.feedsService.getFeedById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new feed' })
  async createFeed(@CurrentUser() user: any, @Body() data: any) {
    return this.feedsService.createFeed(user.id, data);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like/unlike feed' })
  async likeFeed(@CurrentUser() user: any, @Param('id') id: string) {
    return this.feedsService.likeFeed(user.id, id);
  }

  @Post(':id/bookmark')
  @ApiOperation({ summary: 'Bookmark/unbookmark feed' })
  async bookmarkFeed(@CurrentUser() user: any, @Param('id') id: string) {
    return this.feedsService.bookmarkFeed(user.id, id);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Comment on feed' })
  async commentOnFeed(@CurrentUser() user: any, @Param('id') id: string, @Body() data: { comment: string }) {
    return this.feedsService.commentOnFeed(user.id, id, data.comment);
  }
}

