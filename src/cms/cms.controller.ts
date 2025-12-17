import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsService } from './cms.service';

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
  async getCurrentAffairs(@Query() filters: any) {
    return this.cmsService.getCurrentAffairs(filters);
  }

  @Get('current-affairs/:id')
  @ApiOperation({ summary: 'Get current affair by ID' })
  async getCurrentAffairById(@Param('id') id: string) {
    return this.cmsService.getCurrentAffairById(id);
  }

  @Get('general-knowledge')
  @ApiOperation({ summary: 'Get general knowledge articles' })
  async getGeneralKnowledge(@Query() filters: any) {
    return this.cmsService.getGeneralKnowledge(filters);
  }

  @Get('general-knowledge/:id')
  @ApiOperation({ summary: 'Get general knowledge article by ID' })
  async getGeneralKnowledgeById(@Param('id') id: string) {
    return this.cmsService.getGeneralKnowledgeById(id);
  }
}

