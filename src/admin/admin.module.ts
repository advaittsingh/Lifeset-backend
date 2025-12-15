import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CmsModule } from '../cms/cms.module';
import { FileModule } from '../file/file.module';

@Module({
  imports: [PrismaModule, CmsModule, FileModule],
  controllers: [AdminController],
})
export class AdminModule {}

