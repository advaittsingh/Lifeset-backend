/**
 * Database Error Detection Utility
 * 
 * Detects database-related errors by checking for keywords and error codes.
 * Helps identify when errors are database-related vs validation/network errors.
 */

export interface DatabaseErrorInfo {
  isDatabaseError: boolean;
  errorType: 'database' | 'validation' | 'network' | 'unknown';
  userFriendlyMessage: string;
  detectedKeywords: string[];
  errorCode?: string;
}

/**
 * Database error keywords to detect
 */
const DATABASE_KEYWORDS = [
  'database',
  'prisma',
  'connection',
  'query',
  'constraint',
  'foreign key',
  'unique constraint',
  'datasource',
  'p1001', // Prisma connection error
  'p2002', // Unique constraint violation
  'p2003', // Foreign key constraint violation
  'p2014', // Required relation violation
  'p2025', // Record not found
  'timeout',
  'connection pool',
  'postgres',
  'sql',
  'transaction',
  'deadlock',
];

/**
 * Prisma error codes that indicate database issues
 */
const PRISMA_DATABASE_ERROR_CODES = [
  'P1001', // Connection error
  'P1002', // Connection timeout
  'P1008', // Operations timed out
  'P1009', // Database already exists
  'P1010', // Database doesn't exist
  'P1011', // TLS connection error
  'P1012', // Schema validation error
  'P1013', // Invalid database string
  'P1014', // Underlying table doesn't exist
  'P1015', // Unsupported features
  'P1016', // Incorrect number of parameters
  'P1017', // Server closed connection
  'P2002', // Unique constraint violation
  'P2003', // Foreign key constraint violation
  'P2014', // Required relation violation
  'P2025', // Record not found
];

/**
 * Detects if an error is database-related
 */
export function detectDatabaseError(error: any): DatabaseErrorInfo {
  const errorMessage = String(error?.message || '').toLowerCase();
  const errorCode = error?.code || error?.meta?.code || '';
  const errorStack = String(error?.stack || '').toLowerCase();
  
  // Combine all error text for searching
  const allErrorText = `${errorMessage} ${errorStack} ${errorCode}`.toLowerCase();
  
  // Check for Prisma error codes
  const isPrismaErrorCode = PRISMA_DATABASE_ERROR_CODES.some(code => 
    errorCode === code || allErrorText.includes(code.toLowerCase())
  );
  
  // Check for database keywords
  const detectedKeywords = DATABASE_KEYWORDS.filter(keyword => 
    allErrorText.includes(keyword.toLowerCase())
  );
  
  // Determine if it's a database error
  const isDatabaseError = isPrismaErrorCode || detectedKeywords.length > 0;
  
  // Determine error type
  let errorType: 'database' | 'validation' | 'network' | 'unknown' = 'unknown';
  let userFriendlyMessage = 'An unexpected error occurred. Please try again.';
  
  if (isDatabaseError) {
    errorType = 'database';
    
    // Provide specific messages based on error code
    if (errorCode === 'P1001' || detectedKeywords.includes('connection')) {
      userFriendlyMessage = 'Database connection error. Please check your connection and try again.';
    } else if (errorCode === 'P2002' || detectedKeywords.includes('unique constraint')) {
      userFriendlyMessage = 'A record with this information already exists. Please check your data.';
    } else if (errorCode === 'P2003' || detectedKeywords.includes('foreign key')) {
      userFriendlyMessage = 'Invalid reference. Please check that all related records exist.';
    } else if (errorCode === 'P2014' || detectedKeywords.includes('required relation')) {
      userFriendlyMessage = 'Missing required relationship. Please check your data.';
    } else if (detectedKeywords.includes('timeout')) {
      userFriendlyMessage = 'Database operation timed out. Please try again.';
    } else if (detectedKeywords.includes('constraint')) {
      userFriendlyMessage = 'Data validation failed. Please check your input.';
    } else {
      userFriendlyMessage = 'Database error occurred. Please try again or contact support if the issue persists.';
    }
  } else if (error?.status === 400 || detectedKeywords.includes('validation')) {
    errorType = 'validation';
    userFriendlyMessage = error?.message || 'Invalid data provided. Please check your input.';
  } else if (error?.status === 500 || error?.statusCode === 500) {
    // 500 errors might be database-related
    errorType = 'database';
    userFriendlyMessage = 'Server error occurred. This might be a database issue. Please try again.';
  } else if (detectedKeywords.includes('network') || error?.code === 'ECONNREFUSED') {
    errorType = 'network';
    userFriendlyMessage = 'Network error. Please check your connection and try again.';
  }
  
  return {
    isDatabaseError,
    errorType,
    userFriendlyMessage,
    detectedKeywords,
    errorCode: errorCode || undefined,
  };
}

/**
 * Enhanced error logging with database detection
 */
export function logErrorWithDatabaseDetection(
  logger: any,
  context: string,
  error: any,
  additionalInfo?: Record<string, any>
) {
  const dbErrorInfo = detectDatabaseError(error);
  
  const logData = {
    context,
    error: {
      message: error?.message,
      code: error?.code || error?.meta?.code,
      stack: error?.stack,
    },
    databaseErrorInfo: dbErrorInfo,
    ...additionalInfo,
  };
  
  if (dbErrorInfo.isDatabaseError) {
    logger.error(`🔴 ${context} - Database Error Detected`, logData);
  } else {
    logger.error(`❌ ${context} - Error`, logData);
  }
  
  return dbErrorInfo;
}

