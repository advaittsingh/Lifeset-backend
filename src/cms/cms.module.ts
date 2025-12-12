import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { CmsAdminController } from './cms-admin.controller';
import { CmsAdminService } from './cms-admin.service';

@Module({
  imports: [PrismaModule],
  providers: [CmsService, CmsAdminService],
  controllers: [CmsController, CmsAdminController],
  exports: [CmsService, CmsAdminService],
})
export class CmsModule {}

