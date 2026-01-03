import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiProperty({ 
    description: 'Preferred language', 
    example: 'en',
    required: false 
  })
  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @ApiProperty({ 
    description: 'User status - must be one of: school, college, working_professional', 
    example: 'college',
    enum: ['school', 'college', 'working_professional'],
    required: false 
  })
  @IsString()
  @IsOptional()
  @IsIn(['school', 'college', 'working_professional'], {
    message: 'userStatus must be one of: school, college, working_professional'
  })
  userStatus?: 'school' | 'college' | 'working_professional';
}




