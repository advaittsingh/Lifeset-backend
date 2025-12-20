import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUUID, IsInt, Min } from 'class-validator';

export class UpdateChapterDto {
  @ApiProperty({ description: 'Chapter name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Chapter description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Sub-category ID (UUID of the parent sub-category)', required: false })
  @IsUUID()
  @IsOptional()
  subCategoryId?: string;

  @ApiProperty({ description: 'Order/position of chapter within sub-category', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiProperty({ description: 'Is chapter active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}








