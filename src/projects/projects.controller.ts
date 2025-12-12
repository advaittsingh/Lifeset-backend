import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get projects' })
  async getProjects(@Query('studentId') studentId?: string) {
    return this.projectsService.getProjects(studentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  async getProjectById(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create project' })
  async createProject(@CurrentUser() user: any, @Body() data: any) {
    // Get student profile
    const studentProfile = await this.projectsService['prisma'].studentProfile.findUnique({
      where: { userId: user.id },
    });

    if (!studentProfile) {
      throw new Error('Student profile not found');
    }

    return this.projectsService.createProject(studentProfile.id, data);
  }
}

