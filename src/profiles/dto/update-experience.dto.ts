import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsArray, ValidateNested, IsNotEmpty, ValidateIf, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ExperienceItemDto {
  @ApiProperty({ 
    description: 'Company name', 
    example: 'Google',
    required: true 
  })
  @IsString()
  @IsNotEmpty({ message: 'companyName is required' })
  companyName: string;

  @ApiProperty({ 
    description: 'Location', 
    example: 'Bangalore, India',
    required: true 
  })
  @IsString()
  @IsNotEmpty({ message: 'location is required' })
  location: string;

  @ApiProperty({ 
    description: 'Department', 
    example: 'Engineering',
    required: true 
  })
  @IsString()
  @IsNotEmpty({ message: 'department is required' })
  department: string;

  @ApiProperty({ 
    description: 'Designation/Job title', 
    example: 'Software Engineer',
    required: true 
  })
  @IsString()
  @IsNotEmpty({ message: 'designation is required' })
  designation: string;

  @ApiProperty({ 
    description: 'Start date in MM/YYYY format', 
    example: '01/2020',
    required: true 
  })
  @IsString()
  @IsNotEmpty({ message: 'startMonthYear is required' })
  @Matches(/^(0[1-9]|1[0-2])\/\d{4}$/, {
    message: 'startMonthYear must be in MM/YYYY format (e.g., 01/2020)'
  })
  startMonthYear: string;

  @ApiProperty({ 
    description: 'End date in MM/YYYY format (required only when currentlyWorking is false)', 
    example: '12/2022',
    required: false 
  })
  @ValidateIf((o) => !o.currentlyWorking)
  @IsString()
  @IsNotEmpty({ message: 'endMonthYear is required when currentlyWorking is false' })
  @Matches(/^(0[1-9]|1[0-2])\/\d{4}$/, {
    message: 'endMonthYear must be in MM/YYYY format (e.g., 12/2022)'
  })
  endMonthYear?: string;

  @ApiProperty({ 
    description: 'About the role', 
    example: 'Worked on developing scalable web applications',
    required: true 
  })
  @IsString()
  @IsNotEmpty({ message: 'aboutRole is required' })
  aboutRole: string;

  @ApiProperty({ 
    description: 'Whether currently working in this role', 
    example: true,
    required: true 
  })
  @IsBoolean()
  currentlyWorking: boolean;
}

export class UpdateExperienceDto {
  @ApiProperty({ 
    description: 'Array of experience entries. The entire array will replace existing experiences.',
    type: [ExperienceItemDto],
    required: true 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceItemDto)
  experience: ExperienceItemDto[];
}

