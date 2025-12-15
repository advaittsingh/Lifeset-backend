import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsObject, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class PrivateFiltersDto {
  @ApiProperty({ description: 'Select college ID', required: false })
  @IsString()
  @IsOptional()
  selectCollege?: string;

  @ApiProperty({ description: 'Select course ID', required: false })
  @IsString()
  @IsOptional()
  selectCourse?: string;

  @ApiProperty({ description: 'Select course category', required: false })
  @IsString()
  @IsOptional()
  selectCourseCategory?: string;

  @ApiProperty({ description: 'Select year', enum: ['1', '2', '3', '4'], required: false })
  @IsString()
  @IsOptional()
  selectYear?: string;
}

class JobMetadataDto {
  @ApiProperty({ description: 'Company name', required: false })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ description: 'Industry', required: false })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiProperty({ description: 'Select role', required: false })
  @IsString()
  @IsOptional()
  selectRole?: string;

  @ApiProperty({ description: 'Location', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'Client to manage', required: false })
  @IsString()
  @IsOptional()
  clientToManage?: string;

  @ApiProperty({ description: 'Working days', required: false })
  @IsString()
  @IsOptional()
  workingDays?: string;

  @ApiProperty({ description: 'Yearly salary (e.g., "500000" or "500000-800000")', required: false })
  @IsString()
  @IsOptional()
  yearlySalary?: string;

  @ApiProperty({ description: 'Salary minimum', required: false })
  @IsNumber()
  @IsOptional()
  salaryMin?: number;

  @ApiProperty({ description: 'Salary maximum', required: false })
  @IsNumber()
  @IsOptional()
  salaryMax?: number;

  @ApiProperty({ description: 'Skills', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiProperty({ description: 'Function', required: false })
  @IsString()
  @IsOptional()
  function?: string;

  @ApiProperty({ description: 'Experience', required: false })
  @IsString()
  @IsOptional()
  experience?: string;

  @ApiProperty({ description: 'Job type', enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'], required: false })
  @IsString()
  @IsOptional()
  jobType?: string;

  @ApiProperty({ description: 'Capacity', required: false })
  @IsString()
  @IsOptional()
  capacity?: string;

  @ApiProperty({ description: 'Work time', required: false })
  @IsString()
  @IsOptional()
  workTime?: string;

  @ApiProperty({ description: 'Perks and benefits', required: false })
  @IsString()
  @IsOptional()
  perksAndBenefits?: string;

  @ApiProperty({ description: 'Candidate qualities', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  candidateQualities?: string[];

  @ApiProperty({ description: 'Is public', required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ description: 'Is private', required: false })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiProperty({ description: 'Private filters', type: PrivateFiltersDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => PrivateFiltersDto)
  @IsOptional()
  privateFilters?: PrivateFiltersDto;
}

export class CreateJobDto {
  @ApiProperty({ description: 'Job title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Job description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Post type', default: 'JOB' })
  @IsString()
  @IsOptional()
  postType?: string;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Images', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ description: 'Job metadata', type: JobMetadataDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => JobMetadataDto)
  @IsOptional()
  metadata?: JobMetadataDto;
}


