import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InstitutesService } from './institutes.service';

@ApiTags('Institutes')
@Controller('institutes')
export class InstitutesController {
  constructor(private readonly institutesService: InstitutesService) {}

  @Get()
  @ApiOperation({ summary: 'Get institutes list' })
  async getInstitutes(@Query() filters: any) {
    return this.institutesService.getInstitutes(filters);
  }

  @Get('semesters/list')
  @ApiOperation({ summary: 'Get standard semester list (1st-8th Semester)' })
  async getSemesters() {
    return this.institutesService.getSemesters();
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get course by ID' })
  async getCourseById(@Param('id') id: string) {
    return this.institutesService.getCourseById(id);
  }

  @Get(':id/sections')
  @ApiOperation({ summary: 'Get sections for an institute' })
  async getSections(@Param('id') id: string) {
    return this.institutesService.getSectionsByCollegeId(id);
  }

  @Get(':id/courses')
  @ApiOperation({ summary: 'Get institute courses' })
  async getCourses(@Param('id') id: string) {
    return this.institutesService.getCourses(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get institute by ID' })
  async getInstituteById(@Param('id') id: string) {
    return this.institutesService.getInstituteById(id);
  }
}

