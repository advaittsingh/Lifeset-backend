import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Get jobs list' })
  async getJobs(@Query() filters: any) {
    return this.jobsService.getJobs(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by ID' })
  async getJobById(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.jobsService.getJobById(id, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/apply')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply for job' })
  async applyForJob(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { coverLetter?: string },
  ) {
    // Get postId from jobPost
    const jobPost = await this.jobsService.getJobById(id);
    return this.jobsService.applyForJob(user.id, id, jobPost.postId, data.coverLetter);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/applications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get job applications' })
  async getApplications(@Param('id') id: string) {
    return this.jobsService.getApplications(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications/:id/shortlist')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Shortlist candidate' })
  async shortlistCandidate(@Param('id') id: string, @Body() data: { status: string }) {
    return this.jobsService.shortlistCandidate(id, data.status);
  }
}

