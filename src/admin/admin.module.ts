import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CmsModule } from '../cms/cms.module';

@Module({
  imports: [PrismaModule, CmsModule],
  controllers: [AdminController],
})
export class AdminModule {}

