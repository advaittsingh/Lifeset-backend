import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class RegisterTokenDto {
  @ApiProperty({
    description: 'Push notification token (FCM or Expo). Expo tokens start with "ExponentPushToken[" or "ExpoPushToken["',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Platform: ios or android',
    example: 'ios',
    enum: ['ios', 'android'],
  })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty({
    description: 'Device ID (optional)',
    example: 'device-uuid-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceId?: string;
}
