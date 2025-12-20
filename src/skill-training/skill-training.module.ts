import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SkillTrainingController } from './skill-training.controller';
import { SkillTrainingService } from './skill-training.service';

@Module({
  imports: [PrismaModule],
  controllers: [SkillTrainingController],
  providers: [SkillTrainingService],
  exports: [SkillTrainingService],
})
export class SkillTrainingModule {}

