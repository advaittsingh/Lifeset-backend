import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NotificationJobService } from './notification-job.service';

@Injectable()
export class NotificationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(private notificationJobService: NotificationJobService) {}

  onModuleInit() {
    this.logger.log('🚀 Notification Scheduler Service initialized');
    // Run immediately on startup, then every minute
    this.checkAndExecuteJobs();
    this.schedulerInterval = setInterval(() => {
      this.checkAndExecuteJobs();
    }, 60000); // Check every minute
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
  }

  // Run every minute to check for jobs that need to be executed
  async checkAndExecuteJobs() {
    try {
      const pendingJobs = await this.notificationJobService.getPendingJobs();
      
      if (pendingJobs.length === 0) {
        return;
      }

      this.logger.log(`📋 Found ${pendingJobs.length} pending notification jobs`);

      for (const job of pendingJobs) {
        try {
          const now = new Date();
          const shouldExecute = 
            (job.scheduledAt <= now && job.status === 'PENDING') ||
            (job.nextSendAt && job.nextSendAt <= now && job.status === 'ACTIVE');

          if (shouldExecute) {
            this.logger.log(`⏰ Executing notification job ${job.id} (${job.title})`);
            await this.notificationJobService.executeJob(job.id);
          }
        } catch (error: any) {
          this.logger.error(`❌ Error executing job ${job.id}: ${error.message}`, error.stack);
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Error in notification scheduler: ${error.message}`, error.stack);
    }
  }
}
