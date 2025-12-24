# Debugging Session Persistence Issues

## Backend Response Format

After the fix, the `/auth/restore-session` endpoint returns:

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
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Important**: Access tokens as `response.data.accessToken` and `response.data.refreshToken` (not `response.data.data.refreshToken`).

## Common Frontend Issues

### 1. Not Calling restore-session on App Startup

**Problem**: App doesn't check for stored refresh token when it starts.

**Solution**: Add session restoration to your app's entry point (App.js, App.tsx, or main.dart).

### 2. Not Storing refreshToken After Login

**Problem**: After login, the refreshToken is not being saved to secure storage.

**Check**: After login, verify that `refreshToken` is stored:
```typescript
// After login response
const { data } = await response.json();
console.log('RefreshToken received:', data.refreshToken ? 'YES' : 'NO');
await setSecureStorage('refreshToken', data.refreshToken);
```

### 3. Wrong Response Path

**Problem**: Accessing tokens from wrong path in response.

**Correct Path**:
```typescript
const response = await fetch('/api/v1/auth/restore-session', {...});
const result = await response.json();
// Correct:
const refreshToken = result.data.refreshToken;
const accessToken = result.data.accessToken;
const user = result.data.user;

// Wrong (double nesting):
// const refreshToken = result.data.data.refreshToken; ❌
```

### 4. Not Updating refreshToken After restore-session

**Problem**: The backend returns a NEW refreshToken each time, but frontend doesn't update it.

**Solution**: Always update stored refreshToken:
```typescript
const result = await response.json();
// Update with NEW refreshToken
await setSecureStorage('refreshToken', result.data.refreshToken);
```

### 5. Using AsyncStorage Instead of Secure Storage

**Problem**: Storing tokens in AsyncStorage (not secure, can be cleared by OS).

**Solution**: Use secure storage:
- React Native: `react-native-keychain`
- Expo: `expo-secure-store`
- Flutter: `flutter_secure_storage`

### 6. Network Error Handling

**Problem**: Network errors cause tokens to be cleared unnecessarily.

**Solution**: Only clear tokens on authentication errors (401), not network errors:
```typescript
try {
  const response = await fetch('/api/v1/auth/restore-session', {...});
  if (response.status === 401) {
    // Authentication failed - clear tokens
    await clearSecureStorage('refreshToken');
    navigateToLogin();
  } else if (!response.ok) {
    // Network or server error - don't clear tokens
    console.error('Server error:', response.status);
    // Maybe retry or show error message
  }
} catch (error) {
  // Network error - don't clear tokens
  console.error('Network error:', error);
  // Maybe retry or show offline message
}
```

## Testing Steps

1. **Login and Verify Storage**:
   ```typescript
   // After login
   const refreshToken = await getSecureStorage('refreshToken');
   console.log('Stored refreshToken:', refreshToken ? 'EXISTS' : 'MISSING');
   ```

2. **Close and Reopen App**:
   - Close the app completely (not just minimize)
   - Reopen the app
   - Check if restore-session is called

3. **Check Network Requests**:
   - Open network inspector
   - Look for POST request to `/api/v1/auth/restore-session` on app startup
   - Check response status and body

4. **Verify Token Update**:
   ```typescript
   const oldToken = await getSecureStorage('refreshToken');
   // Call restore-session
   const newToken = await getSecureStorage('refreshToken');
   console.log('Token updated:', oldToken !== newToken ? 'YES' : 'NO');
   ```

## Backend Logs

Check backend logs for:
- `✅ Session restored successfully for user {userId}` - Success
- `Session restoration failed: ...` - Failure reasons

## Quick Test Endpoint

You can test the endpoint directly:

```bash
curl -X POST https://lifeset-backend.vercel.app/api/v1/auth/restore-session \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN_HERE"}'
```

Replace `YOUR_REFRESH_TOKEN_HERE` with an actual refresh token from a login response.

## Expected Behavior

1. User logs in → `refreshToken` stored in secure storage
2. User closes app → `refreshToken` persists in secure storage
3. User opens app → App calls `/auth/restore-session` with stored `refreshToken`
4. Backend validates token → Returns new tokens and user info
5. App updates stored `refreshToken` → User stays logged in

If any step fails, check the corresponding section above.

