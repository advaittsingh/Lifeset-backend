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
    // Normalize phone number formats: 9876543210, 919876543210, +919876543210
    let normalizedPhone = emailOrMobile.replace(/[^0-9+]/g, ''); // Remove non-digit/non-plus chars
    
    // Handle different phone formats
    if (normalizedPhone.startsWith('+91')) {
      normalizedPhone = normalizedPhone.substring(3); // Remove +91
    } else if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
      normalizedPhone = normalizedPhone.substring(2); // Remove 91 prefix
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = normalizedPhone.substring(1); // Remove leading 0
    }
    
    // Validate phone number (must be 10 digits for India)
    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      throw new BadRequestException('Invalid phone number format. Expected 10-digit number or formats: 9876543210, 919876543210, +919876543210');
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${normalizedPhone}`;
    
    // Store OTP in Redis with 10 minute expiration
    await this.redis.set(key, otp, 600);

    // Get OTP API configuration
    // Priority: provided apiKey > environment variable > default
    const otpApiKey = apiKey || this.configService.get<string>('OTP_API_KEY') || 'f225edc7-b376-4b23-9ab2-0aa927637f01';
    const otpApiUrl = this.configService.get<string>('OTP_API_URL') || 'http://sms.messageindia.in/v2/sendSMS';

    // Log API key source for debugging
    if (apiKey) {
      this.logger.log(`Using API key from request (header/body)`);
    } else if (this.configService.get<string>('OTP_API_KEY')) {
      this.logger.log(`Using API key from environment variable`);
    } else {
      this.logger.warn(`Using default API key - consider setting OTP_API_KEY in environment`);
    }

    try {
      // Send SMS OTP (phone-only, email OTP removed)
      await this.sendSmsOtp(normalizedPhone, otp, otpApiKey, otpApiUrl);

      this.logger.log(`OTP generated and sent to ${normalizedPhone?.substring(0, 3)}***`);
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
      // Mobile number is already normalized in generateOtp, but ensure it's 10 digits
      const cleanMobile = mobile.replace(/[^0-9]/g, '');
      
      // Ensure it's 10 digits
      if (cleanMobile.length !== 10) {
        throw new Error(`Invalid mobile number format. Expected 10 digits, got ${cleanMobile.length}`);
      }
      
      this.logger.log(`Sending SMS OTP to mobile: ${cleanMobile.substring(0, 3)}***${cleanMobile.slice(-3)}`);
      
      // messageindia.in API format
      // Endpoint: http://sms.messageindia.in/v2/sendSMS
      // Method: GET (query parameters)
      // Parameters: username, message, sendername, smstype, numbers, apikey, peid (optional), templateid (optional)
      
      const username = this.configService.get<string>('SMS_USERNAME') || 'parmaramritesh';
      // Use LYFSET sender name with its DLT template
      const senderName = this.configService.get<string>('SMS_SENDER_NAME') || 'LYFSET';
      const smsType = this.configService.get<string>('SMS_TYPE') || 'TRANS';
      const peid = this.configService.get<string>('SMS_PEID') || '1201159481002695971'; // DLT Principal Entity ID
      // LYFSET template: User Registration OTP 2026
      const templateId = this.configService.get<string>('SMS_TEMPLATE_ID') || '1207176589684893756'; // LYFSET template ID
      
      // Build OTP message
      // Note: When using DLT template (templateid), message must match template body exactly
      // messageindia.in templates use {#var#} placeholder - replace it with actual OTP value
      // LYFSET template format: "Welcome to LifeSet. Your one-time password for registration is: {#var#}. Use this OTP for verification. Regards, Team LifeSet."
      const message = templateId 
        ? `Welcome to LifeSet. Your one-time password for registration is: ${otp}. Use this OTP for verification. Regards, Team LifeSet.`  // Match LYFSET template format
        : `Your OTP for LifeSet is ${otp}. It is valid for 10 minutes.`;
      
      // Log DLT configuration
      if (peid && templateId) {
        this.logger.log(`📋 DLT Configuration: PEID=${peid}, TemplateID=${templateId}`);
      } else {
        this.logger.warn(`⚠️ DLT Parameters Missing: PEID=${!!peid}, TemplateID=${!!templateId}`);
        this.logger.warn(`   SMS may be undelivered. For India, DLT registration is mandatory.`);
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        username: username,
        message: message,
        sendername: senderName,
        smstype: smsType,
        numbers: cleanMobile,
        apikey: apiKey,
      });
      
      // Add optional parameters
      if (peid) {
        params.append('peid', peid);
      }
      if (templateId) {
        params.append('templateid', templateId);
      }
      
      const smsApiUrl = apiUrl.includes('messageindia.in') 
        ? apiUrl 
        : 'http://sms.messageindia.in/v2/sendSMS';
      
      const fullUrl = `${smsApiUrl}?${params.toString()}`;
      
      this.logger.log(`SMS API Request:`, {
        url: `${smsApiUrl}?username=${username}&sendername=${senderName}&smstype=${smsType}&numbers=${cleanMobile.substring(0, 3)}***&apikey=${apiKey.substring(0, 10)}...`,
        mobile: cleanMobile.substring(0, 3) + '***',
        messageLength: message.length,
        hasPeid: !!peid,
        hasTemplateId: !!templateId,
      });

      try {
        // messageindia.in uses GET request
        const response = await axios.get(fullUrl, {
          timeout: 10000, // 10 second timeout
          headers: {
            'Accept': 'application/json',
          },
        });
        
        this.logger.log(`SMS API Response:`, {
          status: response.status,
          data: response.data,
          statusText: response.statusText,
        });
        
        // Check response format (messageindia.in typically returns JSON array or plain text)
        let responseData = response.data;
        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData);
          } catch (e) {
            // If not JSON, treat as plain text response
            responseData = { message: responseData };
          }
        }
        
        // messageindia.in returns array with status objects
        // Format: [{ msg: "...", cost: 0, msgid: "...", status: "error" | "success" }]
        const isArray = Array.isArray(responseData);
        const statusObj = isArray ? responseData[0] : responseData;
        const status = statusObj?.status || (response.status === 200 ? 'success' : 'error');
        const message = statusObj?.msg || statusObj?.message || 'Unknown response';
        const msgId = statusObj?.msgid || '';
        
        // Log success or error
        if (response.status === 200 && status === 'success') {
          this.logger.log(`✅ SMS OTP submitted successfully to ${cleanMobile.substring(0, 3)}***`);
          this.logger.log(`Message ID: ${msgId || 'N/A'}, Cost: ${statusObj?.cost || 'N/A'}`);
          
          // Check delivery status after a short delay (optional - can be done async)
          if (msgId) {
            this.logger.log(`📱 Check delivery status: http://sms.messageindia.in/getDLR?username=${username}&msgid=${msgId}&apikey=${apiKey.substring(0, 10)}...`);
            
            // Check delivery status after 2 seconds
            setTimeout(async () => {
              try {
                const dlrUrl = `http://sms.messageindia.in/getDLR?username=${username}&msgid=${msgId}&apikey=${apiKey}`;
                const dlrResponse = await axios.get(dlrUrl, { timeout: 5000 });
                const dlrData = Array.isArray(dlrResponse.data) ? dlrResponse.data[0] : dlrResponse.data;
                const dlrStatus = dlrData?.dlr_status || 'UNKNOWN';
                
                if (dlrStatus === 'DELIVRD') {
                  this.logger.log(`✅ SMS Delivered: Message ID ${msgId}`);
                } else if (dlrStatus === 'UNDELIV') {
                  this.logger.error(`❌ SMS Undelivered: Message ID ${msgId}`);
                  this.logger.error(`   Possible reasons:`);
                  this.logger.error(`   1. DLT registration required (PEID/Template ID)`);
                  this.logger.error(`   2. Invalid mobile number`);
                  this.logger.error(`   3. Carrier blocking`);
                  this.logger.error(`   4. Mobile number not active`);
                } else {
                  this.logger.warn(`⚠️ SMS Delivery Status: ${dlrStatus} (Message ID: ${msgId})`);
                }
              } catch (dlrError: any) {
                this.logger.warn(`Could not check delivery status: ${dlrError.message}`);
              }
            }, 2000);
          }
        } else {
          const errorMsg = `❌ SMS API Error: ${message}`;
          this.logger.error(errorMsg, {
            status: response.status,
            apiStatus: status,
            responseData: responseData,
            mobile: cleanMobile.substring(0, 3) + '***',
          });
          
          // Throw error if API returned error status
          if (status === 'error' || response.status !== 200) {
            throw new Error(`SMS API Error: ${message}`);
          }
        }
        
        return responseData;
      } catch (error: any) {
        this.logger.error(`❌ SMS API Error:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          mobile: cleanMobile.substring(0, 3) + '***',
        });
        throw error;
      }
    } catch (error: any) {
      this.logger.error(`SMS OTP sending failed: ${error.message}`, {
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        mobile: mobile.substring(0, 3) + '***',
      });
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
    // Normalize phone number (same logic as generateOtp)
    let normalizedPhone = emailOrMobile.replace(/[^0-9+]/g, '');
    if (normalizedPhone.startsWith('+91')) {
      normalizedPhone = normalizedPhone.substring(3);
    } else if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
      normalizedPhone = normalizedPhone.substring(2);
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    
    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      throw new BadRequestException('Invalid phone number format');
    }

    const key = `otp:${normalizedPhone}`;
    const storedOtp = await this.redis.get(key);

    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // Delete OTP after verification
    await this.redis.del(key);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { mobile: normalizedPhone },
      include: {
        studentProfile: true,
      },
    });

    // Track if user was just created (new user)
    let isNewUser = false;
    let userCreated = false;

    // Auto-create user if doesn't exist
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          mobile: normalizedPhone,
          password: '', // No password for OTP-based auth
          userType: 'STUDENT',
          isActive: true,
          isVerified: true,
          studentProfile: {
            create: {
              firstName: '',
              lastName: '',
            },
          },
        },
        include: {
          studentProfile: true,
        },
      });
      isNewUser = true;
      userCreated = true;
      this.logger.log(`Auto-created new user for mobile: ${normalizedPhone.substring(0, 3)}***`);
    } else {
      // Mark user as verified if not already
      if (!user.isVerified) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true },
          include: {
            studentProfile: true,
          },
        });
      }
    }

    // Check if user profile setup is complete
    const studentProfile = user.studentProfile as any;
    const preferredLanguage = studentProfile?.preferredLanguage || null;
    const userStatus = studentProfile?.userStatus || null;
    
    // Robust checks for language and status
    const hasLanguage = preferredLanguage && 
                       typeof preferredLanguage === 'string' && 
                       preferredLanguage.trim().length > 0 &&
                       preferredLanguage.trim() !== 'null' &&
                       preferredLanguage.trim() !== 'undefined';
    
    const hasStatus = userStatus && 
                     typeof userStatus === 'string' && 
                     userStatus.trim().length > 0 &&
                     userStatus.trim() !== 'null' &&
                     userStatus.trim() !== 'undefined';
    
    const profileSetupComplete = hasLanguage && hasStatus;
    
    // Additional check: User created very recently (within last 30 seconds) is also considered new
    const userCreatedRecently = user.createdAt && 
      (Date.now() - new Date(user.createdAt).getTime()) < 30000; // 30 seconds
    
    // User is considered NEW if:
    // 1. User was just created in this request (userCreated = true), OR
    // 2. User was created very recently (within 30 seconds), OR
    // 3. Profile setup is incomplete (missing language or status)
    // Priority: If user was just created, ALWAYS mark as new user
    if (userCreated) {
      isNewUser = true; // Explicitly set - user was just created
      this.logger.log(`✅ User ${user.id} is NEW (just created in this request)`);
    } else if (userCreatedRecently) {
      isNewUser = true; // User created very recently, treat as new
      this.logger.log(`✅ User ${user.id} is NEW (created recently: ${Math.round((Date.now() - new Date(user.createdAt).getTime()) / 1000)}s ago)`);
    } else if (!profileSetupComplete) {
      isNewUser = true; // Treat as new user if profile setup is incomplete
      this.logger.log(`✅ User ${user.id} is NEW (incomplete profile: language=${hasLanguage}, status=${hasStatus})`);
    } else {
      isNewUser = false; // Explicitly set - existing user with complete profile
      this.logger.log(`❌ User ${user.id} is EXISTING (profile complete: language=${preferredLanguage}, status=${userStatus})`);
    }
    
    // Log all detection values for debugging
    this.logger.log(`🔍 New User Detection Debug:`, {
      userId: user.id,
      userCreated,
      userCreatedRecently,
      hasLanguage,
      hasStatus,
      profileSetupComplete,
      preferredLanguage,
      userStatus,
      isNewUser,
      createdAt: user.createdAt,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Return user object and tokens with new user detection flags
    // Flags are included at both root level and data level for maximum compatibility
    const response = {
      success: true,
      // New user detection flags at root level (for easy access)
      isNewUser: isNewUser,
      userCreated: userCreated,
      newUser: isNewUser, // Alias for compatibility
      profileSetupComplete: profileSetupComplete,
      data: {
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          userType: user.userType,
          isActive: user.isActive,
          isVerified: user.isVerified,
          profileImage: user.profileImage,
          studentProfile: studentProfile ? {
            id: studentProfile.id,
            firstName: studentProfile.firstName || '',
            lastName: studentProfile.lastName || '',
            preferredLanguage: preferredLanguage,
            userStatus: userStatus,
            // Include full profile object for profile setup check
            profileSetupComplete: profileSetupComplete,
          } : null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        // New user detection flags (Method 1: Backend response indicators)
        // Also included in data for nested access
        isNewUser: isNewUser,
        userCreated: userCreated,
        newUser: isNewUser, // Alias for compatibility
        // Profile setup status
        profileSetupComplete: profileSetupComplete,
        // Additional detection helpers
        hasPreferredLanguage: hasLanguage,
        hasUserStatus: hasStatus,
        hasStudentProfile: !!studentProfile,
      },
    };
    
    // Log final response for debugging
    this.logger.log(`📤 OTP Verification Response:`, {
      userId: user.id,
      isNewUser: response.isNewUser,
      userCreated: response.userCreated,
      profileSetupComplete: response.profileSetupComplete,
    });
    
    return response;
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
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '90d'), // 90 days for long-term sessions
      });

      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async refreshToken(refreshToken: string) {
    let userId: string | null = null;
    let sessionId: string | null = null;
    
    try {
      // Verify JWT token first
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      userId = payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        this.logger.warn(`Token refresh failed: User ${userId} not found or inactive`);
        // Invalidate all sessions for this user
        if (userId) {
          await this.prisma.session.deleteMany({
            where: { userId },
          });
        }
        throw new UnauthorizedException('INVALID_TOKEN_USER_NOT_FOUND_OR_INACTIVE');
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
        this.logger.warn(`Token refresh failed: Session not found or expired for user ${userId}`);
        // Invalidate all sessions for this user
        await this.prisma.session.deleteMany({
          where: { userId: user.id },
        });
        throw new UnauthorizedException('INVALID_TOKEN_SESSION_NOT_FOUND_OR_EXPIRED');
      }

      sessionId = session.id;

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update session with new tokens - extend session to match refresh token expiration (default: 90 days)
      const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '90d');
      const expirationMs = this.parseExpirationDuration(refreshExpiresIn);
      
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + expirationMs),
        },
      });

      this.logger.log(`✅ Token refresh successful for user ${userId}`);
      return tokens;
    } catch (error: any) {
      // Handle JWT verification errors (expired, invalid signature, etc.)
      if (error.name === 'TokenExpiredError') {
        this.logger.warn(`Token refresh failed: Token expired for user ${userId || 'unknown'}`);
        // Invalidate sessions if we know the user
        if (userId) {
          await this.prisma.session.deleteMany({
            where: { userId },
          });
        }
        throw new UnauthorizedException('INVALID_TOKEN_EXPIRED');
      }
      
      if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
        this.logger.warn(`Token refresh failed: Invalid token format for user ${userId || 'unknown'}`);
        // Invalidate sessions if we know the user
        if (userId) {
          await this.prisma.session.deleteMany({
            where: { userId },
          });
        }
        throw new UnauthorizedException('INVALID_TOKEN_MALFORMED');
      }

      // Re-throw UnauthorizedException with clear error codes
      if (error instanceof UnauthorizedException) {
        this.logger.error(`Token refresh failed: ${error.message}`, {
          userId,
          sessionId,
          errorCode: error.message,
        });
        throw error;
      }

      // Handle any other errors
      this.logger.error(`Token refresh failed: ${error.message}`, {
        userId,
        sessionId,
        errorName: error.name,
        errorStack: error.stack,
      });
      
      // Invalidate sessions if we know the user
      if (userId) {
        try {
          await this.prisma.session.deleteMany({
            where: { userId },
          });
        } catch (deleteError) {
          this.logger.error(`Failed to invalidate sessions for user ${userId}: ${deleteError.message}`);
        }
      }
      
      throw new UnauthorizedException('INVALID_TOKEN_REFRESH_FAILED');
    }
  }

  async validateSession(refreshToken: string) {
    try {
      // Verify JWT token first
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const userId = payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return { valid: false, reason: 'USER_NOT_FOUND_OR_INACTIVE' };
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
        return { valid: false, reason: 'SESSION_NOT_FOUND_OR_EXPIRED' };
      }

      return { 
        valid: true, 
        userId: user.id,
        expiresAt: session.expiresAt,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, reason: 'TOKEN_EXPIRED' };
      }
      
      if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
        return { valid: false, reason: 'INVALID_TOKEN_FORMAT' };
      }

      this.logger.error(`Session validation error: ${error.message}`);
      return { valid: false, reason: 'VALIDATION_ERROR' };
    }
  }

  async logout(userId: string, token: string) {
    try {
      // Add token to blacklist
      await this.redis.set(`blacklist:${token}`, '1', 900); // 15 minutes
    } catch (error) {
      this.logger.warn(`Failed to blacklist token (Redis may be unavailable): ${error.message}`);
      // Continue with logout even if Redis fails
    }

    // Delete session
    await this.prisma.session.deleteMany({
      where: { userId, token },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Parse expiration duration string (e.g., '90d', '30d') and return milliseconds
   */
  private parseExpirationDuration(expiresIn: string): number {
    // Parse duration string (e.g., '90d' = 90 days, '7d' = 7 days)
    const daysMatch = expiresIn.match(/^(\d+)d$/);
    if (daysMatch) {
      return parseInt(daysMatch[1], 10) * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    }
    // Fallback to 90 days if parsing fails
    return 90 * 24 * 60 * 60 * 1000;
  }

  async createSession(userId: string, token: string, refreshToken: string) {
    try {
      // Set session expiration to match refresh token expiration (default: 90 days)
      const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '90d');
      const expirationMs = this.parseExpirationDuration(refreshExpiresIn);
      
      const expiresAt = new Date(Date.now() + expirationMs);

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
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: true,
          companyProfile: true,
          collegeProfile: true,
          adminProfile: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Error validating user ${userId}:`, error);
      throw new InternalServerErrorException('Failed to validate user. Please try again.');
    }
  }
}

