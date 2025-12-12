import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecruiterService } from './recruiter.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Recruiter')
@Controller('recruiter')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecruiterController {
  constructor(
    private readonly recruiterService: RecruiterService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyProfile(userId: string) {
    const companyProfile = await this.prisma.companyProfile.findUnique({
      where: { userId },
    });
    if (!companyProfile) {
      throw new BadRequestException('Company profile not found');
    }
    return companyProfile;
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get recruiter dashboard stats' })
  async getDashboard(@CurrentUser() user: any) {
    const companyProfile = await this.getCompanyProfile(user.id);
    return this.recruiterService.getDashboardStats(companyProfile.id);
  }

  @Get('reports/jobs')
  @ApiOperation({ summary: 'Get job reports' })
  async getJobReports(@CurrentUser() user: any, @Query() filters: any) {
    const companyProfile = await this.getCompanyProfile(user.id);
    return this.recruiterService.getJobReports(companyProfile.id, filters);
  }

  @Get('reports/applications')
  @ApiOperation({ summary: 'Get application reports' })
  async getApplicationReports(@CurrentUser() user: any, @Query() filters: any) {
    const companyProfile = await this.getCompanyProfile(user.id);
    return this.recruiterService.getApplicationReports(companyProfile.id, filters);
  }

  @Get('analytics/candidates')
  @ApiOperation({ summary: 'Get candidate analytics' })
  async getCandidateAnalytics(@CurrentUser() user: any) {
    const companyProfile = await this.getCompanyProfile(user.id);
    return this.recruiterService.getCandidateAnalytics(companyProfile.id);
  }

  @Get('analytics/job-performance')
  @ApiOperation({ summary: 'Get job performance analytics' })
  async getJobPerformance(@CurrentUser() user: any, @Query('jobId') jobId?: string) {
    const companyProfile = await this.getCompanyProfile(user.id);
    return this.recruiterService.getJobPerformance(companyProfile.id, jobId);
  }
}
