# Session Persistence API Documentation

## Overview

This document describes how to implement persistent user sessions in the mobile app. The backend supports long-lived sessions using refresh tokens that persist for 90 days, allowing users to stay logged in even after closing and reopening the app.

## Authentication Flow

### Initial Login/Registration

When a user logs in or registers, the backend returns:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "mobile": "+1234567890",
      "userType": "STUDENT"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Important**: Store the `refreshToken` securely:
- **iOS**: Use Keychain Services
- **Android**: Use EncryptedSharedPreferences or Android Keystore
- **React Native**: Use `react-native-keychain` or `expo-secure-store`

The `accessToken` can be stored in memory only, as it can be regenerated using the refresh token.

### Token Expiration

- **Access Token**: Valid for 7 days (configurable via `JWT_EXPIRES_IN` env var)
- **Refresh Token**: Valid for 90 days (configurable via `JWT_REFRESH_EXPIRES_IN` env var, defaults to `'90d'`)

## API Endpoints

### 1. Restore Session

Use this endpoint when the app starts to restore the user's session from a stored refresh token.

**Endpoint**: `POST /api/v1/auth/restore-session`

**Authentication**: Not required (Public endpoint)

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "mobile": "+1234567890",
      "userType": "STUDENT",
      "isActive": true,
      "isVerified": true,
      "profileImage": null,
      "studentProfile": { ... },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Session restored successfully. Please update your stored refreshToken with the new one."
}
```

**Error Response** (401):
```json
{
  "statusCode": 401,
  "message": "Refresh token expired. Please login again.",
  "error": "Unauthorized"
}
```

**Important**: 
- Always update your stored `refreshToken` with the new one returned in the response
- The backend issues new tokens each time this endpoint is called
- If the refresh token is expired or invalid, the user must login again

### 2. Refresh Access Token

Use this endpoint when the access token expires during app usage.

**Endpoint**: `POST /api/v1/auth/refresh`

**Authentication**: Not required (Public endpoint)

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response** (401):
```json
{
  "statusCode": 401,
  "message": "INVALID_TOKEN_EXPIRED",
  "error": "Unauthorized"
}
```

**Important**: Update both `accessToken` and `refreshToken` with the new values returned.

### 3. Validate Session

Check if a refresh token is still valid without refreshing it.

**Endpoint**: `POST /api/v1/auth/validate-session`

**Authentication**: Not required (Public endpoint)

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response** (200):
```json
{
  "valid": true,
  "userId": "user-id",
  "expiresAt": "2024-04-01T00:00:00.000Z"
}
```

**Invalid Response** (200):
```json
{
  "valid": false,
  "reason": "TOKEN_EXPIRED" // or "SESSION_NOT_FOUND_OR_EXPIRED", "USER_NOT_FOUND_OR_INACTIVE", etc.
}
```

## Mobile App Implementation

### App Startup Flow

```typescript
// Pseudocode for app startup
async function onAppStart() {
  try {
    // 1. Retrieve stored refresh token from secure storage
    const refreshToken = await getSecureStorage('refreshToken');
    
    if (!refreshToken) {
      // No stored token - navigate to login
      navigateToLogin();
      return;
    }
    
    // 2. Restore session using refresh token
    const response = await fetch('https://lifeset-backend.vercel.app/api/v1/auth/restore-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (response.ok) {
      const result = await response.json();
      const { data } = result;
      
      // 3. Store new tokens
      await setSecureStorage('refreshToken', data.refreshToken);
      await setMemoryStorage('accessToken', data.accessToken);
      
      // 4. Set user state in app
      setUser(data.user);
      
      // 5. Navigate to main app
      navigateToMainApp();
    } else {
      // Token expired or invalid - clear storage and show login
      await clearSecureStorage('refreshToken');
      navigateToLogin();
    }
  } catch (error) {
    // Network error or other issue - clear storage and show login
    console.error('Failed to restore session:', error);
    await clearSecureStorage('refreshToken');
    navigateToLogin();
  }
}
```

### Token Refresh on API Calls

Implement an HTTP interceptor to automatically refresh tokens when access tokens expire:

```typescript
// Pseudocode for API interceptor
async function apiRequest(url, options = {}) {
  // Get current access token from memory
  let accessToken = getMemoryStorage('accessToken');
  
  // Add authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  };
  
  // Make request
  let response = await fetch(url, { ...options, headers });
  
  // If 401, try to refresh token
  if (response.status === 401) {
    const refreshToken = await getSecureStorage('refreshToken');
    
    if (!refreshToken) {
      // No refresh token - user needs to login
      navigateToLogin();
      throw new Error('Authentication required');
    }
    
    try {
      // Refresh tokens
      const refreshResponse = await fetch('https://lifeset-backend.vercel.app/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (refreshResponse.ok) {
        const { data } = await refreshResponse.json();
        
        // Update stored tokens
        await setSecureStorage('refreshToken', data.refreshToken);
        await setMemoryStorage('accessToken', data.accessToken);
        
        // Retry original request with new access token
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed - user needs to login
        await clearSecureStorage('refreshToken');
        navigateToLogin();
        throw new Error('Session expired');
      }
    } catch (error) {
      // Refresh failed - user needs to login
      await clearSecureStorage('refreshToken');
      navigateToLogin();
      throw error;
    }
  }
  
  return response;
}
```

### Logout Flow

```typescript
async function logout() {
  const accessToken = getMemoryStorage('accessToken');
  
  try {
    // Call logout endpoint to invalidate session on server
    await fetch('https://lifeset-backend.vercel.app/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Logout request failed:', error);
    // Continue with local logout even if request fails
  } finally {
    // Always clear local storage
    await clearSecureStorage('refreshToken');
    clearMemoryStorage('accessToken');
    setUser(null);
    navigateToLogin();
  }
}
```

## Multi-Device Support

The backend supports multiple active sessions per user, allowing users to be logged in on multiple devices simultaneously. Each device will have its own session with its own refresh token.

## Error Handling

Common error scenarios and how to handle them:

1. **Refresh Token Expired** (90 days passed)
   - Clear stored refresh token
   - Navigate user to login screen

2. **Network Error**
   - Retry the request with exponential backoff
   - If repeated failures, show error message to user
   - Don't clear tokens on network errors

3. **Invalid Token Format**
   - Clear stored refresh token
   - Navigate user to login screen

4. **User Account Deactivated**
   - Clear stored refresh token
   - Show message: "Your account has been deactivated"
   - Navigate user to login screen

## Security Best Practices

1. **Always use secure storage** for refresh tokens (Keychain/KeyStore)
2. **Never store tokens in plain text** or in AsyncStorage without encryption
3. **Clear tokens on logout** and when tokens are invalid
4. **Validate token expiration** before making API calls (optional optimization)
5. **Use HTTPS only** for all API communications
6. **Handle token refresh failures gracefully** - don't expose error details to users

## Environment Variables

The backend uses these environment variables (already configured):

- `JWT_SECRET` - Secret for signing access tokens (required)
- `JWT_REFRESH_SECRET` - Secret for signing refresh tokens (required)
- `JWT_EXPIRES_IN` - Access token expiration (default: `'7d'`)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration (default: `'90d'`)

## Testing Checklist

- [ ] User stays logged in after closing and reopening app
- [ ] Session restores correctly on app startup
- [ ] Token refresh works when access token expires
- [ ] Multiple devices can be logged in simultaneously
- [ ] Logout clears tokens and invalidates session
- [ ] Expired refresh tokens are handled gracefully
- [ ] Network errors don't cause unnecessary logouts
- [ ] Tokens are stored securely (Keychain/KeyStore)

## Example Implementation Libraries

### React Native
- `react-native-keychain` - Secure keychain/keystore access
- `@react-native-async-storage/async-storage` - For non-sensitive data only

### Expo
- `expo-secure-store` - Secure storage for Expo apps

### Flutter
- `flutter_secure_storage` - Secure storage plugin
- `shared_preferences` - For non-sensitive data only

## Support

For questions or issues, contact the backend team or refer to the main API documentation at `/api/v1/docs` (Swagger UI).

