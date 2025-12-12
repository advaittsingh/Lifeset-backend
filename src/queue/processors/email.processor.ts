import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<any>) {
    this.logger.log(`Processing email job ${job.id}`);
    // TODO: Implement email sending logic
    // const { to, subject, body } = job.data;
    // await this.emailService.sendEmail(to, subject, body);
    return { success: true };
  }
}

