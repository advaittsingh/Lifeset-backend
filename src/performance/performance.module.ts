import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  providers: [PerformanceService, BadgesService],
  controllers: [PerformanceController, BadgesController],
  exports: [PerformanceService, BadgesService],
})
export class PerformanceModule {}

