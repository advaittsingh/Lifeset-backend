import { Module } from '@nestjs/common';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CmsModule } from '../cms/cms.module';

@Module({
  imports: [PrismaModule, AnalyticsModule, CmsModule],
  controllers: [FeedsController],
  providers: [FeedsService],
  exports: [FeedsService],
})
export class FeedsModule {}

