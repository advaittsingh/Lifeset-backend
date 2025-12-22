# View Duration Tracking Endpoints

## Overview

View duration tracking endpoints allow the mobile app to track how long users spend viewing articles. These endpoints support both **Current Affairs** and **General Knowledge** articles.

---

## Endpoints

### 1. Track View (Current Affairs)

**Endpoint:** `POST /cms/current-affairs/:id/view`

**Description:** Tracks a view event for a Current Affairs article.

**Authentication:** Optional (Public endpoint)

**Request:**
```http
POST /cms/current-affairs/{articleId}/view
Authorization: Bearer <token> (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "View tracked successfully"
}
```

---

### 2. Track View Duration (Current Affairs)

**Endpoint:** `POST /cms/current-affairs/:id/view-duration`

**Description:** Tracks view duration for a Current Affairs article. If the user is authenticated and duration >= 20 seconds, the article is automatically marked as read.

**Authentication:** Optional (Public endpoint)

**Request:**
```http
POST /cms/current-affairs/{articleId}/view-duration
Content-Type: application/json
Authorization: Bearer <token> (optional)

{
  "duration": 45  // Duration in seconds
}
```

**Response:**
```json
{
  "success": true,
  "message": "View duration tracked successfully"
}
```

**Behavior:**
- Creates a `PostViewDuration` record
- If `userId` is provided and `duration >= 20` seconds, creates a `PostRead` record (marks as read)

---

### 3. Track View (General Knowledge) ✅ NEW

**Endpoint:** `POST /cms/general-knowledge/:id/view`

**Description:** Tracks a view event for a General Knowledge article.

**Authentication:** Optional (Public endpoint)

**Request:**
```http
POST /cms/general-knowledge/{articleId}/view
Authorization: Bearer <token> (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "View tracked successfully"
}
```

---

### 4. Track View Duration (General Knowledge) ✅ NEW

**Endpoint:** `POST /cms/general-knowledge/:id/view-duration`

**Description:** Tracks view duration for a General Knowledge article. If the user is authenticated and duration >= 20 seconds, the article is automatically marked as read.

**Authentication:** Optional (Public endpoint)

**Request:**
```http
POST /cms/general-knowledge/{articleId}/view-duration
Content-Type: application/json
Authorization: Bearer <token> (optional)

{
  "duration": 60  // Duration in seconds
}
```

**Response:**
```json
{
  "success": true,
  "message": "View duration tracked successfully"
}
```

**Behavior:**
- Creates a `PostViewDuration` record
- If `userId` is provided and `duration >= 20` seconds, creates a `PostRead` record (marks as read)

---

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "General knowledge article not found",
  "error": "Not Found"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Duration must be a positive number",
  "error": "Bad Request"
}
```

---

## Implementation Details

### Service Methods

Both `trackView()` and `trackViewDuration()` methods accept a `postType` parameter:

```typescript
async trackView(
  articleId: string, 
  userId?: string, 
  postType: 'CURRENT_AFFAIRS' | 'COLLEGE_FEED' = 'CURRENT_AFFAIRS'
)

async trackViewDuration(
  articleId: string, 
  duration: number, 
  userId?: string, 
  postType: 'CURRENT_AFFAIRS' | 'COLLEGE_FEED' = 'CURRENT_AFFAIRS'
)
```

**Note:** General Knowledge articles use `postType: 'COLLEGE_FEED'` in the database.

### Database Models

- **PostView**: Tracks individual view events
  - `postId`: Article ID
  - `userId`: User ID (nullable for anonymous views)
  - `createdAt`: Timestamp

- **PostViewDuration**: Tracks view durations
  - `postId`: Article ID
  - `userId`: User ID (nullable for anonymous views)
  - `duration`: Duration in seconds
  - `createdAt`: Timestamp

- **PostRead**: Marks articles as read
  - `postId`: Article ID
  - `userId`: User ID
  - `readAt`: Timestamp
  - Created automatically when `duration >= 20` seconds for authenticated users

---

## Mobile App Integration

### Example: Track View Duration for General Knowledge

```typescript
async function trackViewDuration(articleId: string, duration: number, token?: string) {
  try {
    const response = await fetch(
      `/api/v1/cms/general-knowledge/${articleId}/view-duration`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ duration }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Article not found - handle gracefully
        console.warn('Article not found for view duration tracking');
        return;
      }
      throw new Error(`Failed to track view duration: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('View duration tracked:', data);
  } catch (error) {
    // Log error but don't interrupt user experience
    console.error('Error tracking view duration:', error);
  }
}
```

### Example: Track View Duration for Current Affairs

```typescript
async function trackViewDuration(articleId: string, duration: number, token?: string) {
  try {
    const response = await fetch(
      `/api/v1/cms/current-affairs/${articleId}/view-duration`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ duration }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Article not found for view duration tracking');
        return;
      }
      throw new Error(`Failed to track view duration: ${response.statusText}`);
    }

    const data = await response.json();
  } catch (error) {
    console.error('Error tracking view duration:', error);
  }
}
```

### Best Practices

1. **Handle 404 Errors Gracefully** - Don't show error alerts for missing articles
2. **Non-Blocking** - View tracking shouldn't interrupt user experience
3. **Batch Updates** - Consider debouncing view duration updates to reduce API calls
4. **Anonymous Support** - Endpoints work without authentication (userId will be null)
5. **Automatic Read Status** - Articles are automatically marked as read after 20 seconds (authenticated users only)

---

## Quick Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/cms/current-affairs/:id/view` | POST | Optional | Track view for Current Affairs |
| `/cms/current-affairs/:id/view-duration` | POST | Optional | Track view duration for Current Affairs |
| `/cms/general-knowledge/:id/view` | POST | Optional | Track view for General Knowledge ✅ NEW |
| `/cms/general-knowledge/:id/view-duration` | POST | Optional | Track view duration for General Knowledge ✅ NEW |

---

## Fixed Issues

✅ **404 Error for General Knowledge View Duration** - Added `/cms/general-knowledge/:id/view-duration` endpoint  
✅ **Service Method Support** - Updated `trackView()` and `trackViewDuration()` to support both post types  
✅ **Error Handling** - Proper error messages for both article types  
✅ **Automatic Read Status** - Works for both Current Affairs and General Knowledge

---

## Testing

### Test Cases

1. ✅ Track view duration for General Knowledge article (authenticated)
2. ✅ Track view duration for General Knowledge article (anonymous)
3. ✅ Track view duration >= 20 seconds marks as read (authenticated)
4. ✅ Track view duration < 20 seconds doesn't mark as read
5. ✅ 404 error for non-existent article
6. ✅ 400 error for negative duration
7. ✅ Track view duration for Current Affairs article
8. ✅ Track view for both article types

### Example Test

```typescript
// Test: Track view duration for General Knowledge
const response = await fetch('/api/v1/cms/general-knowledge/{id}/view-duration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ duration: 45 }),
});

expect(response.status).toBe(200);
const data = await response.json();
expect(data.success).toBe(true);
```

---

## Summary

✅ All view tracking endpoints now support both **Current Affairs** and **General Knowledge** articles  
✅ 404 errors are properly handled  
✅ Automatic read status marking works for both article types  
✅ Endpoints support both authenticated and anonymous users  
✅ View duration tracking is non-blocking and user-friendly

