import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PersonalityController } from './personality.controller';
import { PersonalityService } from './personality.service';

@Module({
  imports: [PrismaModule],
  providers: [PersonalityService],
  controllers: [PersonalityController],
  exports: [PersonalityService],
})
export class PersonalityModule {}

