# Frontend Migration Guide: Metadata to Columns

## ⚠️ YES - Frontend Updates Required

Both the **Admin Panel** and **Mobile App** need to be updated to support the new API structure. This is a **breaking change**.

## Overview of Changes

### Request Body Changes
- ❌ **OLD**: Fields nested in `metadata` object
- ✅ **NEW**: All fields at top level

### Response Body Changes
- ❌ **OLD**: Fields nested in `metadata` object
- ✅ **NEW**: All fields at top level

### Field Name Changes
- `function` → `jobFunction` (jobs)
- `location` (object) → `locationLat`, `locationLong` (articles)
- `privateFilters` (object) → `privateFiltersCollege`, `privateFiltersCourse`, etc. (jobs)
- `date` → `articleDate` (articles)
- `category` → `articleCategory` (articles) or `mcqCategory` (MCQ)

### Enum Changes
- `jobType`: Now uses enum values: `'FULL_TIME'`, `'PART_TIME'`, `'CONTRACT'`, `'INTERNSHIP'`, `'FREELANCE'`
- `language`: Now uses enum: `'ENGLISH'` or `'HINDI'`

---

## 1. Article Creation/Update (Current Affairs & General Knowledge)

### ❌ OLD Request Format
```json
{
  "title": "Article Title",
  "description": "Article description",
  "language": "ENGLISH",
  "isPublished": true,
  "metadata": {
    "fullArticle": "Full article content...",
    "category": "Politics",
    "subCategoryId": "uuid-here",
    "subCategory": "Elections",
    "chapterId": "uuid-here",
    "section": "National",
    "country": "India",
    "headline": "Breaking News",
    "date": "2024-01-15",
    "location": {
      "lat": "28.6139",
      "long": "77.2090"
    },
    "state": "Delhi",
    "district": "New Delhi",
    "city": "New Delhi"
  }
}
```

### ✅ NEW Request Format
```json
{
  "title": "Article Title",
  "description": "Article description",
  "language": "ENGLISH",
  "isPublished": true,
  "fullArticle": "Full article content...",
  "articleCategory": "Politics",
  "subCategoryId": "uuid-here",
  "subCategory": "Elections",
  "chapterId": "uuid-here",
  "section": "National",
  "country": "India",
  "headline": "Breaking News",
  "articleDate": "2024-01-15",
  "locationLat": "28.6139",
  "locationLong": "77.2090",
  "state": "Delhi",
  "district": "New Delhi",
  "city": "New Delhi"
}
```

### Response Changes

#### ❌ OLD Response
```json
{
  "id": "uuid",
  "title": "Article Title",
  "description": "Description",
  "metadata": {
    "language": "ENGLISH",
    "isPublished": true,
    "fullArticle": "Full content...",
    "articleId": "uuid"
  }
}
```

#### ✅ NEW Response
```json
{
  "id": "uuid",
  "title": "Article Title",
  "description": "Description",
  "language": "ENGLISH",
  "isPublished": true,
  "fullArticle": "Full content...",
  "articleId": "uuid"
}
```

### Code Changes Required

**Admin Panel:**
```typescript
// OLD
const createArticle = async (data) => {
  return api.post('/admin/cms/current-affairs', {
    title: data.title,
    description: data.description,
    language: data.language,
    metadata: {
      fullArticle: data.fullArticle,
      category: data.category,
      subCategoryId: data.subCategoryId,
      // ... all other fields
    }
  });
};

// NEW
const createArticle = async (data) => {
  return api.post('/admin/cms/current-affairs', {
    title: data.title,
    description: data.description,
    language: data.language,
    fullArticle: data.fullArticle,
    articleCategory: data.category, // Note: renamed
    subCategoryId: data.subCategoryId,
    locationLat: data.location?.lat, // Note: flattened
    locationLong: data.location?.long, // Note: flattened
    articleDate: data.date, // Note: renamed
    // ... all other fields at top level
  });
};
```

**Mobile App:**
```typescript
// OLD - Reading article
const article = response.data;
const fullArticle = article.metadata?.fullArticle;
const language = article.metadata?.language;

// NEW - Reading article
const article = response.data;
const fullArticle = article.fullArticle;
const language = article.language;
```

---

## 2. Job Creation/Update

### ❌ OLD Request Format
```json
{
  "title": "Software Engineer",
  "description": "Job description",
  "postType": "JOB",
  "metadata": {
    "companyName": "Tech Corp",
    "industry": "Technology",
    "location": "Bangalore",
    "jobType": "Full-time",
    "function": "Engineering",
    "salaryMin": 500000,
    "salaryMax": 800000,
    "skills": ["JavaScript", "React"],
    "isPublic": true,
    "isPrivate": false,
    "privateFilters": {
      "selectCollege": "college-uuid",
      "selectCourse": "course-uuid",
      "selectYear": "3"
    }
  }
}
```

### ✅ NEW Request Format
```json
{
  "title": "Software Engineer",
  "description": "Job description",
  "postType": "JOB",
  "companyName": "Tech Corp",
  "industry": "Technology",
  "jobLocation": "Bangalore",
  "jobType": "FULL_TIME",
  "jobFunction": "Engineering",
  "salaryMin": 500000,
  "salaryMax": 800000,
  "skills": ["JavaScript", "React"],
  "isPublic": true,
  "isPrivate": false,
  "privateFiltersCollege": "college-uuid",
  "privateFiltersCourse": "course-uuid",
  "privateFiltersYear": "3"
}
```

### Field Name Changes
- `metadata.location` → `jobLocation`
- `metadata.jobType` → `jobType` (but enum values changed: `"Full-time"` → `"FULL_TIME"`)
- `metadata.function` → `jobFunction`
- `metadata.privateFilters.selectCollege` → `privateFiltersCollege`
- `metadata.privateFilters.selectCourse` → `privateFiltersCourse`
- `metadata.privateFilters.selectCourseCategory` → `privateFiltersCourseCategory`
- `metadata.privateFilters.selectYear` → `privateFiltersYear`

### Code Changes Required

**Admin Panel:**
```typescript
// OLD
const createJob = async (data) => {
  return api.post('/feeds', {
    title: data.title,
    description: data.description,
    postType: 'JOB',
    metadata: {
      companyName: data.companyName,
      location: data.location,
      jobType: data.jobType,
      function: data.function,
      privateFilters: {
        selectCollege: data.privateFilters?.selectCollege,
        selectCourse: data.privateFilters?.selectCourse,
      }
    }
  });
};

// NEW
const createJob = async (data) => {
  return api.post('/feeds', {
    title: data.title,
    description: data.description,
    postType: 'JOB',
    companyName: data.companyName,
    jobLocation: data.location, // Note: renamed
    jobType: mapJobTypeToEnum(data.jobType), // Note: enum conversion
    jobFunction: data.function, // Note: renamed
    privateFiltersCollege: data.privateFilters?.selectCollege, // Note: flattened
    privateFiltersCourse: data.privateFilters?.selectCourse, // Note: flattened
  });
};

// Helper function for job type enum conversion
const mapJobTypeToEnum = (oldValue: string) => {
  const mapping = {
    'Full-time': 'FULL_TIME',
    'Part-time': 'PART_TIME',
    'Contract': 'CONTRACT',
    'Internship': 'INTERNSHIP',
    'Freelance': 'FREELANCE',
  };
  return mapping[oldValue] || oldValue;
};
```

**Mobile App:**
```typescript
// OLD - Reading job
const job = response.data;
const companyName = job.metadata?.companyName;
const location = job.metadata?.location;
const jobType = job.metadata?.jobType;

// NEW - Reading job
const job = response.data;
const companyName = job.companyName;
const location = job.jobLocation; // Note: renamed
const jobType = job.jobType; // Note: enum value
```

---

## 3. MCQ Question Creation/Update

### ❌ OLD Request Format
```json
{
  "question": "What is the capital of India?",
  "options": [
    { "text": "Mumbai", "isCorrect": false },
    { "text": "Delhi", "isCorrect": true }
  ],
  "correctAnswer": 1,
  "categoryId": "uuid",
  "explanation": "Delhi is the capital",
  "questionImage": "https://...",
  "explanationImage": "https://...",
  "metadata": {
    "category": "Geography",
    "subCategoryId": "uuid",
    "chapterId": "uuid"
  }
}
```

### ✅ NEW Request Format
```json
{
  "question": "What is the capital of India?",
  "options": [
    { "text": "Mumbai", "isCorrect": false },
    { "text": "Delhi", "isCorrect": true }
  ],
  "correctAnswer": 1,
  "categoryId": "uuid",
  "explanation": "Delhi is the capital",
  "questionImage": "https://...",
  "explanationImage": "https://...",
  "mcqCategory": "Geography",
  "subCategoryId": "uuid",
  "chapterId": "uuid"
}
```

### Field Name Changes
- `metadata.category` → `mcqCategory`
- `questionImage` and `explanationImage` are now at top level (were in metadata)

### Code Changes Required

**Admin Panel:**
```typescript
// OLD
const createMcq = async (data) => {
  return api.post('/admin/cms/mcq/questions', {
    question: data.question,
    options: data.options,
    correctAnswer: data.correctAnswer,
    categoryId: data.categoryId,
    questionImage: data.questionImage,
    explanationImage: data.explanationImage,
    metadata: {
      category: data.category,
      subCategoryId: data.subCategoryId,
    }
  });
};

// NEW
const createMcq = async (data) => {
  return api.post('/admin/cms/mcq/questions', {
    question: data.question,
    options: data.options,
    correctAnswer: data.correctAnswer,
    categoryId: data.categoryId,
    questionImage: data.questionImage,
    explanationImage: data.explanationImage,
    mcqCategory: data.category, // Note: renamed
    subCategoryId: data.subCategoryId,
  });
};
```

---

## 4. Filtering Changes

### Job Filtering

**Admin Panel / API Calls:**
```typescript
// OLD - Filtering jobs (if done client-side)
const filteredJobs = jobs.filter(job => {
  return job.metadata?.isPublic === true && 
         job.metadata?.jobType === 'Full-time';
});

// NEW - Filtering jobs
const filteredJobs = jobs.filter(job => {
  return job.isPublic === true && 
         job.jobType === 'FULL_TIME'; // Note: enum value
});

// OLD - API filtering (if backend supported it)
// Backend used: metadata: { path: ['isPublic'], equals: true }

// NEW - API filtering
// Backend now uses: isPublic: true (direct column query)
```

---

## 5. General Knowledge Articles

### Special Field for GK Articles
- `articleType: "GENERAL_KNOWLEDGE"` must be set when creating GK articles
- This replaces the old `metadata.type: "GENERAL_KNOWLEDGE"`

**Code Change:**
```typescript
// OLD
const createGKArticle = async (data) => {
  return api.post('/admin/cms/general-knowledge', {
    title: data.title,
    description: data.description,
    metadata: {
      type: 'GENERAL_KNOWLEDGE',
      // ... other fields
    }
  });
};

// NEW
const createGKArticle = async (data) => {
  return api.post('/admin/cms/general-knowledge', {
    title: data.title,
    description: data.description,
    articleType: 'GENERAL_KNOWLEDGE', // Note: top level, not in metadata
    // ... other fields at top level
  });
};
```

---

## 6. Complete Field Mapping Reference

### Articles (Current Affairs & General Knowledge)

| Old Path | New Path | Notes |
|----------|----------|-------|
| `metadata.language` | `language` | Enum: `ENGLISH` or `HINDI` |
| `metadata.isPublished` | `isPublished` | Boolean |
| `metadata.fullArticle` | `fullArticle` | String |
| `metadata.category` | `articleCategory` | Renamed |
| `metadata.subCategoryId` | `subCategoryId` | Same |
| `metadata.subCategory` | `subCategory` | Same |
| `metadata.chapterId` | `chapterId` | Same |
| `metadata.section` | `section` | Same |
| `metadata.country` | `country` | Same |
| `metadata.headline` | `headline` | Same |
| `metadata.date` | `articleDate` | Renamed |
| `metadata.location.lat` | `locationLat` | Flattened |
| `metadata.location.long` | `locationLong` | Flattened |
| `metadata.state` | `state` | Same |
| `metadata.district` | `district` | Same |
| `metadata.city` | `city` | Same |
| `metadata.type` | `articleType` | For GK articles |

### Jobs

| Old Path | New Path | Notes |
|----------|----------|-------|
| `metadata.companyName` | `companyName` | Same |
| `metadata.industry` | `industry` | Same |
| `metadata.location` | `jobLocation` | Renamed |
| `metadata.jobType` | `jobType` | Enum values changed |
| `metadata.function` | `jobFunction` | Renamed |
| `metadata.salaryMin` | `salaryMin` | Same |
| `metadata.salaryMax` | `salaryMax` | Same |
| `metadata.skills` | `skills` | Same (array) |
| `metadata.isPublic` | `isPublic` | Same |
| `metadata.isPrivate` | `isPrivate` | Same |
| `metadata.privateFilters.selectCollege` | `privateFiltersCollege` | Flattened |
| `metadata.privateFilters.selectCourse` | `privateFiltersCourse` | Flattened |
| `metadata.privateFilters.selectCourseCategory` | `privateFiltersCourseCategory` | Flattened |
| `metadata.privateFilters.selectYear` | `privateFiltersYear` | Flattened |

### MCQ Questions

| Old Path | New Path | Notes |
|----------|----------|-------|
| `metadata.category` | `mcqCategory` | Renamed |
| `metadata.subCategory` | `subCategory` | Same |
| `metadata.subCategoryId` | `subCategoryId` | Same |
| `metadata.chapterId` | `chapterId` | Same |
| `metadata.section` | `section` | Same |
| `metadata.country` | `country` | Same |
| `metadata.questionImage` | `questionImage` | Moved to top level |
| `metadata.explanationImage` | `explanationImage` | Moved to top level |

---

## 7. Migration Checklist

### Admin Panel
- [ ] Update article creation form (Current Affairs)
- [ ] Update article creation form (General Knowledge)
- [ ] Update article edit form
- [ ] Update article display/read view
- [ ] Update job creation form
- [ ] Update job edit form
- [ ] Update job display/read view
- [ ] Update MCQ creation form
- [ ] Update MCQ edit form
- [ ] Update all API service functions
- [ ] Update TypeScript interfaces/types
- [ ] Update form validation
- [ ] Update job type dropdown (enum values)
- [ ] Update language dropdown (enum values)
- [ ] Test all create operations
- [ ] Test all update operations
- [ ] Test all read/display operations

### Mobile App
- [ ] Update article reading/display
- [ ] Update job listing/display
- [ ] Update MCQ display
- [ ] Update TypeScript interfaces/types
- [ ] Update API response parsing
- [ ] Remove metadata extraction logic
- [ ] Test article reading
- [ ] Test job browsing
- [ ] Test MCQ questions

---

## 8. Backward Compatibility

⚠️ **No backward compatibility** - The API changes are breaking. Both frontends must be updated before deploying the backend changes.

### Recommended Deployment Strategy

1. **Option A: Coordinated Deployment**
   - Update frontend code first
   - Deploy frontend
   - Deploy backend
   - Test end-to-end

2. **Option B: Feature Flag (if possible)**
   - Add feature flag to support both old and new format
   - Deploy backend with dual support
   - Update frontend
   - Remove old format support

3. **Option C: Gradual Migration**
   - Keep metadata field populated during transition
   - Frontend reads from both locations (metadata and columns)
   - Frontend writes to columns only
   - After validation, remove metadata reading

---

## 9. Testing Checklist

### Admin Panel Testing
- [ ] Create Current Affairs article with all fields
- [ ] Create General Knowledge article with all fields
- [ ] Update article and verify all fields save
- [ ] Create job with all fields including private filters
- [ ] Update job and verify all fields save
- [ ] Create MCQ with images and categorization
- [ ] Filter jobs by type, industry, function
- [ ] Verify language enum works correctly
- [ ] Verify job type enum works correctly

### Mobile App Testing
- [ ] Read Current Affairs article
- [ ] Read General Knowledge article
- [ ] Browse jobs
- [ ] Filter jobs
- [ ] View MCQ questions
- [ ] Verify all fields display correctly

---

## 10. Common Issues & Solutions

### Issue: "Field X is not allowed" error
**Solution**: Field is now at top level, not in metadata object

### Issue: Job type not saving
**Solution**: Use enum values: `FULL_TIME`, `PART_TIME`, etc. (not `"Full-time"`)

### Issue: Location not saving
**Solution**: Use `locationLat` and `locationLong` separately (not `location` object)

### Issue: Private filters not working
**Solution**: Use flattened fields: `privateFiltersCollege`, `privateFiltersCourse`, etc.

### Issue: Language not saving
**Solution**: Use enum values: `ENGLISH` or `HINDI` (uppercase)

---

## Summary

**Critical Changes:**
1. ✅ Remove all `metadata` object wrapping
2. ✅ Move all fields to top level
3. ✅ Update field names (see mapping table)
4. ✅ Update enum values (jobType, language)
5. ✅ Flatten nested objects (location, privateFilters)
6. ✅ Update response parsing (read from top level, not metadata)

**Estimated Effort:**
- Admin Panel: 2-3 days
- Mobile App: 1-2 days
- Testing: 1-2 days
- **Total: 4-7 days**

This is a significant change but will result in cleaner, more maintainable code and better performance.

