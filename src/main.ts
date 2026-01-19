import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import * as fs from 'fs';

async function bootstrap() {
  // Check for SSL certificate configuration before creating the app
  const sslCertPath = process.env.SSL_CERT_PATH;
  const sslKeyPath = process.env.SSL_KEY_PATH;
  let httpsOptions: { cert: Buffer; key: Buffer } | undefined;
  
  if (sslCertPath && sslKeyPath) {
    try {
      httpsOptions = {
        cert: fs.readFileSync(sslCertPath),
        key: fs.readFileSync(sslKeyPath),
      };
      console.log(`SSL certificates loaded from: ${sslCertPath} and ${sslKeyPath}`);
    } catch (error) {
      console.error('Failed to load SSL certificates:', error);
      console.error('Continuing with HTTP...');
    }
  }
  
  // Increase body size limit for JSON requests (default is 100kb)
  // Allow up to 50MB for articles with images (base64 encoded)
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser to use custom limits
    rawBody: false,
    ...(httpsOptions && { httpsOptions }), // Add HTTPS options if certificates are available
  });
  
  // Get the underlying Express instance and configure body parser with increased limits
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.json({ limit: '50mb' }));
  expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Configure multipart/form-data handling for file uploads
  // Note: Multer handles multipart/form-data, but we need to ensure body parser doesn't interfere
  // The FileInterceptor from NestJS will handle multipart/form-data parsing

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
  // Enhanced compression configuration
  app.use(compression({
    level: 6, // Balance between compression and CPU (1-9, default 6)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Compress JSON and text responses
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  // CORS
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:19006', // Expo default
    'exp://localhost:8081', // Expo
  ];
  
  // Allow all origins in development, or specific origins in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Log CORS configuration for debugging
  console.log('CORS Configuration:', {
    isDevelopment,
    corsOrigins,
    nodeEnv: process.env.NODE_ENV,
  });
  
  app.enableCors({
    origin: (origin, callback) => {
      // Log all CORS requests for debugging
      console.log('CORS Request:', {
        origin,
        allowedOrigins: corsOrigins,
        isDevelopment,
      });
      
      // In development, allow all origins
      if (isDevelopment) {
        callback(null, true);
        return;
      }
      
      // In production, check against allowed origins
      // Also allow requests without origin (e.g., Postman, curl, mobile apps)
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // Allow Content-Type header for file uploads (multipart/form-data)
    // Don't restrict Content-Type to allow multipart/form-data with boundary
    allowedHeaders: ['Content-Type', 'Authorization', 'LYFSET', 'x-api-key', 'api-key', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    // Increase max age for preflight requests
    maxAge: 86400, // 24 hours
  });

  // Global prefix
  const apiPrefix = process.env.API_PREFIX || '/api/v1';
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

  const port = process.env.PORT || 3000;
  const server = await app.listen(port);
  
  // Determine protocol based on whether HTTPS options were used
  const protocol = httpsOptions ? 'https' : 'http';
  
  console.log(`Application is running on: ${protocol}://localhost:${port}`);
  console.log(`API Documentation: ${protocol}://localhost:${port}${apiPrefix}/docs`);
  
  if (httpsOptions) {
    console.log(`SSL enabled with certificates from: ${sslCertPath} and ${sslKeyPath}`);
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: Running in production without HTTPS. Set SSL_CERT_PATH and SSL_KEY_PATH environment variables to enable HTTPS.');
  }
  
  // Increase server timeouts for file uploads
  server.timeout = 300000; // 5 minutes
  server.keepAliveTimeout = 65000; // 65 seconds (must be > 60s for ALB)
  server.headersTimeout = 66000; // 66 seconds (must be > keepAliveTimeout)
  
  console.log(`Server timeouts configured: ${server.timeout}ms`);
}

bootstrap();

