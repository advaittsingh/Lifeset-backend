-- ============================================
-- COURSE CREATION SQL QUERIES FOR NEON DB
-- ============================================

-- ============================================
-- STEP 1: FIND EXISTING DATA (Run these first to get valid IDs)
-- ============================================

-- Get all Colleges/Institutes (to find collegeId)
SELECT id, name, city, state 
FROM "College" 
WHERE "isActive" = true 
ORDER BY name;

-- Get all Course Categories (to find categoryId)
SELECT id, name, description 
FROM "CourseCategory" 
ORDER BY name;

-- Get all Awarded (to find awardedId for specialisation)
SELECT id, name, "courseCategoryId" 
FROM "Awarded" 
WHERE "isActive" = true 
ORDER BY name;

-- Get all Specialisations (to find specialisationId)
SELECT s.id, s.name, s."awardedId", a.name as "awardedName"
FROM "Specialisation" s
JOIN "Awarded" a ON s."awardedId" = a.id
WHERE s."isActive" = true
ORDER BY s.name;

-- ============================================
-- STEP 2: INSERT COURSE (Basic - Only Required Fields)
-- ============================================

-- Minimum required: name and collegeId
INSERT INTO "Course" (
    "id",
    "name",
    "collegeId",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid(),  -- Auto-generate UUID
    'Bachelor of Computer Science',  -- Course name (REQUIRED)
    'cd156cec-a175-4024-b0d7-a6a5574c4b0c',  -- Replace with actual collegeId from Step 1
    true,  -- isActive (default: true)
    NOW(),  -- createdAt
    NOW()   -- updatedAt
);

-- ============================================
-- STEP 3: INSERT COURSE (Complete - With All Optional Fields)
-- ============================================

INSERT INTO "Course" (
    "id",
    "name",
    "code",
    "collegeId",
    "categoryId",
    "specialisationId",
    "duration",
    "description",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid(),  -- Auto-generate UUID
    'Bachelor of Computer Science',  -- Course name (REQUIRED)
    'BCS001',  -- Course code (optional)
    'cd156cec-a175-4024-b0d7-a6a5574c4b0c',  -- collegeId (REQUIRED if using collegeId)
    NULL,  -- categoryId (optional - get from CourseCategory table)
    NULL,  -- specialisationId (optional - get from Specialisation table)
    '3 years',  -- duration (optional)
    'A comprehensive program covering computer science fundamentals, programming, algorithms, and software engineering.',  -- description (optional)
    true,  -- isActive (default: true)
    NOW(),  -- createdAt
    NOW()   -- updatedAt
);

-- ============================================
-- STEP 4: INSERT COURSE WITH CATEGORY AND SPECIALISATION
-- ============================================

-- Example with category and specialisation
INSERT INTO "Course" (
    "id",
    "name",
    "code",
    "collegeId",
    "categoryId",
    "specialisationId",
    "duration",
    "description",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid(),
    'Master of Business Administration',
    'MBA001',
    'cd156cec-a175-4024-b0d7-a6a5574c4b0c',  -- Replace with your collegeId
    'your-category-id-here',  -- Replace with categoryId from CourseCategory
    'your-specialisation-id-here',  -- Replace with specialisationId from Specialisation
    '2 years',
    'Advanced business management program focusing on leadership and strategy.',
    true,
    NOW(),
    NOW()
);

-- ============================================
-- DATABASE HIERARCHY EXPLANATION
-- ============================================

/*
COURSE HIERARCHY STRUCTURE:

1. College (Institute)
   └── Has many Courses
       └── Course belongs to College (via collegeId)

2. CourseCategory (e.g., "Engineering", "Business", "Arts")
   └── Has many Awarded
       └── Awarded has many Specialisations
           └── Specialisation can be linked to Course (via specialisationId)

3. Course can optionally link to:
   - College (via collegeId) - REQUIRED if you want to link to an institute
   - CourseCategory (via categoryId) - OPTIONAL
   - Specialisation (via specialisationId) - OPTIONAL

RELATIONSHIPS:
- Course → College (many-to-one via collegeId)
- Course → CourseCategory (many-to-one via categoryId) 
- Course → Specialisation (many-to-one via specialisationId)
- CourseCategory → Awarded (one-to-many)
- Awarded → Specialisation (one-to-many)

IMPORTANT NOTES:
- collegeId is OPTIONAL in schema but typically REQUIRED for your use case
- categoryId is OPTIONAL
- specialisationId is OPTIONAL
- name is REQUIRED
- All other fields are optional
*/

-- ============================================
-- QUICK REFERENCE: Field Types
-- ============================================

/*
Course Table Fields:
- id: UUID (auto-generated with gen_random_uuid())
- name: TEXT (REQUIRED)
- code: TEXT (optional)
- collegeId: UUID (optional, but needed to link to institute)
- collegeProfileId: UUID (optional, alternative to collegeId)
- categoryId: UUID (optional, links to CourseCategory)
- specialisationId: UUID (optional, links to Specialisation)
- duration: TEXT (optional, e.g., "3 years", "4 semesters")
- description: TEXT (optional)
- isActive: BOOLEAN (default: true)
- createdAt: TIMESTAMP (use NOW())
- updatedAt: TIMESTAMP (use NOW())
*/

-- ============================================
-- VERIFY YOUR INSERT
-- ============================================

-- Check if course was created successfully
SELECT 
    c.id,
    c.name,
    c.code,
    c."collegeId",
    col.name as "collegeName",
    c."categoryId",
    cat.name as "categoryName",
    c."specialisationId",
    s.name as "specialisationName",
    c.duration,
    c."isActive",
    c."createdAt"
FROM "Course" c
LEFT JOIN "College" col ON c."collegeId" = col.id
LEFT JOIN "CourseCategory" cat ON c."categoryId" = cat.id
LEFT JOIN "Specialisation" s ON c."specialisationId" = s.id
WHERE c."collegeId" = 'cd156cec-a175-4024-b0d7-a6a5574c4b0c'  -- Replace with your collegeId
ORDER BY c."createdAt" DESC;

