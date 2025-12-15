import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches } from 'class-validator';

export class CreateInstituteDto {
  // Faculty Head Details
  @ApiProperty({ description: 'Faculty head name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  facultyHeadName: string;

  @ApiProperty({ description: 'Faculty head email', example: 'faculty@institute.com' })
  @IsEmail()
  @IsNotEmpty()
  facultyHeadEmail: string;

  @ApiProperty({ description: 'Faculty head contact number', example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  facultyHeadContact: string;

  @ApiProperty({ description: 'Faculty head status', example: 'Active', required: false })
  @IsString()
  @IsOptional()
  facultyHeadStatus?: string;

  // Institute Details
  @ApiProperty({ description: 'Institute name', example: 'ABC College' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Institute type', example: 'Private', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'City', example: 'New Delhi' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State', example: 'Delhi' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'District', example: 'South Delhi', required: false })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({ description: 'Pincode', example: '110025', required: false })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiProperty({ description: 'Address', example: '123 Main Street', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ description: 'Institute email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Institute phone number', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Institute description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Institute logo URL', required: false })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiProperty({ description: 'Is institute active', example: true, required: false })
  @IsOptional()
  isActive?: boolean;
}

