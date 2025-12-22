# API Endpoints for Categories, Subcategories, and Chapters

## Overview

These endpoints allow the mobile app to display the hierarchical structure of General Knowledge content:
- **Categories** (Parent/Level 1)
- **Subcategories** (Level 2)
- **Chapters** (Level 3 / Sections)

All endpoints are **public** (no authentication required) and return data in a mobile-friendly format.

---

## Base URL

```
https://lifeset-backend.vercel.app/api/v1/cms
```

---

## 1. Get All Categories (Parent Categories)

Get all top-level categories for General Knowledge.

### Endpoint
```
GET /cms/general-knowledge/categories
```

### Authentication
❌ **Public** - No authentication required

### Response Format
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "string",
        "name": "string",
        "description": "string | null",
        "isActive": true,
        "postCount": 0,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 15
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example Response
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "971fc33b-e2ac-4b78-aa11-142daf19f5bc",
        "name": "Indian History",
        "description": "Comprehensive coverage of Indian History from ancient to modern...",
        "isActive": true,
        "postCount": 0,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "a26d22f0-fe4d-494b-84d8-5621954b4015",
        "name": "Indian Geography",
        "description": "Indian Geography studies India's physical features...",
        "isActive": true,
        "postCount": 0,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 15
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Usage Example
```javascript
// React Native / JavaScript
const response = await fetch('https://lifeset-backend.vercel.app/api/v1/cms/general-knowledge/categories');
const result = await response.json();
const categories = result.data.data;
```

---

## 2. Get Subcategories for a Category

Get all subcategories (Level 2) for a specific category.

### Endpoint
```
GET /cms/general-knowledge/categories/:categoryId/subcategories
```

### Parameters
- `categoryId` (path parameter, required) - The ID of the parent category

### Authentication
❌ **Public** - No authentication required

### Response Format
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "string",
        "name": "string",
        "description": "string | null",
        "parentCategoryId": "string",
        "isActive": true,
        "categoryFor": "string | null",
        "postCount": 0,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 3
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example Request
```
GET /cms/general-knowledge/categories/971fc33b-e2ac-4b78-aa11-142daf19f5bc/subcategories
```

### Example Response
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "abc123...",
        "name": "Ancient History",
        "description": "Covers ancient Indian civilization...",
        "parentCategoryId": "971fc33b-e2ac-4b78-aa11-142daf19f5bc",
        "isActive": true,
        "categoryFor": null,
        "postCount": 0,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "def456...",
        "name": "Medieval History",
        "description": "Covers medieval period...",
        "parentCategoryId": "971fc33b-e2ac-4b78-aa11-142daf19f5bc",
        "isActive": true,
        "categoryFor": null,
        "postCount": 0,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 3
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Usage Example
```javascript
const categoryId = "971fc33b-e2ac-4b78-aa11-142daf19f5bc";
const response = await fetch(
  `https://lifeset-backend.vercel.app/api/v1/cms/general-knowledge/categories/${categoryId}/subcategories`
);
const result = await response.json();
const subcategories = result.data.data;
```

---

## 3. Get Chapters (Sections) for a Subcategory

Get all chapters (Level 3 / Sections) for a specific subcategory.

### Endpoint
```
GET /cms/general-knowledge/subcategories/:subCategoryId/sections
```

### Parameters
- `subCategoryId` (path parameter, required) - The ID of the subcategory

### Authentication
❌ **Public** - No authentication required

### Response Format
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "string",
        "name": "string",
        "description": "string | null",
        "subCategoryId": "string",
        "isActive": true,
        "order": 0,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 10
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example Request
```
GET /cms/general-knowledge/subcategories/abc123.../sections
```

### Example Response
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "chapter-1-id",
        "name": "Indus Valley Civilization",
        "description": "Details about Indus Valley Civilization...",
        "subCategoryId": "abc123...",
        "isActive": true,
        "order": 1,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "chapter-2-id",
        "name": "Vedic Period",
        "description": "Details about Vedic Period...",
        "subCategoryId": "abc123...",
        "isActive": true,
        "order": 2,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 10
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Usage Example
```javascript
const subCategoryId = "abc123...";
const response = await fetch(
  `https://lifeset-backend.vercel.app/api/v1/cms/general-knowledge/subcategories/${subCategoryId}/sections`
);
const result = await response.json();
const chapters = result.data.data;
```

---

## Complete Flow Example

Here's how to fetch the complete hierarchy:

```javascript
// Step 1: Get all categories
const categoriesResponse = await fetch(
  'https://lifeset-backend.vercel.app/api/v1/cms/general-knowledge/categories'
);
const categoriesData = await categoriesResponse.json();
const categories = categoriesData.data.data;

// Step 2: For each category, get subcategories
for (const category of categories) {
  const subcategoriesResponse = await fetch(
    `https://lifeset-backend.vercel.app/api/v1/cms/general-knowledge/categories/${category.id}/subcategories`
  );
  const subcategoriesData = await subcategoriesResponse.json();
  category.subcategories = subcategoriesData.data.data;

  // Step 3: For each subcategory, get chapters
  for (const subcategory of category.subcategories) {
    const chaptersResponse = await fetch(
      `https://lifeset-backend.vercel.app/api/v1/cms/general-knowledge/subcategories/${subcategory.id}/sections`
    );
    const chaptersData = await chaptersResponse.json();
    subcategory.chapters = chaptersData.data.data;
  }
}

// Now you have the complete hierarchy:
// categories[].subcategories[].chapters[]
```

---

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Category with ID {categoryId} not found",
  "error": "Not Found"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Database connection error. Please check DATABASE_URL environment variable.",
  "error": "Bad Request"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Failed to get categories: {error message}",
  "error": "Internal Server Error"
}
```

---

## Notes

1. **All endpoints are public** - No authentication token required
2. **Data is sorted** - Categories and subcategories are sorted alphabetically by name
3. **Only active items** - Only `isActive: true` items are returned
4. **Chapters are ordered** - Chapters include an `order` field for custom sorting
5. **Post counts** - Categories include `postCount` showing number of posts in that category
6. **Empty arrays** - If no subcategories/chapters exist, an empty array is returned (not an error)

---

## Mobile App Implementation Tips

1. **Cache the data** - Categories don't change frequently, so cache them locally
2. **Lazy load** - Load subcategories and chapters only when user expands a category
3. **Handle empty states** - Show appropriate UI when `count: 0`
4. **Error handling** - Always handle 404 and 400 errors gracefully
5. **Loading states** - Show loading indicators while fetching data

---

## Quick Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/cms/general-knowledge/categories` | GET | ❌ | Get all parent categories |
| `/cms/general-knowledge/categories/:categoryId/subcategories` | GET | ❌ | Get subcategories for a category |
| `/cms/general-knowledge/subcategories/:subCategoryId/sections` | GET | ❌ | Get chapters for a subcategory |

