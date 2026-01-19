import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { NotificationType } from '@/shared';

export class CreateNotificationMobileDto {
  @ApiProperty({ description: 'Notification title', example: 'New Message' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message', example: 'You have a new message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ 
    description: 'Notification type', 
    enum: NotificationType,
    example: NotificationType.CHAT 
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ 
    description: 'Additional data payload (for push notification, not stored in DB)', 
    example: { userId: '123', messageId: '456' },
    required: false 
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiProperty({ 
    description: 'Whether notification is already read', 
    default: false,
    required: false 
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
