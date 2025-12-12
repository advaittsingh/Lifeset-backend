import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [PrismaModule, QueueModule],
  providers: [AdsService],
  controllers: [AdsController],
  exports: [AdsService],
})
export class AdsModule {}

