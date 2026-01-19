import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSpecialisationDto {
  @ApiProperty({ description: 'Specialisation name', example: 'Computer Science Engineering', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Specialisation description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Course Category ID', example: 'uuid-here', required: false })
  @IsString()
  @IsOptional()
  courseCategoryId?: string;

  @ApiProperty({ description: 'Awarded ID', example: 'uuid-here', required: false })
  @IsString()
  @IsOptional()
  awardedId?: string;

  @ApiProperty({ description: 'Main Category', example: 'Engineering', required: false })
  @IsString()
  @IsOptional()
  mainCategory?: string;

  @ApiProperty({ description: 'Is specialisation active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
