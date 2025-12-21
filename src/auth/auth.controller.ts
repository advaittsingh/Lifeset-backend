import { Controller, Post, Body, Get, UseGuards, Request, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto } from './dto/otp.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() data: LoginDto) {
    return this.authService.login(data.emailOrMobile, data.password);
  }

  @Public()
  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP' })
  @ApiHeader({ name: 'LYFSET', required: false, description: 'OTP API Key (optional, can also be in body)' })
  async sendOtp(
    @Body() data: SendOtpDto,
    @Headers('LYFSET') apiKeyFromHeader?: string,
    @Headers('x-api-key') apiKeyAlt?: string,
    @Headers('api-key') apiKeyAlt2?: string,
    @Request() req?: any,
  ) {
    // Get API key from multiple sources for compatibility
    // Priority: LYFSET header > x-api-key header > api-key header > body > undefined
    const apiKey = 
      apiKeyFromHeader || 
      apiKeyAlt || 
      apiKeyAlt2 ||
      (data as any).apiKey || 
      req?.body?.apiKey || 
      undefined;
    
    return this.authService.generateOtp(data.emailOrMobile, apiKey);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP' })
  async verifyOtp(@Body() data: VerifyOtpDto) {
    return this.authService.verifyOtp(data.emailOrMobile, data.otp);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() data: RefreshTokenDto) {
    try {
      const tokens = await this.authService.refreshToken(data.refreshToken);
      return {
        success: true,
        data: tokens,
      };
    } catch (error: any) {
      // Re-throw to let the exception filter handle it
      // But ensure the error message is preserved
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(@CurrentUser() user: any, @Request() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.logout(user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async getMe(@CurrentUser() user: any) {
    return this.authService.validateUser(user.id);
  }
}

