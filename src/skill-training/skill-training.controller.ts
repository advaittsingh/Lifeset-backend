import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkillTrainingService } from './skill-training.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Skill Training')
@Controller('skill-training')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SkillTrainingController {
  constructor(private readonly skillTrainingService: SkillTrainingService) {}

  @Get('recommended')
  @ApiOperation({ summary: 'Get 2 recommended skill training cards for daily digest' })
  async getRecommended(@CurrentUser() user: any) {
    return this.skillTrainingService.getRecommendedCards(user.id);
  }
}



