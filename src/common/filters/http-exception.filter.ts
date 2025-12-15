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
        let rawMessage = responseObj.message || exception.message || 'An error occurred';
        
        // If message is an array (validation errors), format them nicely
        if (Array.isArray(rawMessage)) {
          // Filter out empty messages and format validation errors
          const formattedMessages = rawMessage
            .filter((msg: any) => msg && msg.trim())
            .map((msg: any) => {
              // Handle nested validation errors (e.g., "metadata.property language")
              if (typeof msg === 'string') {
                // Replace "property X should not exist" with more user-friendly messages
                if (msg.includes('should not exist')) {
                  return msg.replace(/property (.+) should not exist/i, 'Field "$1" is not allowed');
                }
                // Replace "must be" with more user-friendly messages
                if (msg.includes('must be')) {
                  return msg;
                }
                return msg;
              }
              return String(msg);
            });
          message = formattedMessages.length > 0 
            ? formattedMessages.join('. ') 
            : 'Validation failed';
        } else {
          message = rawMessage;
        }
        
        // Include full details for debugging, but ensure message is user-friendly
        details = {
          ...responseObj,
          message: Array.isArray(rawMessage) ? rawMessage : [rawMessage],
        };
      } else {
        message = exception.message || 'An error occurred';
      }
      
      // Log the error with context
      // For validation errors (400), include request body to help debug
      if (status === HttpStatus.BAD_REQUEST) {
        this.logger.error(
          `${request.method} ${request.url} - ${status}: ${message}`,
          {
            body: request.body,
            query: request.query,
            params: request.params,
            validationErrors: details,
            stack: exception.stack,
          },
        );
      } else {
        this.logger.error(
          `${request.method} ${request.url} - ${status}: ${message}`,
          exception.stack,
        );
      }
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

    // For validation errors, ensure all error messages are included
    const errorResponse: any = {
      success: false,
      error: {
        code: status,
        message,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Include details if available (for validation errors)
    if (details) {
      errorResponse.error.details = details;
      // Also include validation errors at top level for easier access
      if (details.message && Array.isArray(details.message)) {
        errorResponse.error.validationErrors = details.message;
      }
    }

    response.status(status).json(errorResponse);
  }
}

