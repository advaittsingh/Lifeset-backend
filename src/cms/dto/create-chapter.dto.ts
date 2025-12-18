import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, IsInt, Min } from 'class-validator';

export class CreateChapterDto {
  @ApiProperty({ description: 'Chapter name', example: 'Introduction to Physics' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Chapter description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Sub-category ID (UUID of the parent sub-category)', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  subCategoryId: string;

  @ApiProperty({ description: 'Order/position of chapter within sub-category', example: 1, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiProperty({ description: 'Is chapter active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}



