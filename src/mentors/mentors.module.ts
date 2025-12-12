import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MentorsController } from './mentors.controller';
import { MentorsService } from './mentors.service';

@Module({
  imports: [PrismaModule],
  providers: [MentorsService],
  controllers: [MentorsController],
  exports: [MentorsService],
})
export class MentorsModule {}

