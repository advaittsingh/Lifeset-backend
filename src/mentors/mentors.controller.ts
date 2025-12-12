import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MentorsService } from './mentors.service';

@ApiTags('Mentors')
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get mentors list' })
  async getMentors(@Query() filters: any) {
    return this.mentorsService.getMentors(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mentor by ID' })
  async getMentorById(@Param('id') id: string) {
    return this.mentorsService.getMentorById(id);
  }
}

