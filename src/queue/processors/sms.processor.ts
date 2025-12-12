import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('sms')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  async process(job: Job<any>) {
    this.logger.log(`Processing SMS job ${job.id}`);
    // TODO: Implement SMS sending logic
    return { success: true };
  }
}

