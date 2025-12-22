# Enhanced Database Error Detection & Logging

## Overview

This document describes the enhanced database error detection and logging system implemented for the experience section (and extensible to other sections) of the LifeSet backend.

## Features Implemented

### 1. Database Error Detection Utility

**Location:** `src/common/utils/database-error-detector.util.ts`

The utility provides:

- **Keyword-based detection**: Detects database-related errors by checking for keywords like:
  - "database", "prisma", "connection", "query", "constraint"
  - "foreign key", "unique constraint", "datasource"
  - "p1001", "p2002", "p2003", "p2014", "p2025" (Prisma error codes)
  - "timeout", "connection pool", "postgres", "sql", "transaction", "deadlock"

- **Prisma error code detection**: Recognizes common Prisma error codes:
  - `P1001`: Connection error
  - `P1002`: Connection timeout
  - `P2002`: Unique constraint violation
  - `P2003`: Foreign key constraint violation
  - `P2014`: Required relation violation
  - `P2025`: Record not found
  - And many more...

- **Error type classification**: Categorizes errors as:
  - `database`: Database-related errors
  - `validation`: Validation errors (400 status)
  - `network`: Network errors
  - `unknown`: Unclassified errors

- **User-friendly messages**: Provides clear, actionable error messages based on error type

### 2. Enhanced Logging for Experience Section

**Location:** `src/profiles/profiles.service.ts`

The experience saving process now includes comprehensive logging:

#### Before Sending Data
- **Payload logging**: Logs the exact payload being sent to the backend
  ```
  🔍 Experience save - Payload being sent
  ```

#### Field Validation
- **Required fields validation**: Logs each experience entry with required fields validation
  ```
  🔍 Experience entry {index} - Required fields validation
  ```
  - Checks for `title` (designation/title)
  - Checks for `startDate` (startMonthYear/startDate)
  - Logs company name, designation, currentlyWorking status

#### Database Operations
- **Data being sent**: Logs the data structure being sent to the database
  ```
  🔍 Experience save - Data being sent to database
  ```
  - Includes record count
  - Includes sample record with key fields

#### Success Response
- **Backend response**: Logs the backend response after successful save
  ```
  ✅ Experience save - Backend response
  ```
  - Records created count
  - Expected count
  - Success status

#### Error Handling
- **Enhanced error logging**: Logs detailed error information with database detection
  ```
  🔴 Experience save error - Error creating experiences
  ```
  - Includes `isDatabaseError` flag
  - Includes error type (database/validation/network/unknown)
  - Includes detected keywords
  - Includes error code
  - Includes full error details (message, code, meta, stack)

### 3. Better Error Messages

The system now provides specific error messages based on error type:

#### Database Errors
- **Connection errors**: "Database connection error. Please check your connection and try again."
- **Unique constraint**: "A record with this information already exists. Please check your data."
- **Foreign key**: "Invalid reference. Please check that all related records exist."
- **Required relation**: "Missing required relationship. Please check your data."
- **Timeout**: "Database operation timed out. Please try again."
- **General database**: "Database error occurred. Please try again or contact support if the issue persists."

#### Validation Errors
- Uses the original error message or: "Invalid data provided. Please check your input."

#### Network Errors
- "Network error. Please check your connection and try again."

#### 500 Errors
- Treated as potential database issues: "Server error occurred. This might be a database issue. Please try again."

## Error Response Format

### Database Error Response
```json
{
  "message": "Database connection error. Please check your connection and try again.",
  "error": "Database Error",
  "isDatabaseError": true,
  "errorType": "database",
  "errorCode": "P1001",
  "detectedKeywords": ["connection", "prisma"],
  "originalError": "Can't reach database server..."
}
```

### Validation Error Response
```json
{
  "message": "Invalid data provided. Please check your input.",
  "error": "Validation Error",
  "isDatabaseError": false,
  "errorType": "validation",
  "originalError": "Title is required"
}
```

### Generic Error Response
```json
{
  "message": "Failed to save experiences: ...",
  "error": "Save Error",
  "isDatabaseError": false,
  "errorType": "unknown",
  "originalError": "..."
}
```

## How to Identify Database Issues

When saving experience data, check the console logs for:

### Before Sending
Look for: `🔍 Experience save - Payload being sent`
- Verifies the data structure being sent from frontend
- Helps identify frontend data format issues

### On Success
Look for: `✅ Experience save - Backend response`
- Verifies that data was saved successfully
- Shows records created vs expected count

### On Error
Look for: `🔴 Experience save error` with `isDatabaseError: true`
- Indicates a database-related issue
- Provides error type, code, and detected keywords

## Common Database Issues

### Prisma Connection Errors (P1001)
- **Symptoms**: "Database connection error"
- **Keywords**: "connection", "prisma", "p1001"
- **Action**: Check DATABASE_URL environment variable, database server status

### Constraint Violations
- **Unique constraint (P2002)**: "A record with this information already exists"
- **Foreign key (P2003)**: "Invalid reference"
- **Keywords**: "constraint", "unique", "foreign key"
- **Action**: Check data relationships and uniqueness requirements

### Query Errors
- **Symptoms**: SQL/Prisma query execution failures
- **Keywords**: "query", "sql", "prisma"
- **Action**: Check query syntax, table/column names, data types

### 500 Errors
- **Symptoms**: Server errors that might indicate database problems
- **Action**: Check server logs for database error details

## Usage Example

```typescript
import { logErrorWithDatabaseDetection } from '../common/utils/database-error-detector.util';

try {
  // Database operation
  await this.prisma.experience.createMany({ data: experienceData });
} catch (error: any) {
  const dbErrorInfo = logErrorWithDatabaseDetection(
    this.logger,
    'Experience save error',
    error,
    { userId, additionalContext: '...' }
  );
  
  if (dbErrorInfo.isDatabaseError) {
    throw new InternalServerErrorException({
      message: dbErrorInfo.userFriendlyMessage,
      isDatabaseError: true,
      // ... other fields
    });
  }
}
```

## Extending to Other Sections

The database error detection utility can be easily extended to other sections:

1. Import the utility:
   ```typescript
   import { logErrorWithDatabaseDetection } from '../common/utils/database-error-detector.util';
   ```

2. Wrap database operations in try-catch:
   ```typescript
   try {
     // Database operation
   } catch (error: any) {
     const dbErrorInfo = logErrorWithDatabaseDetection(
       this.logger,
       'Context description',
       error,
       { additionalContext }
     );
     // Handle based on error type
   }
   ```

3. Add enhanced logging before operations:
   ```typescript
   this.logger.log(`🔍 Section save - Payload being sent`, { payload });
   // ... operation
   this.logger.log(`✅ Section save - Backend response`, { result });
   ```

## Benefits

1. **Faster Debugging**: Clear identification of database vs validation vs network errors
2. **Better User Experience**: User-friendly error messages instead of technical jargon
3. **Comprehensive Logging**: Full visibility into the data flow and error details
4. **Proactive Detection**: Identifies database issues before they cause major problems
5. **Extensible**: Easy to apply to other sections of the application

