import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { UserType } from '@/shared';

export class RegisterDto {
  @ApiProperty({ description: 'Email address', required: false, example: 'user@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Mobile number', required: false, example: '+1234567890' })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiProperty({ description: 'Password', example: 'password123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({ description: 'User type', enum: UserType, example: UserType.STUDENT })
  @IsEnum(UserType, { message: 'Invalid user type' })
  @IsNotEmpty({ message: 'User type is required' })
  userType: UserType;
}

