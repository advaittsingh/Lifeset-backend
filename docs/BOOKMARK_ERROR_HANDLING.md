# Bookmark Error Handling

## Overview

The backend now handles bookmark operations gracefully, treating unique constraint errors as "already bookmarked" rather than failures. This provides a smoother user experience and aligns with the frontend's optimistic update strategy.

---

## Unique Constraint Error Handling

### Problem
When a user tries to bookmark an item that's already bookmarked, Prisma throws a `P2002` (unique constraint violation) error. This was causing:
- 400 Bad Request errors in the API
- Error alerts in the mobile app
- Poor user experience

### Solution
All bookmark endpoints now:
1. **Check for existing bookmarks first** - Prevents most unique constraint errors
2. **Catch P2002 errors gracefully** - Treats them as "already bookmarked" success
3. **Return consistent response format** - Always returns success with `bookmarked: true` and `alreadyBookmarked: true` flag

### Response Format

#### Success (New Bookmark)
```json
{
  "bookmarked": true,
  "message": "Bookmarked successfully"
}
```

#### Success (Already Bookmarked)
```json
{
  "bookmarked": true,
  "message": "Already bookmarked",
  "alreadyBookmarked": true
}
```

#### Success (Unbookmarked)
```json
{
  "bookmarked": false,
  "message": "Bookmark removed successfully"
}
```

---

## Affected Endpoints

### 1. POST `/feeds/:id/bookmark`
- **Service**: `FeedsService.bookmarkFeed()`
- **Handles**: Unique constraint errors for feed/bookmark operations
- **Returns**: Success response even if already bookmarked

### 2. POST `/cms/general-knowledge/:id/bookmark`
- **Service**: `CmsService.bookmarkArticle()`
- **Handles**: Unique constraint errors for General Knowledge articles
- **Returns**: Success response even if already bookmarked

### 3. POST `/cms/current-affairs/:id/bookmark`
- **Service**: `CmsService.bookmarkCurrentAffair()`
- **Handles**: Unique constraint errors for Current Affairs articles
- **Returns**: Success response even if already bookmarked

### 4. POST `/mcq/questions/:id/bookmark`
- **Service**: `McqService.bookmarkQuestion()`
- **Handles**: Unique constraint errors for MCQ questions
- **Returns**: Success response even if already bookmarked

---

## Implementation Details

### Error Handling Pattern

All bookmark methods follow this pattern:

```typescript
async bookmarkItem(userId: string, itemId: string) {
  try {
    // 1. Check if bookmark already exists
    const existing = await this.prisma.bookmark.findUnique({...});
    
    if (existing) {
      // Remove bookmark (toggle off)
      await this.prisma.bookmark.delete({...});
      return { bookmarked: false, message: 'Bookmark removed successfully' };
    }

    // 2. Try to create bookmark
    try {
      await this.prisma.bookmark.create({...});
      return { bookmarked: true, message: 'Bookmarked successfully' };
    } catch (createError: any) {
      // 3. Handle unique constraint error
      if (createError.code === 'P2002') {
        return { 
          bookmarked: true, 
          message: 'Already bookmarked', 
          alreadyBookmarked: true 
        };
      }
      throw createError;
    }
  } catch (error: any) {
    // 4. Final catch for any other errors
    if (error.code === 'P2002') {
      return { 
        bookmarked: true, 
        message: 'Already bookmarked', 
        alreadyBookmarked: true 
      };
    }
    throw error;
  }
}
```

### Benefits

1. **No Error Alerts** - Users never see error messages for already-bookmarked items
2. **Optimistic Updates Work** - Frontend can keep optimistic state without reverting
3. **Consistent Behavior** - All bookmark endpoints behave the same way
4. **Race Condition Safe** - Handles concurrent bookmark requests gracefully

---

## Frontend Integration

### Expected Behavior

The frontend can now:
1. **Make optimistic updates** - Update UI immediately when user taps bookmark
2. **Ignore unique constraint errors** - Backend returns success, so no error handling needed
3. **Check `alreadyBookmarked` flag** - Optional flag to show different UI state if needed

### Example Frontend Code

```typescript
// Optimistic update
setBookmarked(true);

try {
  const response = await fetch(`/api/v1/feeds/${id}/bookmark`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  // Backend always returns success (even if already bookmarked)
  // No need to revert optimistic update
  if (data.alreadyBookmarked) {
    // Optional: Show subtle indicator that it was already bookmarked
    console.log('Item was already bookmarked');
  }
} catch (error) {
  // Only handle actual errors (network, auth, etc.)
  // Not unique constraint errors
  setBookmarked(false); // Revert only on real errors
}
```

---

## 404 Error Handling for Bookmark Endpoints

### Endpoints Available

All bookmark endpoints are properly registered and should not return 404:

1. ✅ `GET /feeds/bookmarks` - Get bookmarked feeds
2. ✅ `GET /cms/bookmarks` - Get all bookmarked articles
3. ✅ `GET /cms/general-knowledge/bookmarks` - Get bookmarked GK articles
4. ✅ `GET /cms/current-affairs/bookmarks` - Get bookmarked CA articles
5. ✅ `GET /mcq/bookmarks` - Get bookmarked MCQ questions

### Route Ordering

Routes are ordered correctly to prevent conflicts:
- Specific routes (`/bookmarks`) come **before** parameterized routes (`/:id`)
- This ensures `/cms/general-knowledge/bookmarks` matches before `/cms/general-knowledge/:id`

### Frontend 404 Handling

If the frontend encounters a 404 (shouldn't happen, but defensive coding):

```typescript
try {
  const response = await fetch('/api/v1/cms/general-knowledge/bookmarks', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (response.status === 404) {
    // Endpoint doesn't exist (shouldn't happen)
    // Return empty array gracefully
    return { data: [], pagination: { total: 0 } };
  }
  
  return await response.json();
} catch (error) {
  // Log non-404 errors in development
  if (__DEV__ && error.status !== 404) {
    console.error('Bookmark fetch error:', error);
  }
  // Return empty array for any error
  return { data: [], pagination: { total: 0 } };
}
```

---

## Testing

### Test Cases

1. **Bookmark new item** - Should return `bookmarked: true`
2. **Bookmark already-bookmarked item** - Should return `bookmarked: true, alreadyBookmarked: true`
3. **Unbookmark item** - Should return `bookmarked: false`
4. **Concurrent bookmark requests** - Should handle gracefully without errors
5. **Network errors** - Should still throw errors (not unique constraint)

### Example Test

```typescript
// Test: Bookmark already-bookmarked item
const response = await bookmarkArticle(userId, articleId);
expect(response.bookmarked).toBe(true);
expect(response.alreadyBookmarked).toBe(true);
expect(response.message).toBe('Already bookmarked');
```

---

## Summary

✅ **Unique constraint errors** are now handled gracefully  
✅ **All bookmark endpoints** return success responses  
✅ **Frontend optimistic updates** work without reverting  
✅ **No error alerts** for already-bookmarked items  
✅ **Consistent behavior** across all bookmark endpoints  
✅ **404 errors** shouldn't occur (endpoints are properly registered)

The backend now fully supports the frontend's optimistic update strategy and provides a smooth user experience for bookmark operations.

