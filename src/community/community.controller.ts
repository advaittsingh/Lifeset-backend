import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CommunityService } from './community.service';

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get community categories' })
  async getCategories() {
    return this.communityService.getCategories();
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get community posts' })
  async getPosts(@Query('categoryId') categoryId?: string) {
    return this.communityService.getPosts(categoryId);
  }
}

