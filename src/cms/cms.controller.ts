import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('CMS')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages')
  @ApiOperation({ summary: 'Get CMS pages' })
  async getPages() {
    return this.cmsService.getPages();
  }

  @Get('news')
  @ApiOperation({ summary: 'Get news articles' })
  async getNews(@Query() filters: any) {
    return this.cmsService.getNews(filters);
  }

  @Get('gallery')
  @ApiOperation({ summary: 'Get gallery images' })
  async getGallery(@Query() filters: any) {
    return this.cmsService.getGallery(filters);
  }

  @Get('faqs')
  @ApiOperation({ summary: 'Get FAQs' })
  async getFaqs() {
    return this.cmsService.getFaqs();
  }

  @Get('current-affairs')
  @ApiOperation({ summary: 'Get current affairs articles' })
  async getCurrentAffairs(
    @Query() filters: any,
    @CurrentUser() user?: any,
  ) {
    return this.cmsService.getCurrentAffairs(filters, user?.id);
  }

  @Get('current-affairs/:id')
  @ApiOperation({ summary: 'Get current affair by ID' })
  async getCurrentAffairById(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.cmsService.getCurrentAffairById(id, user?.id);
  }

  @Get('general-knowledge')
  @ApiOperation({ summary: 'Get general knowledge articles' })
  async getGeneralKnowledge(@Query() filters: any) {
    return this.cmsService.getGeneralKnowledge(filters);
  }

  @Get('general-knowledge/categories')
  @ApiOperation({ summary: 'Get all general knowledge categories (parent categories)' })
  async getCategories() {
    return this.cmsService.getCategories();
  }

  @Get('general-knowledge/categories/:categoryId/subcategories')
  @ApiOperation({ summary: 'Get subcategories for a category' })
  async getSubcategories(@Param('categoryId') categoryId: string) {
    return this.cmsService.getSubcategories(categoryId);
  }

  @Get('general-knowledge/daily-digest')
  @ApiOperation({ summary: 'Get 20 random general knowledge articles for daily digest' })
  async getGeneralKnowledgeDailyDigest(@Query('excludePublished') excludePublished?: string) {
    const excludePublishedBool = excludePublished === 'true' || excludePublished === undefined;
    return this.cmsService.getGeneralKnowledgeDailyDigest(excludePublishedBool);
  }

  @Get('general-knowledge/:id')
  @ApiOperation({ summary: 'Get general knowledge article by ID' })
  async getGeneralKnowledgeById(@Param('id') id: string) {
    return this.cmsService.getGeneralKnowledgeById(id);
  }

  @Get('current-affairs/daily-digest')
  @ApiOperation({ summary: 'Get last 24 hours current affairs for daily digest' })
  async getCurrentAffairsDailyDigest() {
    return this.cmsService.getCurrentAffairsDailyDigest();
  }

  @Get('general-knowledge/subcategories/:subCategoryId/sections')
  @ApiOperation({ summary: 'Get chapters (sections) for a subcategory' })
  async getSections(@Param('subCategoryId') subCategoryId: string) {
    return this.cmsService.getSections(subCategoryId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookmarks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookmarked articles (General Knowledge and Current Affairs)' })
  async getBookmarkedArticles(@CurrentUser() user: any, @Query() filters: any) {
    return this.cmsService.getBookmarkedArticles(user.id, filters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('general-knowledge/bookmarks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bookmarked general knowledge articles' })
  async getBookmarkedGeneralKnowledge(@CurrentUser() user: any, @Query() filters: any) {
    return this.cmsService.getBookmarkedGeneralKnowledge(user.id, filters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('current-affairs/bookmarks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bookmarked current affairs articles' })
  async getBookmarkedCurrentAffairs(@CurrentUser() user: any, @Query() filters: any) {
    return this.cmsService.getBookmarkedCurrentAffairs(user.id, filters);
  }

  @UseGuards(JwtAuthGuard)
  @Post('general-knowledge/:id/bookmark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookmark or unbookmark a general knowledge article' })
  async bookmarkArticle(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cmsService.bookmarkArticle(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('general-knowledge/:id/report')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a general knowledge article' })
  async reportArticle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { reason?: string; description?: string },
  ) {
    return this.cmsService.reportArticle(user.id, id, data.reason, data.description);
  }

  @UseGuards(JwtAuthGuard)
  @Post('current-affairs/:id/bookmark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookmark or unbookmark a current affair article' })
  async bookmarkCurrentAffair(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cmsService.bookmarkCurrentAffair(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('current-affairs/:id/report')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a current affair article' })
  async reportCurrentAffair(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { reason?: string; description?: string },
  ) {
    return this.cmsService.reportCurrentAffair(user.id, id, data.reason, data.description);
  }

  @Public()
  @Post('current-affairs/:id/view')
  @ApiOperation({ summary: 'Track view for a current affair article' })
  async trackView(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.cmsService.trackView(id, user?.id);
  }

  @Public()
  @Post('current-affairs/:id/view-duration')
  @ApiOperation({ summary: 'Track view duration for a current affair article' })
  async trackViewDuration(
    @Param('id') id: string,
    @Body() data: { duration: number },
    @CurrentUser() user?: any,
  ) {
    return this.cmsService.trackViewDuration(id, data.duration, user?.id);
  }
}

