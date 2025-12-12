import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('adImpressions')
export class AdImpressionProcessor extends WorkerHost {
  private readonly logger = new Logger(AdImpressionProcessor.name);

  async process(job: Job<any>) {
    this.logger.log(`Processing ad impression job ${job.id}`);
    // TODO: Implement ad impression tracking
    return { success: true };
  }
}

