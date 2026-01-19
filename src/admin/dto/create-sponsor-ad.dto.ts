import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsIn } from 'class-validator';

export class CreateSponsorAdDto {
  @ApiProperty({
    description: 'Sponsor backlink URL',
    example: 'https://example.com',
  })
  @IsString()
  @IsUrl({}, { message: 'sponsorBacklink must be a valid URL' })
  sponsorBacklink: string;

  @ApiProperty({
    description: 'Sponsor ad image URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsUrl({}, { message: 'sponsorAdImage must be a valid URL' })
  sponsorAdImage: string;

  @ApiProperty({
    description: 'Ad status',
    enum: ['active', 'inactive'],
    default: 'inactive',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'], { message: 'status must be either "active" or "inactive"' })
  status?: string;
}
