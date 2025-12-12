import { Controller, Get, Query } from '@nestjs/common';
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
}

