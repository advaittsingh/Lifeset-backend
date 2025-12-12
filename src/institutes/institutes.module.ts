import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { InstitutesController } from './institutes.controller';
import { InstitutesService } from './institutes.service';
import { InstitutesAdminController } from './institutes-admin.controller';
import { InstitutesAdminService } from './institutes-admin.service';

@Module({
  imports: [PrismaModule],
  providers: [InstitutesService, InstitutesAdminService],
  controllers: [InstitutesController, InstitutesAdminController],
  exports: [InstitutesService, InstitutesAdminService],
})
export class InstitutesModule {}

