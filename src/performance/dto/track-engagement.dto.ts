import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export enum EngagementType {
  CARD_VIEW = 'CARD_VIEW',
  MCQ_ATTEMPT = 'MCQ_ATTEMPT',
}

export enum CardType {
  CURRENT_AFFAIRS = 'CURRENT_AFFAIRS',
  GENERAL_KNOWLEDGE = 'GENERAL_KNOWLEDGE',
  MCQ = 'MCQ',
  PERSONALITY = 'PERSONALITY',
  SKILL_TRAINING = 'SKILL_TRAINING',
}

export class TrackEngagementDto {
  @ApiProperty({ description: 'Card ID (UUID)', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  cardId: string;

  @ApiProperty({ description: 'Duration in seconds (for CARD_VIEW)', example: 25, required: false })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({ description: 'Engagement type', enum: EngagementType, example: 'CARD_VIEW' })
  @IsEnum(EngagementType)
  @IsNotEmpty()
  type: EngagementType;

  @ApiProperty({ description: 'Date in YYYY-MM-DD format', example: '2024-01-15', required: false })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ 
    description: 'For CARD_VIEW: true if duration >= 20, For MCQ_ATTEMPT: true/false (isCorrect)', 
    example: true 
  })
  @IsBoolean()
  @IsNotEmpty()
  isComplete: boolean;

  @ApiProperty({ description: 'Card type', enum: CardType, example: 'CURRENT_AFFAIRS', required: false })
  @IsEnum(CardType)
  @IsOptional()
  cardType?: CardType;
}




