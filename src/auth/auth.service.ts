import { Injectable, UnauthorizedException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { UserType } from '@/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
    private configService: ConfigService,
  ) {}

  async register(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobile?: string;
    password: string;
    userType: UserType;
  }) {
    try {
      // Validate that at least email or mobile is provided
      if (!data.email && !data.mobile) {
        throw new BadRequestException('Either email or mobile number is required');
      }

      // Check if user exists
      if (data.email) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: data.email },
        });
        if (existingUser) {
          throw new BadRequestException('Email already registered');
        }
      }

      if (data.mobile) {
        const existingUser = await this.prisma.user.findUnique({
          where: { mobile: data.mobile },
        });
        if (existingUser) {
          throw new BadRequestException('Mobile already registered');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: data.email || null,
          mobile: data.mobile || null,
          password: hashedPassword,
          userType: data.userType,
        },
      });

      // If userType is STUDENT and firstName/lastName are provided, create StudentProfile
      if (data.userType === 'STUDENT' && (data.firstName || data.lastName)) {
        await this.prisma.studentProfile.create({
          data: {
            userId: user.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
          },
        });
      }

      // Automatically log the user in after registration by generating tokens
      let tokens;
      try {
        tokens = await this.generateTokens(user);
      } catch (error: any) {
        this.logger.error(`Failed to generate tokens during registration: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to generate authentication tokens');
      }
      
      // Store session (non-blocking - don't fail registration if session creation fails)
      try {
        await this.createSession(user.id, tokens.accessToken, tokens.refreshToken);
      } catch (error: any) {
        this.logger.warn(`Failed to create session for user ${user.id} during registration: ${error.message}. Registration will continue.`);
        // Continue with registration even if session creation fails
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          userType: user.userType,
        },
        ...tokens, // Include access and refresh tokens
      };
    } catch (error: any) {
      // Log the error for debugging
      this.logger.error('Registration failed', {
        error: error.message,
        stack: error.stack,
        email: data.email?.substring(0, 3) + '***',
        mobile: data.mobile?.substring(0, 3) + '***',
      });

      // Re-throw BadRequestException as-is (already has proper message)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle Prisma unique constraint errors
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        if (field === 'email') {
          throw new BadRequestException('Email already registered');
        }
        if (field === 'mobile') {
          throw new BadRequestException('Mobile already registered');
        }
        throw new BadRequestException('User with this information already exists');
      }

      // Handle other database errors
      if (error.code?.startsWith('P')) {
        this.logger.error('Database error during registration', error);
        throw new BadRequestException('Registration failed due to database error. Please try again.');
      }

      // Generic error
      throw new BadRequestException('Registration failed. Please try again.');
    }
  }

  async login(emailOrMobile: string, password: string) {
    try {
      this.logger.log(`Login attempt for: ${emailOrMobile?.substring(0, 3)}***`);
      
      // Validate JWT secrets are configured
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
      
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET is not configured');
        throw new InternalServerErrorException('Server configuration error: JWT_SECRET is missing');
      }
      
      if (!jwtRefreshSecret) {
        this.logger.error('JWT_REFRESH_SECRET is not configured');
        throw new InternalServerErrorException('Server configuration error: JWT_REFRESH_SECRET is missing');
      }
      
      // Check database connection
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch (dbCheckError: any) {
        this.logger.error(`Database connection check failed: ${dbCheckError.message}`, dbCheckError.stack);
        throw new InternalServerErrorException('Database connection failed. Please check DATABASE_URL environment variable.');
      }

      // Find user with proper error handling for database issues
      let user;
      try {
        user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: emailOrMobile },
              { mobile: emailOrMobile },
            ],
          },
        });
      } catch (dbError: any) {
        this.logger.error(`Database error during user lookup: ${dbError.message}`, dbError.stack);
        // Check if it's a connection error
        if (dbError.code === 'P1001' || dbError.message?.includes('connect') || dbError.message?.includes('timeout')) {
          throw new InternalServerErrorException('Database connection failed. Please try again later.');
        }
        throw new InternalServerErrorException('Database error occurred during login');
      }

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user has a password set
      if (!user.password) {
        this.logger.warn(`User ${user.id} does not have a password set`);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Validate password
      let isPasswordValid: boolean;
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } catch (bcryptError: any) {
        this.logger.error(`Password comparison error: ${bcryptError.message}`, bcryptError.stack);
        throw new InternalServerErrorException('Error validating credentials');
      }

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      // Generate tokens
      let tokens;
      try {
        tokens = await this.generateTokens(user);
      } catch (error: any) {
        this.logger.error(`Failed to generate tokens: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to generate authentication tokens');
      }

      // Store session (non-blocking - don't fail login if session creation fails)
      try {
        await this.createSession(user.id, tokens.accessToken, tokens.refreshToken);
      } catch (error: any) {
        this.logger.warn(`Failed to create session for user ${user.id}: ${error.message}. Login will continue.`);
        // Continue with login even if session creation fails
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          userType: user.userType,
        },
        ...tokens,
      };
    } catch (error: any) {
      // Re-throw known exceptions
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      
      // Log unexpected errors with full details
      this.logger.error(`Unexpected error during login: ${error.message}`, error.stack);
      this.logger.error(`Error name: ${error.name}, Error code: ${error.code}`);
      this.logger.error(`Error details: ${JSON.stringify({
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack?.substring(0, 500), // First 500 chars of stack
      })}`);
      
      // Provide more helpful error messages based on error type
      if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('timeout')) {
        throw new InternalServerErrorException('Database connection failed. Please check DATABASE_URL environment variable.');
      }
      
      if (error.message?.includes('JWT') || error.message?.includes('token')) {
        throw new InternalServerErrorException('Authentication service error. Please check JWT_SECRET and JWT_REFRESH_SECRET environment variables.');
      }
      
      throw new InternalServerErrorException('An unexpected error occurred during login. Please try again later.');
    }
  }

  async generateOtp(emailOrMobile: string, apiKey?: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${emailOrMobile}`;
    
    // Store OTP in Redis with 10 minute expiration
    await this.redis.set(key, otp, 600);

    // Determine if it's email or mobile
    const isEmail = emailOrMobile.includes('@');
    const isMobile = /^[0-9]{10,15}$/.test(emailOrMobile.replace(/[^0-9]/g, ''));

    // Get OTP API configuration
    // Priority: provided apiKey > environment variable > default
    const otpApiKey = apiKey || this.configService.get<string>('OTP_API_KEY') || 'f46f0470-602a-45d8-b9b4-c9ccfb0b2201';
    const otpApiUrl = this.configService.get<string>('OTP_API_URL') || 'https://api.msg91.com/api/v5/otp';

    // Log API key source for debugging
    if (apiKey) {
      this.logger.log(`Using API key from request (header/body)`);
    } else if (this.configService.get<string>('OTP_API_KEY')) {
      this.logger.log(`Using API key from environment variable`);
    } else {
      this.logger.warn(`Using default API key - consider setting OTP_API_KEY in environment`);
    }

    try {
      // Send OTP via API
      if (isMobile) {
        // Send SMS OTP
        await this.sendSmsOtp(emailOrMobile, otp, otpApiKey, otpApiUrl);
      } else if (isEmail) {
        // Send Email OTP
        await this.sendEmailOtp(emailOrMobile, otp, otpApiKey, otpApiUrl);
      } else {
        this.logger.warn(`Invalid email or mobile format: ${emailOrMobile}`);
        // Still store OTP for testing purposes
      }

      this.logger.log(`OTP generated and sent to ${emailOrMobile?.substring(0, 3)}***`);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error: any) {
      this.logger.error(`Failed to send OTP: ${error.message}`, error.stack);
      this.logger.error(`OTP Send Error Details: ${JSON.stringify({
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        emailOrMobile: emailOrMobile?.substring(0, 3) + '***',
      })}`);

      // Still return success if OTP is stored (for testing/development)
      // In production, you might want to throw an error here
      return { 
        success: true, 
        message: 'OTP generated (sending may have failed, check logs)',
        debug: process.env.NODE_ENV === 'development' ? { otp, error: error.message } : undefined,
      };
    }
  }

  private async sendSmsOtp(mobile: string, otp: string, apiKey: string, apiUrl: string) {
    try {
      // Clean mobile number (remove non-digits)
      const cleanMobile = mobile.replace(/[^0-9]/g, '');
      
      // Try multiple API formats for compatibility
      const payloads = [
        // Format 1: Standard MSG91 format
        {
          mobile: cleanMobile,
          otp: otp,
          message: `Your LifeSet OTP is ${otp}. Valid for 10 minutes.`,
        },
        // Format 2: Alternative format
        {
          to: cleanMobile,
          otp: otp,
          template_id: 'default',
        },
      ];

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'api-key': apiKey,
      };

      // Try first format
      try {
        const response = await axios.post(
          `${apiUrl}/send`,
          payloads[0],
          { headers }
        );
        this.logger.log(`OTP Send Response: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (error: any) {
        // Try second format if first fails
        this.logger.warn(`First OTP API format failed, trying alternative: ${error.message}`);
        const response = await axios.post(
          `${apiUrl}`,
          { ...payloads[1], apiKey },
          { headers: { 'Content-Type': 'application/json' } }
        );
        this.logger.log(`OTP Send Response (alt): ${JSON.stringify(response.data)}`);
        return response.data;
      }
    } catch (error: any) {
      this.logger.error(`SMS OTP sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async sendEmailOtp(email: string, otp: string, apiKey: string, apiUrl: string) {
    try {
      const payload = {
        email: email,
        otp: otp,
        subject: 'Your LifeSet OTP',
        message: `Your LifeSet OTP is ${otp}. Valid for 10 minutes.`,
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'api-key': apiKey,
      };

      const response = await axios.post(
        `${apiUrl}/email/send`,
        { ...payload, apiKey },
        { headers }
      );

      this.logger.log(`Email OTP Send Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Email OTP sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async verifyOtp(emailOrMobile: string, otp: string) {
    const key = `otp:${emailOrMobile}`;
    const storedOtp = await this.redis.get(key);

    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // Delete OTP after verification
    await this.redis.del(key);

    return { success: true, message: 'OTP verified' };
  }

  async generateTokens(user: any) {
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        mobile: user.mobile,
        userType: user.userType,
      };

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      if (!jwtRefreshSecret) {
        throw new Error('JWT_REFRESH_SECRET is not configured');
      }

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = this.jwtService.sign(payload, {
        secret: jwtRefreshSecret,
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      });

      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Verify refresh token exists in session
      const session = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          refreshToken,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Refresh token not found or expired');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update session with new tokens
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, token: string) {
    // Add token to blacklist
    await this.redis.set(`blacklist:${token}`, '1', 900); // 15 minutes

    // Delete session
    await this.prisma.session.deleteMany({
      where: { userId, token },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  async createSession(userId: string, token: string, refreshToken: string) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await this.prisma.session.create({
        data: {
          userId,
          token,
          refreshToken,
          expiresAt,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create session for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        companyProfile: true,
        collegeProfile: true,
        adminProfile: true,
      },
    });
  }
}

