import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CmsAdminService } from './cms-admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '@/shared';
import { CreateArticleDto } from './dto/create-article.dto';
import { CreateMcqDto } from './dto/create-mcq.dto';
import { CreateWallCategoryDto } from './dto/create-wall-category.dto';
import { UpdateWallCategoryDto } from './dto/update-wall-category.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@ApiTags('CMS Admin')
@Controller('admin/cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserType.ADMIN)
export class CmsAdminController {
  constructor(private readonly cmsAdminService: CmsAdminService) {}

  // ========== Current Affairs ==========
  @Get('current-affairs')
  @ApiOperation({ summary: 'Get current affairs (Admin)' })
  async getCurrentAffairs(@Query() filters: any) {
    return this.cmsAdminService.getCurrentAffairs(filters);
  }

  @Get('current-affairs/:id')
  @ApiOperation({ summary: 'Get current affair by ID (Admin)' })
  async getCurrentAffairById(@Param('id') id: string) {
    return this.cmsAdminService.getCurrentAffairById(id);
  }

  @Post('current-affairs')
  @ApiOperation({ summary: 'Create current affair (Admin)' })
  async createCurrentAffair(@CurrentUser() user: any, @Body() data: CreateArticleDto) {
    return this.cmsAdminService.createCurrentAffair(data, user.id);
  }

  @Put('current-affairs/:id')
  @ApiOperation({ summary: 'Update current affair (Admin)' })
  async updateCurrentAffair(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateCurrentAffair(id, data);
  }

  @Delete('current-affairs/:id')
  @ApiOperation({ summary: 'Delete current affair (Admin)' })
  async deleteCurrentAffair(@Param('id') id: string) {
    return this.cmsAdminService.deleteCurrentAffair(id);
  }

  // ========== General Knowledge ==========
  @Get('general-knowledge')
  @ApiOperation({ summary: 'Get general knowledge articles (Admin)' })
  async getGeneralKnowledge(@Query() filters: any) {
    return this.cmsAdminService.getGeneralKnowledge(filters);
  }

  @Get('general-knowledge/:id')
  @ApiOperation({ summary: 'Get general knowledge article by ID (Admin)' })
  async getGeneralKnowledgeById(@Param('id') id: string) {
    return this.cmsAdminService.getGeneralKnowledgeById(id);
  }

  @Post('general-knowledge')
  @ApiOperation({ summary: 'Create general knowledge article (Admin)' })
  async createGeneralKnowledge(@CurrentUser() user: any, @Body() data: CreateArticleDto) {
    return this.cmsAdminService.createGeneralKnowledge(data, user.id);
  }

  @Put('general-knowledge/:id')
  @ApiOperation({ summary: 'Update general knowledge article (Admin)' })
  async updateGeneralKnowledge(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateGeneralKnowledge(id, data);
  }

  @Delete('general-knowledge/:id')
  @ApiOperation({ summary: 'Delete general knowledge article (Admin)' })
  async deleteGeneralKnowledge(@Param('id') id: string) {
    return this.cmsAdminService.deleteGeneralKnowledge(id);
  }

  // ========== MCQ Management ==========
  @Get('mcq/questions')
  @ApiOperation({ summary: 'Get MCQ questions (Admin)' })
  async getMcqQuestions(@Query() filters: any) {
    return this.cmsAdminService.getMcqQuestions(filters);
  }

  @Post('mcq/questions')
  @ApiOperation({ summary: 'Create MCQ question (Admin)' })
  async createMcqQuestion(@Body() data: CreateMcqDto) {
    // All fields are now direct columns, pass through directly
    return this.cmsAdminService.createMcqQuestion(data);
  }

  @Put('mcq/questions/:id')
  @ApiOperation({ summary: 'Update MCQ question (Admin)' })
  async updateMcqQuestion(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateMcqQuestion(id, data);
  }

  @Delete('mcq/questions/:id')
  @ApiOperation({ summary: 'Delete MCQ question (Admin)' })
  async deleteMcqQuestion(@Param('id') id: string) {
    return this.cmsAdminService.deleteMcqQuestion(id);
  }

  @Get('mcq/categories')
  @ApiOperation({ summary: 'Get MCQ categories (Admin)' })
  async getMcqCategories() {
    return this.cmsAdminService.getMcqCategories();
  }

  @Post('mcq/categories')
  @ApiOperation({ summary: 'Create MCQ category (Admin)' })
  async createMcqCategory(@Body() data: any) {
    return this.cmsAdminService.createMcqCategory(data);
  }

  // ========== Know Yourself ==========
  @Get('personality/questions')
  @ApiOperation({ summary: 'Get personality quiz questions (Admin)' })
  async getPersonalityQuestions(@Query() filters: { isPublished?: boolean }) {
    return this.cmsAdminService.getPersonalityQuestions(filters);
  }

  @Post('personality/questions')
  @ApiOperation({ summary: 'Create personality question (Admin)' })
  async createPersonalityQuestion(@Body() data: any) {
    return this.cmsAdminService.createPersonalityQuestion(data);
  }

  @Put('personality/questions/:id')
  @ApiOperation({ summary: 'Update personality question (Admin)' })
  async updatePersonalityQuestion(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updatePersonalityQuestion(id, data);
  }

  @Delete('personality/questions/:id')
  @ApiOperation({ summary: 'Delete personality question (Admin)' })
  async deletePersonalityQuestion(@Param('id') id: string) {
    return this.cmsAdminService.deletePersonalityQuestion(id);
  }

  // ========== Daily Digest ==========
  @Get('daily-digest')
  @ApiOperation({ summary: 'Get daily digests (Admin)' })
  async getDailyDigests(@Query() filters: any) {
    return this.cmsAdminService.getDailyDigests(filters);
  }

  @Post('daily-digest')
  @ApiOperation({ summary: 'Create daily digest (Admin)' })
  async createDailyDigest(@CurrentUser() user: any, @Body() data: any) {
    return this.cmsAdminService.createDailyDigest(data, user.id);
  }

  // ========== College Events ==========
  @Get('college-events')
  @ApiOperation({ summary: 'Get college events (Admin)' })
  async getCollegeEvents(@Query() filters: any) {
    return this.cmsAdminService.getCollegeEvents(filters);
  }

  @Post('college-events')
  @ApiOperation({ summary: 'Create college event (Admin)' })
  async createCollegeEvent(@CurrentUser() user: any, @Body() data: any) {
    return this.cmsAdminService.createCollegeEvent(data, user.id);
  }

  // ========== Govt Vacancies ==========
  @Get('govt-vacancies')
  @ApiOperation({ summary: 'Get government vacancies (Admin)' })
  async getGovtVacancies(@Query() filters: any) {
    return this.cmsAdminService.getGovtVacancies(filters);
  }

  // ========== Jobs ==========
  @Get('jobs')
  @ApiOperation({ summary: 'Get all jobs (Admin)' })
  async getJobs(@Query() filters: any) {
    return this.cmsAdminService.getJobs(filters);
  }

  @Put('jobs/:id')
  @ApiOperation({ summary: 'Update job (Admin)' })
  async updateJob(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateJob(id, data);
  }

  // ========== Internships ==========
  @Get('internships')
  @ApiOperation({ summary: 'Get internships (Admin)' })
  async getInternships(@Query() filters: any) {
    return this.cmsAdminService.getInternships(filters);
  }

  // ========== Freelancing ==========
  @Get('freelancing')
  @ApiOperation({ summary: 'Get freelancing opportunities (Admin)' })
  async getFreelancing(@Query() filters: any) {
    return this.cmsAdminService.getFreelancing(filters);
  }

  // ========== College Feeds ==========
  @Get('college-feeds')
  @ApiOperation({ summary: 'Get college feeds (Admin)' })
  async getCollegeFeeds(@Query() filters: any) {
    return this.cmsAdminService.getCollegeFeeds(filters);
  }

  // ========== Students Community ==========
  @Get('community')
  @ApiOperation({ summary: 'Get community posts (Admin)' })
  async getCommunityPosts(@Query() filters: any) {
    return this.cmsAdminService.getCommunityPosts(filters);
  }

  @Post('community/:id/moderate')
  @ApiOperation({ summary: 'Moderate community post (Admin)' })
  async moderateCommunityPost(
    @Param('id') id: string,
    @Body() data: { action: 'approve' | 'reject' | 'delete' },
  ) {
    return this.cmsAdminService.moderateCommunityPost(id, data.action);
  }

  // ========== Feeds ==========
  @Get('feeds')
  @ApiOperation({ summary: 'Get all feeds (Admin)' })
  async getFeeds(@Query() filters: any) {
    return this.cmsAdminService.getFeeds(filters);
  }

  @Put('feeds/:id')
  @ApiOperation({ summary: 'Update feed (Admin)' })
  async updateFeed(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateFeed(id, data);
  }

  @Delete('feeds/:id')
  @ApiOperation({ summary: 'Delete feed (Admin)' })
  async deleteFeed(@Param('id') id: string) {
    return this.cmsAdminService.deleteFeed(id);
  }

  // ========== Users ==========
  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin)' })
  async getUsers(@Query() filters: any) {
    return this.cmsAdminService.getUsers(filters);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user (Admin)' })
  async updateUser(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateUser(id, data);
  }

  // ========== Institutes ==========
  @Get('institutes')
  @ApiOperation({ summary: 'Get all institutes (Admin)' })
  async getInstitutes(@Query() filters: any) {
    return this.cmsAdminService.getInstitutes(filters);
  }

  @Post('institutes')
  @ApiOperation({ summary: 'Create institute (Admin)' })
  async createInstitute(@Body() data: any) {
    return this.cmsAdminService.createInstitute(data);
  }

  @Put('institutes/:id')
  @ApiOperation({ summary: 'Update institute (Admin)' })
  async updateInstitute(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateInstitute(id, data);
  }

  @Delete('institutes/:id')
  @ApiOperation({ summary: 'Delete institute (Admin)' })
  async deleteInstitute(@Param('id') id: string) {
    return this.cmsAdminService.deleteInstitute(id);
  }

  // ========== Course Master Data ==========
  @Get('course-master')
  @ApiOperation({ summary: 'Get course master data (Admin)' })
  async getCourseMasterData() {
    return this.cmsAdminService.getCourseMasterData();
  }

  @Post('course-master/categories')
  @ApiOperation({ summary: 'Create course category (Admin)' })
  async createCourseCategory(@Body() data: any) {
    return this.cmsAdminService.createCourseCategory(data);
  }

  @Put('course-master/categories/:id')
  @ApiOperation({ summary: 'Update course category (Admin)' })
  async updateCourseCategory(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateCourseCategory(id, data);
  }

  @Get('institutes/:id/courses')
  @ApiOperation({ summary: 'Get courses by institute (Admin)' })
  async getCoursesByInstitute(@Param('id') id: string) {
    return this.cmsAdminService.getCoursesByInstitute(id);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Create course (Admin)' })
  async createCourse(@Body() data: any) {
    return this.cmsAdminService.createCourse(data);
  }

  @Put('courses/:id')
  @ApiOperation({ summary: 'Update course (Admin)' })
  async updateCourse(@Param('id') id: string, @Body() data: any) {
    return this.cmsAdminService.updateCourse(id, data);
  }

  // ========== Wall Categories ==========
  @Get('wall-categories')
  @ApiOperation({ summary: 'Get wall categories (Admin). Use ?parentId=xxx to get sub-categories, ?onlyParents=false to get all' })
  async getWallCategories(@Query() filters: { parentId?: string; categoryFor?: string; onlyParents?: string }) {
    const categories = await this.cmsAdminService.getWallCategories({
      parentId: filters.parentId,
      categoryFor: filters.categoryFor,
      onlyParents: filters.onlyParents !== 'false', // Default to true (only parents)
    });
    return {
      success: true,
      data: categories,
    };
  }

  @Get('wall-categories/:id/sub-categories')
  @ApiOperation({ summary: 'Get sub-categories of a specific parent category (Admin)' })
  async getSubCategories(@Param('id') parentId: string) {
    const categories = await this.cmsAdminService.getWallCategories({
      parentId,
      onlyParents: false,
    });
    return {
      success: true,
      data: categories,
    };
  }

  @Post('wall-categories')
  @ApiOperation({ summary: 'Create wall category (Admin)' })
  async createWallCategory(@Body() data: CreateWallCategoryDto) {
    const category = await this.cmsAdminService.createWallCategory(data);
    return {
      success: true,
      data: category,
    };
  }

  @Put('wall-categories/:id')
  @ApiOperation({ summary: 'Update wall category (Admin)' })
  async updateWallCategory(@Param('id') id: string, @Body() data: UpdateWallCategoryDto) {
    const category = await this.cmsAdminService.updateWallCategory(id, data);
    return {
      success: true,
      data: category,
    };
  }

  @Delete('wall-categories/:id')
  @ApiOperation({ summary: 'Delete wall category (Admin)' })
  async deleteWallCategory(@Param('id') id: string) {
    return this.cmsAdminService.deleteWallCategory(id);
  }

  // ========== Chapters ==========
  // More specific routes must come before less specific ones
  @Get('sub-categories/:id/chapters')
  @ApiOperation({ summary: 'Get chapters of a specific sub-category (Admin)' })
  async getChaptersBySubCategory(@Param('id') subCategoryId: string) {
    const chapters = await this.cmsAdminService.getChapters({
      subCategoryId,
    });
    return {
      success: true,
      data: chapters,
    };
  }

  @Get('chapters')
  @ApiOperation({ summary: 'Get chapters (Admin). Use ?subCategoryId=xxx to filter by sub-category' })
  async getChapters(@Query() filters: { subCategoryId?: string; isActive?: string }) {
    const chapters = await this.cmsAdminService.getChapters({
      subCategoryId: filters.subCategoryId,
      isActive: filters.isActive !== undefined ? filters.isActive === 'true' : undefined,
    });
    return {
      success: true,
      data: chapters,
    };
  }

  @Get('chapters/:id')
  @ApiOperation({ summary: 'Get chapter by ID (Admin)' })
  async getChapterById(@Param('id') id: string) {
    const chapter = await this.cmsAdminService.getChapterById(id);
    return {
      success: true,
      data: chapter,
    };
  }

  @Post('chapters')
  @ApiOperation({ summary: 'Create chapter (Admin)' })
  async createChapter(@Body() data: CreateChapterDto) {
    const chapter = await this.cmsAdminService.createChapter(data);
    return {
      success: true,
      data: chapter,
    };
  }

  @Put('chapters/:id')
  @ApiOperation({ summary: 'Update chapter (Admin)' })
  async updateChapter(@Param('id') id: string, @Body() data: UpdateChapterDto) {
    const chapter = await this.cmsAdminService.updateChapter(id, data);
    return {
      success: true,
      data: chapter,
    };
  }

  @Delete('chapters/:id')
  @ApiOperation({ summary: 'Delete chapter (Admin)' })
  async deleteChapter(@Param('id') id: string) {
    return this.cmsAdminService.deleteChapter(id);
  }
}
