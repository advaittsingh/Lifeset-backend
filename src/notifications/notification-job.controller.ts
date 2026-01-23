import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationJobService } from './notification-job.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '@/shared';

@ApiTags('Notification Jobs')
@Controller('admin/notification-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN)
@ApiBearerAuth()
export class NotificationJobController {
  constructor(private readonly notificationJobService: NotificationJobService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification job' })
  async createJob(
    @CurrentUser() user: any,
    @Body() data: {
      messageType: string;
      title: string;
      content: string;
      image?: string;
      redirectionLink?: string;
      scheduledAt: string; // ISO date string
      language: 'ALL' | 'ENGLISH' | 'HINDI';
      frequency: 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
      userIds?: string[] | null;
      phoneNumbers?: string[];
      filterConditions?: any;
    },
  ) {
    return this.notificationJobService.createJob({
      ...data,
      scheduledAt: new Date(data.scheduledAt),
      createdBy: user.id,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all notification jobs' })
  async getJobs(@Query() filters: {
    status?: string;
    messageType?: string;
    page?: number;
    limit?: number;
  }) {
    return this.notificationJobService.getJobs(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification job by ID' })
  async getJobById(@Param('id') id: string) {
    return this.notificationJobService.getJobById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update notification job' })
  async updateJob(
    @Param('id') id: string,
    @Body() data: Partial<{
      messageType: string;
      title: string;
      content: string;
      image: string;
      redirectionLink: string;
      scheduledAt: string;
      language: 'ALL' | 'ENGLISH' | 'HINDI';
      frequency: 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
      userIds?: string[] | null;
      phoneNumbers?: string[];
      filterConditions: any;
      status: string;
    }>,
  ) {
    const updateData: any = { ...data };
    if (data.scheduledAt) {
      updateData.scheduledAt = new Date(data.scheduledAt);
    }
    return this.notificationJobService.updateJob(id, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification job' })
  async deleteJob(@Param('id') id: string) {
    return this.notificationJobService.deleteJob(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Manually execute a notification job' })
  async executeJob(@Param('id') id: string) {
    return this.notificationJobService.executeJob(id);
  }
}
