import { ApiProperty } from '@nestjs/swagger';

export class DayStatusDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Whether user was present on this day', example: true })
  isPresent: boolean;

  @ApiProperty({ description: 'Whether day was completed (same as isPresent)', example: true })
  completed: boolean;

  @ApiProperty({ description: 'Number of cards viewed for 20+ seconds', example: 3 })
  cardViewCount: number;

  @ApiProperty({ description: 'Number of MCQ attempts', example: 5 })
  mcqAttemptCount: number;

  @ApiProperty({ description: 'MCQ accuracy percentage', example: 80.0 })
  mcqAccuracy: number;
}

export class WeeklyMeterResponseDto {
  @ApiProperty({ description: 'Number of days marked as "Present" in last 7 days (0-7)', example: 5 })
  daysCompleted: number;

  @ApiProperty({ description: 'Array of last 7 days with their status', type: [DayStatusDto] })
  days: DayStatusDto[];
}


