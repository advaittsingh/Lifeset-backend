import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, ValidateNested, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class McqOptionDto {
  @ApiProperty({ description: 'Option text' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'Is correct answer' })
  @IsBoolean()
  isCorrect: boolean;
}

class McqMetadataDto {
  @ApiProperty({ description: 'Article ID', required: false })
  @IsString()
  @IsOptional()
  articleId?: string;

  @ApiProperty({ description: 'Category', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Sub category', required: false })
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiProperty({ description: 'Section', required: false })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsString()
  @IsOptional()
  country?: string;
}

export class CreateMcqDto {
  @ApiProperty({ description: 'Question text' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Answer options', type: [McqOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McqOptionDto)
  options: McqOptionDto[];

  @ApiProperty({ description: 'Correct answer index (0-based)' })
  @IsNumber()
  @Min(0)
  @Max(3)
  correctAnswer: number;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Explanation', required: false })
  @IsString()
  @IsOptional()
  explanation?: string;

  @ApiProperty({ description: 'Article ID for linking', required: false })
  @IsString()
  @IsOptional()
  articleId?: string;

  @ApiProperty({ description: 'Difficulty level', enum: ['easy', 'medium', 'hard'], required: false })
  @IsString()
  @IsOptional()
  difficulty?: string;

  @ApiProperty({ description: 'Tags', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'MCQ metadata', type: McqMetadataDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => McqMetadataDto)
  @IsOptional()
  metadata?: McqMetadataDto;
}

