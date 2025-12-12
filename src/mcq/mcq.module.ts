import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { McqController } from './mcq.controller';
import { McqService } from './mcq.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  providers: [McqService],
  controllers: [McqController],
  exports: [McqService],
})
export class McqModule {}

