import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email or mobile number', example: 'user@example.com' })
  @IsString()
  @IsNotEmpty({ message: 'Email or mobile is required' })
  emailOrMobile: string;

  @ApiProperty({ description: 'Password', example: 'password123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

