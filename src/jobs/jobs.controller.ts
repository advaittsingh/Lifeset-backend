import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('applied')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get applied jobs for current user' })
  async getAppliedJobs(@CurrentUser() user: any, @Query() filters: any) {
    return this.jobsService.getAppliedJobs(user.id, filters);
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
    @Body() data?: { coverLetter?: string },
  ) {
    // Get job details - this handles both JobPost and Post IDs
    const job = await this.jobsService.getJobById(id);
    // Use the job ID (which could be JobPost ID or Post ID) and the postId
    const coverLetter = data?.coverLetter || undefined;
    return this.jobsService.applyForJob(user.id, job.id, job.postId || job.post?.id || id, coverLetter);
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

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete job (soft delete)' })
  async deleteJob(@Param('id') id: string) {
    return this.jobsService.deleteJob(id);
  }
}

