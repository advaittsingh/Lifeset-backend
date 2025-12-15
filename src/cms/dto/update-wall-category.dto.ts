import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUUID, ValidateIf } from 'class-validator';

export class UpdateWallCategoryDto {
  @ApiProperty({ description: 'Category name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category for (e.g., Posts, Events, Jobs)', required: false })
  @IsString()
  @IsOptional()
  categoryFor?: string;

  @ApiProperty({ description: 'Parent category ID (null for top-level, UUID for sub-category)', required: false })
  @ValidateIf((o) => o.parentCategoryId !== undefined && o.parentCategoryId !== null && o.parentCategoryId !== '')
  @IsUUID()
  @IsOptional()
  parentCategoryId?: string | null;

  @ApiProperty({ description: 'Is category active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

