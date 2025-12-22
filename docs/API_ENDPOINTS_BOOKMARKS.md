# API Endpoints for Bookmarks

## Overview

These endpoints allow the mobile app to retrieve only bookmarked content (posts, articles, MCQ questions) for the current user. All bookmark endpoints require authentication.

---

## Base URLs

```
https://lifeset-backend.vercel.app/api/v1
```

---

## 1. Get Bookmarked Feeds/Posts

Get all bookmarked posts/feeds (jobs, events, etc.) for the current user.

### Endpoint
```
GET /feeds/bookmarks
```

### Authentication
✅ **Required** - JWT token in Authorization header

### Query Parameters
- `type` (optional) - Filter by post type: `JOB`, `INTERNSHIP`, `GOVT_JOB`, `EVENT`, etc.
- `search` (optional) - Search in title and description
- `category` (optional) - Filter by category ID
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)

### Response Format
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "postType": "JOB",
        "isBookmarked": true,
        "content": "string",
        "fullArticle": "string | null",
        "user": {...},
        "category": {...},
        "_count": {
          "likes": 0,
          "comments": 0,
          "bookmarks": 1
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example Request
```
GET /feeds/bookmarks?page=1&limit=20
Authorization: Bearer <token>
```

---

## 2. Get All Bookmarked Articles (Unified)

Get all bookmarked articles (General Knowledge + Current Affairs) for the current user.

### Endpoint
```
GET /cms/bookmarks
```

### Authentication
✅ **Required** - JWT token in Authorization header

### Query Parameters
- `type` (optional) - Filter by type: `GENERAL_KNOWLEDGE`, `CURRENT_AFFAIRS`, or `ALL` (default: `ALL`)
- `search` (optional) - Search in title and description
- `category` (optional) - Filter by category ID
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)

### Response Format
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "postType": "CURRENT_AFFAIRS",
        "isBookmarked": true,
        "searchText": "string",
        "user": {...},
        "category": {...}
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example Request
```
GET /cms/bookmarks?type=ALL&page=1&limit=20
Authorization: Bearer <token>
```

---

## 3. Get Bookmarked General Knowledge Articles

Get only bookmarked General Knowledge articles for the current user.

### Endpoint
```
GET /cms/general-knowledge/bookmarks
```

### Authentication
✅ **Required** - JWT token in Authorization header

### Query Parameters
- `search` (optional) - Search in title and description
- `category` (optional) - Filter by category ID
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)

### Example Request
```
GET /cms/general-knowledge/bookmarks?page=1&limit=20
Authorization: Bearer <token>
```

---

## 4. Get Bookmarked Current Affairs Articles

Get only bookmarked Current Affairs articles for the current user.

### Endpoint
```
GET /cms/current-affairs/bookmarks
```

### Authentication
✅ **Required** - JWT token in Authorization header

### Query Parameters
- `search` (optional) - Search in title and description
- `category` (optional) - Filter by category ID
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)

### Example Request
```
GET /cms/current-affairs/bookmarks?page=1&limit=20
Authorization: Bearer <token>
```

---

## 5. Get Bookmarked MCQ Questions

Get all bookmarked MCQ questions for the current user.

### Endpoint
```
GET /mcq/bookmarks
```

### Authentication
✅ **Required** - JWT token in Authorization header

### Response Format
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "question": "string",
      "options": [...],
      "correctAnswer": 0,
      "category": {...},
      "isBookmarked": true
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example Request
```
GET /mcq/bookmarks
Authorization: Bearer <token>
```

---

## Important Notes

1. **All endpoints return ONLY bookmarked items** - Posts/articles/questions that the user has explicitly bookmarked
2. **Empty arrays are returned** - If user has no bookmarks, an empty array is returned (not an error)
3. **Authentication required** - All bookmark endpoints require a valid JWT token
4. **isBookmarked flag** - All items in the response have `isBookmarked: true` for consistency
5. **Pagination** - All endpoints support pagination with `page` and `limit` parameters

---

## Mobile App Implementation

### Unified Bookmarks Page

For a unified bookmarks page showing all bookmarked content:

```javascript
// Option 1: Fetch all types separately and combine
const [feeds, articles, mcqs] = await Promise.all([
  fetch('/feeds/bookmarks', { headers: { Authorization: `Bearer ${token}` } }),
  fetch('/cms/bookmarks?type=ALL', { headers: { Authorization: `Bearer ${token}` } }),
  fetch('/mcq/bookmarks', { headers: { Authorization: `Bearer ${token}` } }),
]);

// Option 2: Use unified CMS endpoint for articles
const articles = await fetch('/cms/bookmarks?type=ALL', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Filtering by Type

```javascript
// Get only General Knowledge bookmarks
const gkBookmarks = await fetch('/cms/general-knowledge/bookmarks', {
  headers: { Authorization: `Bearer ${token}` }
});

// Get only Current Affairs bookmarks
const caBookmarks = await fetch('/cms/current-affairs/bookmarks', {
  headers: { Authorization: `Bearer ${token}` }
});

// Get only Job posts bookmarks
const jobBookmarks = await fetch('/feeds/bookmarks?type=JOB', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## Quick Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/feeds/bookmarks` | GET | ✅ | Get bookmarked feeds/posts |
| `/cms/bookmarks` | GET | ✅ | Get all bookmarked articles (GK + CA) |
| `/cms/general-knowledge/bookmarks` | GET | ✅ | Get bookmarked General Knowledge articles |
| `/cms/current-affairs/bookmarks` | GET | ✅ | Get bookmarked Current Affairs articles |
| `/mcq/bookmarks` | GET | ✅ | Get bookmarked MCQ questions |

---

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Failed to get bookmarked articles: {error message}",
  "error": "Bad Request"
}
```

