import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Validate payload has required fields
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check if token is blacklisted (only if Redis is available)
    // Note: We can't access the raw token here, so we'll check by user ID
    // The token blacklist check should be done at logout time
    try {
      // Try to check blacklist, but don't fail if Redis is unavailable
      const isBlacklisted = await this.redis.exists(`blacklist:user:${payload.sub}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } catch (error) {
      // If Redis check fails, log but continue (Redis is optional)
      // This allows the app to work even if Redis is unavailable
      console.warn('Redis blacklist check failed, continuing without it:', error.message);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      userType: user.userType,
    };
  }
}

