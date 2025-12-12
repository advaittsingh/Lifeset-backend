import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    let details: any = undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message || 'An error occurred';
        // If message is an array (validation errors), join them
        if (Array.isArray(message)) {
          message = message.join(', ');
        }
        details = responseObj;
      } else {
        message = exception.message || 'An error occurred';
      }
      
      // Log the error with context
      this.logger.error(
        `${request.method} ${request.url} - ${status}: ${message}`,
        exception.stack,
      );
    } else {
      // Log unexpected errors for debugging
      const error = exception as Error;
      this.logger.error(
        `Unexpected error: ${error.message || 'Unknown error'}`,
        error.stack,
        `${request.method} ${request.url}`,
      );
      message = error.message || 'Internal server error';
      
      // Provide more helpful error messages for common issues
      if (error.message?.includes('DATABASE_URL') || error.message?.includes('database')) {
        message = 'Database configuration error. Please check DATABASE_URL environment variable.';
      } else if (error.message?.includes('JWT_SECRET') || error.message?.includes('JWT')) {
        message = 'Authentication configuration error. Please check JWT_SECRET and JWT_REFRESH_SECRET environment variables.';
      } else if (error.message?.includes('Redis') || error.message?.includes('REDIS')) {
        message = 'Redis connection error. The application will continue but some features may be limited.';
      }
    }

    response.status(status).json({
      success: false,
      error: {
        code: status,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

