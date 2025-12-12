import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let cachedApp: express.Application;

async function createApp(): Promise<express.Application> {
  if (cachedApp) {
    return cachedApp;
  }

  try {
    console.log('Initializing NestJS application...');
    console.log('Environment check:', {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasRedisHost: !!process.env.REDIS_HOST,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });

    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: ['error', 'warn', 'log'],
      },
    );

    // Security
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      }),
    );
    app.use(compression());

    // CORS - Configure allowed origins
    // CORS_ORIGIN can be:
    // - Comma-separated list: "https://admin.domain.com,https://admin-project.vercel.app"
    // - "*" for all origins (development only)
    // - Empty/undefined: defaults to allow all (for flexibility)
    const corsOriginEnv = process.env.CORS_ORIGIN;
    let corsOrigins: string[] | boolean = true; // Default: allow all
    
    if (corsOriginEnv) {
      if (corsOriginEnv === '*') {
        corsOrigins = true; // Allow all origins
      } else {
        corsOrigins = corsOriginEnv.split(',').map(origin => origin.trim());
      }
    }
    
    // In production, it's recommended to set CORS_ORIGIN explicitly
    // Example: CORS_ORIGIN=https://admin.yourdomain.com,https://admin-project.vercel.app
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Global prefix - remove /api since Vercel routing already handles it
    const apiPrefix = process.env.API_PREFIX || '/v1';
    app.setGlobalPrefix(apiPrefix);

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global exception filter
    app.useGlobalFilters(new HttpExceptionFilter());

    // Global interceptors
    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new TransformInterceptor(),
    );

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('LifeSet Platform API')
      .setDescription('LifeSet Platform API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

    console.log('Initializing application...');
    await app.init();
    console.log('Application initialized successfully');
    cachedApp = expressApp;
    return cachedApp;
  } catch (error: any) {
    console.error('Error creating NestJS app:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    });
    throw error;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    const app = await createApp();
    app(req, res);
  } catch (error: any) {
    console.error('Failed to initialize app:', error);
    
    // Provide more detailed error information
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack;
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    
    // Log full error details
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error?.name,
      code: error?.code,
    });
    
    // Check for common issues
    let userMessage = 'A server error has occurred';
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('database')) {
      userMessage = 'Database configuration error. Please check DATABASE_URL environment variable.';
    } else if (errorMessage.includes('JWT_SECRET') || errorMessage.includes('JWT')) {
      userMessage = 'Authentication configuration error. Please check JWT_SECRET environment variable.';
    } else if (errorMessage.includes('Redis') || errorMessage.includes('REDIS')) {
      userMessage = 'Redis connection error. The application will continue but some features may be limited.';
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: userMessage,
        details: isDevelopment ? {
          originalError: errorMessage,
          stack: errorStack,
          hint: 'Check Vercel environment variables: DATABASE_URL, JWT_SECRET, REDIS_HOST',
        } : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
