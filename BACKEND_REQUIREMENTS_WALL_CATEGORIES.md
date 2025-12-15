# Backend Requirements for Wall Categories

## Overview
The frontend expects the backend to properly handle parent-child relationships for wall categories. Currently, the frontend has client-side filtering as a fallback, but the backend should handle this correctly for optimal performance.

## Database Schema Requirements

### Wall Categories Table
The `wall_categories` table (or equivalent) should have:

```sql
- id: UUID (Primary Key)
- name: VARCHAR (Required)
- description: TEXT (Optional)
- categoryFor: VARCHAR (Optional) - e.g., "Posts", "Events", "Jobs"
- parentCategoryId: UUID (Nullable, Foreign Key to wall_categories.id)
  - NULL = Parent category
  - UUID = Sub-category (references parent category)
- isActive: BOOLEAN (Default: true)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

**Important**: 
- `parentCategoryId` must be nullable
- When `parentCategoryId` is NULL, it's a parent category
- When `parentCategoryId` has a value, it's a sub-category linked to that parent

## API Endpoints Requirements

### 1. GET /api/v1/admin/wall-categories

**Default behavior (no query params)**: Return ONLY parent categories
- Filter: `WHERE parentCategoryId IS NULL`
- Response format:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "General Knowledge",
      "description": "GK category",
      "parentCategoryId": null,
      "categoryFor": "Posts",
      "isActive": true,
      "postCount": 10,
      "subCategoryCount": 3,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**With query parameter `?parentId=uuid-1`**: Return sub-categories for that parent
- Filter: `WHERE parentCategoryId = :parentId`
- Response format:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-2",
      "name": "History",
      "description": "History sub-category",
      "parentCategoryId": "uuid-1",
      "categoryFor": "Posts",
      "isActive": true,
      "postCount": 5,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**With query parameter `?onlyParents=false`**: Return all categories (parents + sub-categories)
- No filter on parentCategoryId

**With query parameter `?categoryFor=Posts`**: Filter by categoryFor
- Can be combined with other filters

### 2. POST /api/v1/admin/wall-categories

**Create Parent Category**:
```json
{
  "name": "General Knowledge",
  "description": "GK category",
  "categoryFor": "Posts",
  "parentCategoryId": null,  // MUST be null for parent
  "isActive": true
}
```

**Create Sub-Category**:
```json
{
  "name": "History",
  "description": "History sub-category",
  "categoryFor": "Posts",
  "parentCategoryId": "uuid-1",  // Parent category ID
  "isActive": true
}
```

**Validation**:
- If `parentCategoryId` is provided (not null), verify that the parent category exists
- If `parentCategoryId` is null, create as parent category
- Ensure `parentCategoryId` cannot reference itself (circular reference)

### 3. PUT /api/v1/admin/wall-categories/:id

Update category. Should handle:
- Updating `parentCategoryId` (e.g., moving a sub-category to a different parent)
- Prevent circular references
- If changing a parent to a sub-category, ensure it has no sub-categories itself

### 4. DELETE /api/v1/admin/wall-categories/:id

Delete category. Should:
- If deleting a parent category: Optionally cascade delete sub-categories OR prevent deletion if sub-categories exist
- If deleting a sub-category: Check if it has associated posts/content
- Return appropriate error if category cannot be deleted

## Response Fields

Each category object should include:
- `id`: UUID
- `name`: String
- `description`: String (nullable)
- `categoryFor`: String (nullable)
- `parentCategoryId`: UUID (nullable) - **Critical field**
- `isActive`: Boolean
- `postCount`: Number (count of posts in this category)
- `subCategoryCount`: Number (for parent categories only - count of sub-categories)
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

## Critical Backend Changes Needed

1. **Database Migration**:
   - Ensure `parentCategoryId` column exists and is nullable
   - Add foreign key constraint: `FOREIGN KEY (parentCategoryId) REFERENCES wall_categories(id)`
   - Add index on `parentCategoryId` for faster queries

2. **GET Endpoint Filtering**:
   - Default: `WHERE parentCategoryId IS NULL` (only parents)
   - With `parentId` param: `WHERE parentCategoryId = :parentId` (sub-categories)
   - **Currently, the API might be returning all categories regardless of filter**

3. **POST Endpoint**:
   - Accept `parentCategoryId` in request body
   - If `parentCategoryId` is null → create parent
   - If `parentCategoryId` is provided → create sub-category and validate parent exists
   - **Ensure the value is actually stored in the database**

4. **Response Format**:
   - Always include `parentCategoryId` in response (even if null)
   - Include `subCategoryCount` for parent categories
   - Ensure consistent response structure

5. **Query Optimization**:
   - Use proper SQL queries with WHERE clauses
   - Don't fetch all categories and filter in application code
   - Use database indexes for performance

## Testing Checklist

- [ ] GET `/admin/wall-categories` returns only parent categories (parentCategoryId = null)
- [ ] GET `/admin/wall-categories?parentId=xxx` returns only sub-categories for that parent
- [ ] POST with `parentCategoryId: null` creates a parent category
- [ ] POST with `parentCategoryId: "uuid"` creates a sub-category linked to parent
- [ ] Sub-categories don't appear in default GET response
- [ ] Parent categories don't appear when querying with parentId
- [ ] `parentCategoryId` is correctly stored and returned in responses
- [ ] `subCategoryCount` is calculated and returned for parent categories

## Current Issues (Based on Frontend Behavior)

1. **Sub-categories appearing in main list**: The default GET endpoint is likely returning all categories instead of filtering by `parentCategoryId IS NULL`

2. **Sub-categories not appearing in detail page**: The GET with `parentId` parameter might not be filtering correctly, or the `parentCategoryId` field might not be stored/returned properly

3. **Data storage**: Ensure `parentCategoryId` is actually being saved to the database when creating sub-categories

## Recommended Backend Implementation

```javascript
// Example Node.js/Express implementation

// GET /admin/wall-categories
router.get('/admin/wall-categories', async (req, res) => {
  const { parentId, onlyParents, categoryFor } = req.query;
  
  let query = db('wall_categories');
  
  // Default: only parent categories
  if (!parentId && onlyParents !== 'false') {
    query = query.whereNull('parentCategoryId');
  }
  
  // Filter by parentId (get sub-categories)
  if (parentId) {
    query = query.where('parentCategoryId', parentId);
  }
  
  // Filter by categoryFor
  if (categoryFor) {
    query = query.where('categoryFor', categoryFor);
  }
  
  const categories = await query.select('*');
  
  // Add subCategoryCount for parent categories
  const categoriesWithCounts = await Promise.all(
    categories.map(async (cat) => {
      if (!cat.parentCategoryId) {
        const subCount = await db('wall_categories')
          .where('parentCategoryId', cat.id)
          .count('* as count')
          .first();
        cat.subCategoryCount = parseInt(subCount.count);
      }
      return cat;
    })
  );
  
  res.json({ success: true, data: categoriesWithCounts });
});

// POST /admin/wall-categories
router.post('/admin/wall-categories', async (req, res) => {
  const { name, description, categoryFor, parentCategoryId, isActive } = req.body;
  
  // Validate parent exists if parentCategoryId is provided
  if (parentCategoryId) {
    const parent = await db('wall_categories')
      .where('id', parentCategoryId)
      .whereNull('parentCategoryId') // Ensure it's a parent, not a sub-category
      .first();
    
    if (!parent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parent category not found or is not a parent category' 
      });
    }
  }
  
  const [category] = await db('wall_categories')
    .insert({
      name,
      description,
      categoryFor,
      parentCategoryId: parentCategoryId || null, // Explicitly set to null if not provided
      isActive: isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning('*');
  
  res.json({ success: true, data: category });
});
```

## Summary

The backend needs to:
1. ✅ Store `parentCategoryId` correctly (null for parents, UUID for sub-categories)
2. ✅ Filter GET requests properly (default = parents only, with parentId = sub-categories only)
3. ✅ Return `parentCategoryId` in all responses
4. ✅ Validate parent exists when creating sub-categories
5. ✅ Calculate and return `subCategoryCount` for parent categories

The frontend currently has client-side filtering as a fallback, but proper backend filtering will improve performance and reliability.

