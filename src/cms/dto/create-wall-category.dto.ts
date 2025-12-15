import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, ValidateIf } from 'class-validator';

export class CreateWallCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Current Affairs' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category for (e.g., Posts, Events, Jobs)', example: 'Posts', required: false })
  @IsString()
  @IsOptional()
  categoryFor?: string;

  @ApiProperty({ description: 'Parent category ID (null for top-level, UUID for sub-category)', example: null, required: false })
  @ValidateIf((o) => o.parentCategoryId !== undefined && o.parentCategoryId !== null && o.parentCategoryId !== '')
  @IsUUID()
  @IsOptional()
  parentCategoryId?: string | null;

  @ApiProperty({ description: 'Is category active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

