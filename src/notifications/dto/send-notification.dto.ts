import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NotificationPayloadDto {
  @ApiProperty({ description: 'Notification title', example: 'New Update' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification body', example: 'You have a new message' })
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class SendNotificationDto {
  @ApiProperty({ 
    description: 'Array of user IDs to send notification to', 
    example: ['user-id-1', 'user-id-2'],
    type: [String],
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];

  @ApiProperty({ 
    description: 'Notification payload (title and body)', 
    type: NotificationPayloadDto 
  })
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPayloadDto)
  notification: NotificationPayloadDto;

  @ApiProperty({ 
    description: 'Additional data payload (key-value pairs)', 
    example: { type: 'message', id: '123' },
    required: false 
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({ 
    description: 'Redirect URL when user taps the notification', 
    example: 'https://app.example.com/jobs/123',
    required: false 
  })
  @IsString()
  @IsOptional()
  redirectUrl?: string;

  @ApiProperty({ 
    description: 'Image URL to display with notification', 
    example: 'https://example.com/image.jpg',
    required: false 
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
