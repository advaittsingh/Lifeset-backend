import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<any>) {
    this.logger.log(`Processing notification job ${job.id}`);
    // TODO: Implement push notification logic
    return { success: true };
  }
}

