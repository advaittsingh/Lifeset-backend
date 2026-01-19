import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateSpecialisationDto {
  @ApiProperty({ description: 'Specialisation name', example: 'Computer Science Engineering' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Specialisation description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Course Category ID (required)', example: 'uuid-here' })
  @IsString()
  @IsNotEmpty()
  courseCategoryId: string;

  @ApiProperty({ description: 'Awarded ID (optional)', example: 'uuid-here', required: false })
  @IsString()
  @IsOptional()
  awardedId?: string;

  @ApiProperty({ description: 'Main Category (optional)', example: 'Engineering', required: false })
  @IsString()
  @IsOptional()
  mainCategory?: string;

  @ApiProperty({ description: 'Is specialisation active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
