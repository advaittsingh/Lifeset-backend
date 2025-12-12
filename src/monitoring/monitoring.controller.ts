import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserType } from '@/shared';

@ApiTags('Monitoring')
@Controller('admin/monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserType.ADMIN)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // ========== Server Metrics ==========
  @Get('server')
  @ApiOperation({ summary: 'Get server metrics (CPU, memory, disk, uptime)' })
  async getServerMetrics() {
    return this.monitoringService.getServerMetrics();
  }

  @Get('api-latency')
  @ApiOperation({ summary: 'Get API latency metrics' })
  async getApiLatency() {
    return this.monitoringService.getApiLatency();
  }

  @Get('redis')
  @ApiOperation({ summary: 'Get Redis statistics' })
  async getRedisStats() {
    try {
      return await this.monitoringService.getRedisStats();
    } catch (error: any) {
      return {
        connected: false,
        error: `Controller error: ${error?.message || error?.toString() || 'Unknown error'}`,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      };
    }
  }

  @Get('database')
  @ApiOperation({ summary: 'Get database performance metrics' })
  async getDbPerformance() {
    return this.monitoringService.getDbPerformance();
  }

  @Get('queue')
  @ApiOperation({ summary: 'Get queue processing statistics' })
  async getQueueStats() {
    return this.monitoringService.getQueueStats();
  }

  // ========== App Metrics ==========
  @Get('app')
  @ApiOperation({ summary: 'Get app metrics (crashes, feature usage, active users)' })
  async getAppMetrics() {
    return this.monitoringService.getAppMetrics();
  }

  // ========== Web Metrics ==========
  @Get('web')
  @ApiOperation({ summary: 'Get web metrics (CMS activity, admin logs, traffic)' })
  async getWebMetrics() {
    return this.monitoringService.getWebMetrics();
  }

  // ========== User Behavior ==========
  @Get('user-behavior')
  @ApiOperation({ summary: 'Get user behavior analytics' })
  async getUserBehaviorMetrics() {
    return this.monitoringService.getUserBehaviorMetrics();
  }

  // ========== Engagement ==========
  @Get('engagement')
  @ApiOperation({ summary: 'Get engagement metrics' })
  async getEngagementMetrics() {
    return this.monitoringService.getEngagementMetrics();
  }

  // ========== Cache Management ==========
  @Get('cache/stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  async getCacheStats() {
    return this.monitoringService.getCacheStats();
  }

  @Post('cache/clear')
  @ApiOperation({ summary: 'Clear cache (optionally by pattern)' })
  async clearCache(@Body() data: { pattern?: string }) {
    try {
      const result = await this.monitoringService.clearCache(data.pattern);
      return result;
    } catch (error: any) {
      console.error('Clear cache controller error:', error);
      throw new Error(error?.message || 'Failed to clear cache');
    }
  }

  // ========== Error Logs & Crash Reports ==========
  @Get('errors')
  @ApiOperation({ summary: 'Get error logs' })
  async getErrorLogs(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.monitoringService.getErrorLogs(
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0
    );
  }

  @Get('crashes')
  @ApiOperation({ summary: 'Get crash reports' })
  async getCrashReports() {
    return this.monitoringService.getCrashReports();
  }

  // ========== System Health ==========
  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  async getSystemHealth() {
    return this.monitoringService.getSystemHealth();
  }

  // ========== Recovery Actions ==========
  @Post('recovery')
  @ApiOperation({ summary: 'Perform recovery action' })
  async performRecoveryAction(@Body() data: { action: string; params?: Record<string, any> }) {
    return this.monitoringService.performRecoveryAction(data.action, data.params);
  }

  // ========== Alerts ==========
  @Get('alerts')
  @ApiOperation({ summary: 'Get system alerts' })
  async getAlerts() {
    return this.monitoringService.getAlerts();
  }

  // ========== Performance History ==========
  @Get('performance/history')
  @ApiOperation({ summary: 'Get performance metrics history' })
  async getPerformanceHistory(@Query('hours') hours?: string) {
    return this.monitoringService.getPerformanceHistory(hours ? parseInt(hours) : 24);
  }
}

