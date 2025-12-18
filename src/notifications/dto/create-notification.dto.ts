import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, ValidateIf, Matches } from 'class-validator';
import { NotificationType } from '@/shared';
import { IsValidUrl, IsValidImageUrlOrBase64 } from '../validators/notification.validators';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Notification title', example: 'New Job Opportunity' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message', example: 'A new job matching your profile is available' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ 
    description: 'Notification type', 
    enum: NotificationType,
    example: NotificationType.JOB 
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ 
    description: 'Redirect URL when user taps the notification (max 500 chars, must be valid URL format)', 
    required: false,
    example: 'https://app.example.com/jobs/123',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Redirect URL must be 500 characters or less' })
  @ValidateIf((o) => o.redirectUrl !== undefined && o.redirectUrl !== null && o.redirectUrl !== '')
  @IsValidUrl({ message: 'Redirect URL must be a valid URL format' })
  redirectUrl?: string;

  @ApiProperty({ 
    description: 'Image URL or base64-encoded image to display with notification. Accepts http/https URLs or data URI (base64)', 
    required: false,
    example: 'https://example.com/image.jpg' 
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.image !== undefined && o.image !== null && o.image !== '')
  @IsValidImageUrlOrBase64({ message: 'Image must be a valid URL (http/https) or base64 data URI' })
  image?: string;
}




