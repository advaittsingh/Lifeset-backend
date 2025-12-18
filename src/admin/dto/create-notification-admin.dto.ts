import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '@/shared';
import { CreateNotificationDto } from '../../notifications/dto/create-notification.dto';

class NotificationFiltersDto {
  @ApiProperty({ description: 'Filter by user type', required: false })
  @IsString()
  @IsOptional()
  userType?: string;

  @ApiProperty({ description: 'Filter by college ID', required: false })
  @IsString()
  @IsOptional()
  collegeId?: string;

  @ApiProperty({ description: 'Filter by college profile ID', required: false })
  @IsString()
  @IsOptional()
  collegeProfileId?: string;

  @ApiProperty({ description: 'Filter by course ID', required: false })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiProperty({ description: 'Filter by city', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'Filter by state', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Filter by active status', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Filter by verified status', required: false })
  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @ApiProperty({ description: 'Filter by registration date from (ISO string)', required: false })
  @IsString()
  @IsOptional()
  registrationDateFrom?: string;

  @ApiProperty({ description: 'Filter by registration date to (ISO string)', required: false })
  @IsString()
  @IsOptional()
  registrationDateTo?: string;
}

export class CreateNotificationAdminDto extends CreateNotificationDto {
  @ApiProperty({ description: 'Send to specific user ID', required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Send to all users matching filters', required: false })
  @IsBoolean()
  @IsOptional()
  sendToAll?: boolean;

  @ApiProperty({ description: 'Filters for sending to multiple users', type: NotificationFiltersDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationFiltersDto)
  @IsOptional()
  filters?: NotificationFiltersDto;
}



