import { Injectable, UnauthorizedException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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
    email?: string;
    mobile?: string;
    password: string;
    userType: UserType;
  }) {
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
        email: data.email,
        mobile: data.mobile,
        password: hashedPassword,
        userType: data.userType,
      },
    });

    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      userType: user.userType,
    };
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

  async generateOtp(emailOrMobile: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${emailOrMobile}`;
    
    // Store OTP in Redis with 10 minute expiration
    await this.redis.set(key, otp, 600);

    // TODO: Send OTP via SMS/Email queue
    // await this.queueService.addSMSJob({ to: emailOrMobile, otp });

    return { success: true, message: 'OTP sent successfully' };
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

      return this.generateTokens(user);
    } catch (error) {
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

