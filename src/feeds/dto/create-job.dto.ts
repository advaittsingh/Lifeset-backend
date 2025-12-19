import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsNumber, IsEnum } from 'class-validator';

export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  FREELANCE = 'FREELANCE',
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

  // Job-specific fields (moved from metadata)
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

  @ApiProperty({ description: 'Job location', required: false })
  @IsString()
  @IsOptional()
  jobLocation?: string;

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

  @ApiProperty({ description: 'Job function', required: false })
  @IsString()
  @IsOptional()
  jobFunction?: string;

  @ApiProperty({ description: 'Experience (can be string or number)', required: false })
  @IsOptional()
  experience?: string | number;

  @ApiProperty({ description: 'Job type', enum: JobType, required: false })
  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;

  @ApiProperty({ description: 'Capacity (can be string or number)', required: false })
  @IsOptional()
  capacity?: string | number;

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

  // Private filters (flattened from nested object)
  @ApiProperty({ description: 'Select college ID (for private jobs)', required: false })
  @IsString()
  @IsOptional()
  privateFiltersCollege?: string;

  @ApiProperty({ description: 'Select course ID (for private jobs)', required: false })
  @IsString()
  @IsOptional()
  privateFiltersCourse?: string;

  @ApiProperty({ description: 'Select course category (for private jobs)', required: false })
  @IsString()
  @IsOptional()
  privateFiltersCourseCategory?: string;

  @ApiProperty({ description: 'Select year (for private jobs)', enum: ['1', '2', '3', '4'], required: false })
  @IsString()
  @IsOptional()
  privateFiltersYear?: string;
}




