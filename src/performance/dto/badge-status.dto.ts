import { ApiProperty } from '@nestjs/swagger';

export class BadgeStatusResponseDto {
  @ApiProperty({ 
    description: 'Current badge tier', 
    example: 'elite',
    enum: ['rookie', 'explorer', 'adventurer', 'elite', 'champion', 'legend'],
    nullable: true
  })
  currentBadge: string | null;

  @ApiProperty({ description: 'Number of active days in last 6 months', example: 125 })
  daysActive: number;
}

