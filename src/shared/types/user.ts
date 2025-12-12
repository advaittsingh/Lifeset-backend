export enum UserType {
  STUDENT = 'STUDENT',
  COMPANY = 'COMPANY',
  COLLEGE = 'COLLEGE',
  ADMIN = 'ADMIN',
  AMS = 'AMS',
  FACULTY = 'FACULTY',
}

export interface CreateUserDto {
  email?: string;
  mobile?: string;
  password: string;
  userType: UserType;
}

export interface LoginDto {
  email?: string;
  mobile?: string;
  password: string;
}

export interface OtpDto {
  mobile?: string;
  email?: string;
  otp: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface UpdateEducationDto {
  education10th?: any;
  education12th?: any;
  graduation?: any;
  postGraduation?: any;
}

export interface UpdateSkillsDto {
  technicalSkills?: string[];
  softSkills?: string[];
}

