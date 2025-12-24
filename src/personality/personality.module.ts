import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { FileModule } from '../file/file.module';
import { PersonalityController } from './personality.controller';
import { PersonalityService } from './personality.service';

@Module({
  imports: [PrismaModule, FileModule],
  providers: [PersonalityService],
  controllers: [PersonalityController],
  exports: [PersonalityService],
})
export class PersonalityModule {}

