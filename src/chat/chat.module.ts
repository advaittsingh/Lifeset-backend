import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}

