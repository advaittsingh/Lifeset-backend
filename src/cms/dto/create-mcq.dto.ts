import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min, Max, IsBoolean } from 'class-validator';
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

export class CreateMcqDto {
  @ApiProperty({ description: 'Question text' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ 
    description: 'Answer options - can be array of strings or array of objects with text and isCorrect',
    example: '["Option 1", "Option 2", "Option 3", "Option 4"] or [{"text": "Option 1", "isCorrect": false}, ...]'
  })
  @IsArray()
  options: any[]; // Flexible to accept both string arrays and object arrays

  @ApiProperty({ description: 'Correct answer index (0-based)' })
  @IsNumber()
  @Min(0)
  correctAnswer: number;

  @ApiProperty({ description: 'Category ID (required)' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

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

  // MCQ-specific fields (moved from metadata)
  @ApiProperty({ description: 'Category name (denormalized)', required: false })
  @IsString()
  @IsOptional()
  mcqCategory?: string;

  @ApiProperty({ description: 'Sub category name', required: false })
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiProperty({ description: 'Sub category ID', required: false })
  @IsString()
  @IsOptional()
  subCategoryId?: string;

  @ApiProperty({ description: 'Chapter ID', required: false })
  @IsString()
  @IsOptional()
  chapterId?: string;

  @ApiProperty({ description: 'Section', required: false })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ description: 'Question image URL', required: false })
  @IsString()
  @IsOptional()
  questionImage?: string;

  @ApiProperty({ description: 'Explanation image URL', required: false })
  @IsString()
  @IsOptional()
  explanationImage?: string;

  @ApiProperty({ description: 'Detailed solution/explanation', required: false })
  @IsString()
  @IsOptional()
  solution?: string;

  @ApiProperty({ description: 'Language', enum: ['ENGLISH', 'HINDI'], required: false, default: 'ENGLISH' })
  @IsString()
  @IsOptional()
  language?: string;
}

