# Backend Requirements for Performance Meter & User Badge System

## Overview
This document outlines the backend API endpoints and database schema needed to support the Performance Meter and User Badge features.

---

## 1. Database Schema

### 1.1 Daily Digest Engagement Table
```sql
CREATE TABLE daily_digest_engagement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL, -- Can reference current_affairs, general_knowledge, mcq_questions, etc.
  card_type VARCHAR(50) NOT NULL, -- 'CURRENT_AFFAIRS', 'GENERAL_KNOWLEDGE', 'MCQ', 'PERSONALITY', 'SKILL_TRAINING'
  engagement_type VARCHAR(50) NOT NULL, -- 'CARD_VIEW', 'MCQ_ATTEMPT'
  duration INTEGER DEFAULT 0, -- Duration in seconds (for CARD_VIEW)
  is_correct BOOLEAN DEFAULT NULL, -- For MCQ_ATTEMPT: true/false, for CARD_VIEW: null
  date DATE NOT NULL, -- Date of engagement (YYYY-MM-DD)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_user_date (user_id, date),
  INDEX idx_user_card_date (user_id, card_id, date)
);
```

### 1.2 Daily Engagement Status Table
```sql
CREATE TABLE daily_engagement_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_present BOOLEAN DEFAULT FALSE, -- True if user met engagement criteria for the day
  card_view_count INTEGER DEFAULT 0, -- Number of cards viewed for 20+ seconds
  mcq_attempt_count INTEGER DEFAULT 0, -- Number of MCQ attempts
  mcq_correct_count INTEGER DEFAULT 0, -- Number of correct MCQ answers
  mcq_accuracy DECIMAL(5,2) DEFAULT 0.00, -- MCQ accuracy percentage
  total_engagement_duration INTEGER DEFAULT 0, -- Total seconds spent
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, date),
  INDEX idx_user_date (user_id, date),
  INDEX idx_user_date_present (user_id, date, is_present)
);
```

### 1.3 User Badge Status Table
```sql
CREATE TABLE user_badge_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_badge VARCHAR(50) DEFAULT NULL, -- 'rookie', 'explorer', 'adventurer', 'elite', 'champion', 'legend'
  days_active INTEGER DEFAULT 0, -- Days active in last 6 months
  last_calculated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id),
  INDEX idx_user (user_id)
);
```

---

## 2. API Endpoints

### 2.1 Track Daily Digest Engagement
**Endpoint:** `POST /performance/daily-digest/engagement`

**Request Body:**
```json
{
  "cardId": "uuid-string",
  "duration": 25, // seconds (for CARD_VIEW)
  "type": "CARD_VIEW" | "MCQ_ATTEMPT",
  "date": "2024-01-15", // YYYY-MM-DD format
  "isComplete": true // For CARD_VIEW: true if duration >= 20, For MCQ_ATTEMPT: true/false (isCorrect)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "engagementRecorded": true
  }
}
```

**Logic:**
1. Insert record into `daily_digest_engagement` table
2. If `type === 'CARD_VIEW'` and `duration >= 20`:
   - Update `daily_engagement_status` for that date:
     - Increment `card_view_count`
     - Add `duration` to `total_engagement_duration`
     - Recalculate `is_present` status
3. If `type === 'MCQ_ATTEMPT'`:
   - Update `daily_engagement_status` for that date:
     - Increment `mcq_attempt_count`
     - If `isComplete === true`, increment `mcq_correct_count`
     - Recalculate `mcq_accuracy = (mcq_correct_count / mcq_attempt_count) * 100`
     - Recalculate `is_present` status

**Daily "Present" Criteria:**
A user is marked "Present" (`is_present = true`) if:
- `card_view_count >= 1` (at least one card viewed for 20+ seconds), OR
- `mcq_attempt_count >= 1` AND `mcq_accuracy >= 50`

---

### 2.2 Get Weekly Performance Meter
**Endpoint:** `GET /performance/weekly-meter`

**Query Parameters:**
- `userId` (required): UUID of the user

**Response:**
```json
{
  "success": true,
  "data": {
    "daysCompleted": 5, // Number of days marked as "Present" in last 7 days (0-7)
    "days": [
      {
        "date": "2024-01-15",
        "isPresent": true,
        "completed": true, // Same as isPresent
        "cardViewCount": 3,
        "mcqAttemptCount": 5,
        "mcqAccuracy": 80.0
      },
      {
        "date": "2024-01-14",
        "isPresent": false,
        "completed": false,
        "cardViewCount": 0,
        "mcqAttemptCount": 0,
        "mcqAccuracy": 0.0
      }
      // ... 5 more days (last 7 days total)
    ]
  }
}
```

**Logic:**
1. Get last 7 days (including today) from `daily_engagement_status` table
2. For each day, check if `is_present = true`
3. Count total days with `is_present = true` → `daysCompleted`
4. Return array of last 7 days with their status

**SQL Query Example:**
```sql
SELECT 
  date,
  is_present as "isPresent",
  is_present as completed,
  card_view_count as "cardViewCount",
  mcq_attempt_count as "mcqAttemptCount",
  mcq_accuracy as "mcqAccuracy"
FROM daily_engagement_status
WHERE user_id = $1
  AND date >= CURRENT_DATE - INTERVAL '6 days'
  AND date <= CURRENT_DATE
ORDER BY date DESC;
```

---

### 2.3 Get User Badge Status
**Endpoint:** `GET /performance/badge-status`

**Query Parameters:**
- `userId` (required): UUID of the user

**Response:**
```json
{
  "success": true,
  "data": {
    "currentBadge": "elite", // 'rookie', 'explorer', 'adventurer', 'elite', 'champion', 'legend', or null
    "daysActive": 125 // Number of active days in last 6 months
  }
}
```

**Logic:**
1. Calculate `daysActive`: Count distinct dates from `daily_engagement_status` where:
   - `is_present = true`
   - `date >= CURRENT_DATE - INTERVAL '6 months'`
   - `date <= CURRENT_DATE`
2. Determine `currentBadge` based on `daysActive`:
   - `daysActive >= 180` → `'legend'`
   - `daysActive >= 150` → `'champion'`
   - `daysActive >= 120` → `'elite'`
   - `daysActive >= 90` → `'adventurer'`
   - `daysActive >= 60` → `'explorer'`
   - `daysActive >= 30` → `'rookie'`
   - `daysActive < 30` → `null`
3. Update or insert record in `user_badge_status` table
4. Return current badge and days active

**SQL Query Example:**
```sql
-- Count active days in last 6 months
SELECT COUNT(DISTINCT date) as days_active
FROM daily_engagement_status
WHERE user_id = $1
  AND is_present = true
  AND date >= CURRENT_DATE - INTERVAL '6 months'
  AND date <= CURRENT_DATE;

-- Update badge status
INSERT INTO user_badge_status (user_id, current_badge, days_active, last_calculated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id)
DO UPDATE SET
  current_badge = EXCLUDED.current_badge,
  days_active = EXCLUDED.days_active,
  last_calculated_at = NOW(),
  updated_at = NOW();
```

---

## 3. Background Jobs / Scheduled Tasks

### 3.1 Daily Engagement Calculation Job
**Schedule:** Run daily at midnight (00:00) or after all engagement data is collected

**Purpose:** Recalculate `is_present` status for all users for the previous day

**Logic:**
1. For each user, get all engagement records from `daily_digest_engagement` for yesterday
2. Calculate:
   - Total cards viewed for 20+ seconds
   - Total MCQ attempts
   - Total correct MCQ answers
   - MCQ accuracy percentage
3. Determine if user qualifies as "Present":
   - If `card_view_count >= 1` OR (`mcq_attempt_count >= 1` AND `mcq_accuracy >= 50`)
4. Update `daily_engagement_status` table

**SQL Example:**
```sql
-- Calculate engagement for a specific user and date
WITH engagement_stats AS (
  SELECT 
    COUNT(CASE WHEN engagement_type = 'CARD_VIEW' AND duration >= 20 THEN 1 END) as card_views,
    COUNT(CASE WHEN engagement_type = 'MCQ_ATTEMPT' THEN 1 END) as mcq_attempts,
    COUNT(CASE WHEN engagement_type = 'MCQ_ATTEMPT' AND is_correct = true THEN 1 END) as mcq_correct,
    SUM(CASE WHEN engagement_type = 'CARD_VIEW' THEN duration ELSE 0 END) as total_duration
  FROM daily_digest_engagement
  WHERE user_id = $1 AND date = $2
)
INSERT INTO daily_engagement_status (
  user_id, date, is_present, card_view_count, mcq_attempt_count, 
  mcq_correct_count, mcq_accuracy, total_engagement_duration
)
SELECT 
  $1,
  $2,
  CASE 
    WHEN card_views >= 1 THEN true
    WHEN mcq_attempts >= 1 AND (mcq_correct::DECIMAL / NULLIF(mcq_attempts, 0)) >= 0.5 THEN true
    ELSE false
  END as is_present,
  card_views,
  mcq_attempts,
  mcq_correct,
  CASE 
    WHEN mcq_attempts > 0 THEN (mcq_correct::DECIMAL / mcq_attempts) * 100
    ELSE 0
  END as mcq_accuracy,
  total_duration
FROM engagement_stats
ON CONFLICT (user_id, date)
DO UPDATE SET
  is_present = EXCLUDED.is_present,
  card_view_count = EXCLUDED.card_view_count,
  mcq_attempt_count = EXCLUDED.mcq_attempt_count,
  mcq_correct_count = EXCLUDED.mcq_correct_count,
  mcq_accuracy = EXCLUDED.mcq_accuracy,
  total_engagement_duration = EXCLUDED.total_engagement_duration,
  updated_at = NOW();
```

---

## 4. Badge Tier Definitions

```javascript
const BADGE_TIERS = [
  { id: 'rookie', name: 'Rookie', daysRequired: 30 },
  { id: 'explorer', name: 'Explorer', daysRequired: 60 },
  { id: 'adventurer', name: 'Adventurer', daysRequired: 90 },
  { id: 'elite', name: 'Elite', daysRequired: 120 },
  { id: 'champion', name: 'Champion', daysRequired: 150 },
  { id: 'legend', name: 'Legend', daysRequired: 180 },
];
```

---

## 5. Implementation Notes

### 5.1 Real-time Updates
- When engagement is tracked via `POST /performance/daily-digest/engagement`, immediately update `daily_engagement_status` for that date
- This ensures the Performance Meter updates in real-time without waiting for a background job

### 5.2 Performance Optimization
- Add indexes on `(user_id, date)` for both `daily_digest_engagement` and `daily_engagement_status`
- Consider caching badge status for frequently accessed users
- Use database views or materialized views for weekly performance calculations

### 5.3 Data Consistency
- Ensure `daily_engagement_status` is always kept in sync with `daily_digest_engagement`
- Use database transactions when updating engagement status
- Consider using database triggers to automatically update `daily_engagement_status` when new engagement records are inserted

### 5.4 Edge Cases
- Handle timezone differences (store dates in UTC, convert to user's timezone when displaying)
- Handle users who haven't engaged yet (return 0 days completed, null badge)
- Handle partial days (if engagement happens on current day, include it in calculations)

---

## 6. Testing Checklist

- [ ] Track card view engagement (20+ seconds)
- [ ] Track MCQ attempt with correct answer
- [ ] Track MCQ attempt with incorrect answer
- [ ] Calculate daily "Present" status correctly
- [ ] Weekly performance meter returns correct last 7 days
- [ ] Badge status updates correctly based on 6-month activity
- [ ] Handle users with no engagement history
- [ ] Handle timezone edge cases
- [ ] Performance: Query executes quickly with large datasets
- [ ] Concurrent engagement tracking doesn't cause race conditions

---

## 7. Example API Calls

### Track Card View Engagement
```bash
curl -X POST https://api.example.com/performance/daily-digest/engagement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "cardId": "123e4567-e89b-12d3-a456-426614174000",
    "duration": 25,
    "type": "CARD_VIEW",
    "date": "2024-01-15",
    "isComplete": true
  }'
```

### Track MCQ Attempt
```bash
curl -X POST https://api.example.com/performance/daily-digest/engagement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "cardId": "123e4567-e89b-12d3-a456-426614174001",
    "duration": 0,
    "type": "MCQ_ATTEMPT",
    "date": "2024-01-15",
    "isComplete": true
  }'
```

### Get Weekly Performance
```bash
curl -X GET "https://api.example.com/performance/weekly-meter?userId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

### Get Badge Status
```bash
curl -X GET "https://api.example.com/performance/badge-status?userId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

## Summary

**Required Endpoints:**
1. `POST /performance/daily-digest/engagement` - Track engagement
2. `GET /performance/weekly-meter` - Get weekly performance (0-7 days)
3. `GET /performance/badge-status` - Get user badge and days active

**Required Tables:**
1. `daily_digest_engagement` - Store individual engagement records
2. `daily_engagement_status` - Store daily "Present" status
3. `user_badge_status` - Store user's current badge and days active

**Key Logic:**
- Daily "Present" = (card viewed 20+ seconds) OR (MCQ attempted with 50%+ accuracy)
- Weekly Performance = Count of "Present" days in last 7 days
- Badge = Based on active days in last 6 months (30, 60, 90, 120, 150, 180 days)

