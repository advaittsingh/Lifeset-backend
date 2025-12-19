import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<any>) {
    this.logger.log(`Processing notification job ${job.id}`);
    // TODO: Implement push notification logic
    // 
    // Note: When sending notifications for event dates (from Post.eventDates),
    // use the title field from each eventDate object as the notification title:
    // 
    // Example:
    // const post = await prisma.post.findUnique({ where: { id: postId } });
    // if (post.eventDates && Array.isArray(post.eventDates)) {
    //   for (const eventDate of post.eventDates) {
    //     await sendNotification({
    //       title: eventDate.title || 'Event Reminder', // Use title from eventDates
    //       message: `Event on ${eventDate.date}`,
    //       ...
    //     });
    //   }
    // }
    return { success: true };
  }
}

