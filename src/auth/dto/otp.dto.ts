import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ description: 'Email or mobile number', example: 'user@example.com' })
  @IsString()
  @IsNotEmpty({ message: 'Email or mobile is required' })
  emailOrMobile: string;

  @ApiProperty({ description: 'OTP API Key (optional, can also be sent in headers)', example: 'f225edc7-b376-4b23-9ab2-0aa927637f01', required: false })
  @IsString()
  @IsOptional()
  apiKey?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Email or mobile number', example: 'user@example.com' })
  @IsString()
  @IsNotEmpty({ message: 'Email or mobile is required' })
  emailOrMobile: string;

  @ApiProperty({ description: 'OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  otp: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}

