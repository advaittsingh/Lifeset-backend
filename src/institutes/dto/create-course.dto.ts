import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ description: 'Course name', example: 'Bachelor of Computer Science' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Course code', example: 'BCS001', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Course category ID', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Specialisation ID', required: false })
  @IsString()
  @IsOptional()
  specialisationId?: string;

  @ApiProperty({ description: 'Awarded ID (optional, can be derived from specialisation)', required: false })
  @IsString()
  @IsOptional()
  awardedId?: string;

  @ApiProperty({ description: 'Affiliation ID (optional, redundant with institute ID in path)', required: false })
  @IsString()
  @IsOptional()
  affiliationId?: string;

  @ApiProperty({ description: 'Course section', example: 'A', required: false })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({ description: 'Course mode', example: 'FULL_TIME', required: false })
  @IsString()
  @IsOptional()
  courseMode?: string;

  @ApiProperty({ description: 'Course level', example: 'DIPLOMA', required: false })
  @IsString()
  @IsOptional()
  level?: string;

  @ApiProperty({ description: 'Course duration', example: '3 years', required: false })
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiProperty({ description: 'Course description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Course fees', required: false })
  @IsNumber()
  @IsOptional()
  fees?: number;

  @ApiProperty({ description: 'Eligibility criteria', required: false })
  @IsString()
  @IsOptional()
  eligibility?: string;

  @ApiProperty({ description: 'Is course active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}












