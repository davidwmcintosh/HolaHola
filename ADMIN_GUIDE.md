# LinguaFlow Administrator Backend Guide

**Last Updated:** November 26, 2025  
**For:** System Administrators and Backend Database Managers

---

## Table of Contents

1. [Overview](#overview)
2. [Granting Teacher Access](#granting-teacher-access)
3. [Database Management](#database-management)
4. [Managing User Accounts](#managing-user-accounts)
5. [Managing Classes & Enrollment](#managing-classes--enrollment)
6. [Subscription & Tier Management](#subscription--tier-management)
7. [System Configuration](#system-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)

---

## Overview

### What This Guide Covers

This guide is for administrators who need to:
- Grant teacher access to users
- Manage the PostgreSQL database directly
- Troubleshoot user/class issues
- Configure system settings
- Handle backend operations not available in the UI

### Prerequisites

- Access to the PostgreSQL database
- Familiarity with SQL queries
- Understanding of the LinguaFlow data model

### Database Access

**Environment Variables:**
```bash
DATABASE_URL=<your_database_url>
PGHOST=<host>
PGPORT=<port>
PGUSER=<user>
PGPASSWORD=<password>
PGDATABASE=<database_name>
```

**Connecting via psql:**
```bash
psql $DATABASE_URL
```

**Connecting via Replit SQL Tool:**
- Use the `execute_sql_tool` for safe database operations
- Recommended for production environments

---

## Granting Teacher Access

### Making a User a Teacher

By default, new users are students. To grant teacher privileges:

**Method 1: SQL Query (Recommended)**

```sql
-- Find the user first
SELECT id, email, "fullName", "isTeacher" 
FROM users 
WHERE email = 'teacher@example.com';

-- Grant teacher access
UPDATE users 
SET "isTeacher" = true 
WHERE email = 'teacher@example.com';

-- Verify the change
SELECT id, email, "fullName", "isTeacher" 
FROM users 
WHERE email = 'teacher@example.com';
```

**Method 2: By User ID**

```sql
UPDATE users 
SET "isTeacher" = true 
WHERE id = 123;
```

### Revoking Teacher Access

```sql
-- Remove teacher privileges
UPDATE users 
SET "isTeacher" = false 
WHERE email = 'teacher@example.com';
```

### Bulk Grant Teacher Access

```sql
-- Grant teacher access to multiple users
UPDATE users 
SET "isTeacher" = true 
WHERE email IN (
  'teacher1@school.edu',
  'teacher2@school.edu',
  'teacher3@school.edu'
);
```

---

## Database Management

### Database Schema Overview

**Core Tables:**
- `users` - User accounts and authentication
- `teacherClasses` - Classes created by teachers
- `classEnrollments` - Student-class relationships
- `assignments` - Teacher-created assignments
- `assignmentSubmissions` - Student submissions
- `curriculumPaths` - Curriculum paths
- `curriculumUnits` - Units within paths
- `curriculumLessons` - Lessons within units
- `conversations` - AI conversation sessions
- `messages` - Individual chat messages
- `vocabularyWords` - Extracted vocabulary
- `userProgress` - Learning progress tracking

**Key Relationships:**
```
users (isTeacher=true) → teacherClasses → assignments
users (isTeacher=false) → classEnrollments → teacherClasses
assignments → assignmentSubmissions → users
curriculumPaths → curriculumUnits → curriculumLessons
```

### Running Database Migrations

**NEVER manually write SQL migrations.** Use Drizzle's push command:

```bash
# Standard migration (safe)
npm run db:push

# Force migration (if needed, data loss warning)
npm run db:push --force
```

**Schema File:** `shared/schema.ts`

### Backing Up Data

```bash
# Full database backup
pg_dump $DATABASE_URL > linguaflow_backup_$(date +%Y%m%d).sql

# Specific table backup
pg_dump $DATABASE_URL -t users > users_backup.sql

# Restore from backup
psql $DATABASE_URL < linguaflow_backup_20251124.sql
```

---

## Managing User Accounts

### Viewing All Users

```sql
-- All users with teacher status
SELECT id, email, "fullName", "isTeacher", "subscriptionTier", "createdAt"
FROM users
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Finding Users

```sql
-- By email
SELECT * FROM users WHERE email = 'user@example.com';

-- By name (partial match)
SELECT * FROM users WHERE "fullName" ILIKE '%john%';

-- All teachers
SELECT id, email, "fullName" FROM users WHERE "isTeacher" = true;

-- All students
SELECT id, email, "fullName" FROM users WHERE "isTeacher" = false;
```

### Updating User Information

```sql
-- Update subscription tier
UPDATE users 
SET "subscriptionTier" = 'institutional'
WHERE email = 'teacher@school.edu';

-- Update user preferences
UPDATE users 
SET "targetLanguage" = 'spanish',
    "nativeLanguage" = 'english',
    "difficultyLevel" = 'intermediate'
WHERE id = 123;

-- Mark onboarding as complete
UPDATE users 
SET "onboardingCompleted" = true
WHERE id = 123;
```

### Deleting Users (CAREFUL!)

```sql
-- Check user's data first
SELECT 
  (SELECT COUNT(*) FROM conversations WHERE "userId" = 123) as conversations,
  (SELECT COUNT(*) FROM "teacherClasses" WHERE "teacherId" = 123) as classes,
  (SELECT COUNT(*) FROM "classEnrollments" WHERE "studentId" = 123) as enrollments;

-- Delete user (CASCADE will delete related data)
-- WARNING: This is permanent!
DELETE FROM users WHERE id = 123;
```

---

## Managing Classes & Enrollment

### Viewing All Classes

```sql
SELECT 
  c.id,
  c.name,
  c.subject,
  c."classCode",
  u."fullName" as teacher,
  u.email as "teacherEmail",
  (SELECT COUNT(*) FROM "classEnrollments" WHERE "classId" = c.id) as "studentCount"
FROM "teacherClasses" c
JOIN users u ON c."teacherId" = u.id
ORDER BY c."createdAt" DESC;
```

### Finding a Class by Code

```sql
SELECT * FROM "teacherClasses" 
WHERE "classCode" = 'ABC123';
```

### Manually Enrolling a Student

```sql
-- Find student ID
SELECT id, email, "fullName" FROM users WHERE email = 'student@school.edu';

-- Find class ID
SELECT id, name, "classCode" FROM "teacherClasses" WHERE "classCode" = 'ABC123';

-- Create enrollment
INSERT INTO "classEnrollments" ("studentId", "classId", "enrolledAt")
VALUES (456, 789, NOW());
```

### Viewing Class Roster

```sql
SELECT 
  u.id,
  u.email,
  u."fullName",
  e."enrolledAt"
FROM "classEnrollments" e
JOIN users u ON e."studentId" = u.id
WHERE e."classId" = 789
ORDER BY u."fullName";
```

### Removing Student from Class

```sql
-- Delete enrollment
DELETE FROM "classEnrollments"
WHERE "studentId" = 456 AND "classId" = 789;
```

### Regenerating Class Code

```sql
-- Generate new random 6-character code
UPDATE "teacherClasses"
SET "classCode" = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
WHERE id = 789;

-- Verify new code
SELECT id, name, "classCode" FROM "teacherClasses" WHERE id = 789;
```

---

## Subscription & Tier Management

### Subscription Tiers

Available tiers:
- `free` - Limited features
- `basic` - Enhanced features
- `pro` - Full features
- `institutional` - School/district access

### Updating User Subscription

```sql
-- Set to institutional tier
UPDATE users 
SET "subscriptionTier" = 'institutional'
WHERE email = 'teacher@school.edu';

-- Bulk update for a school domain
UPDATE users 
SET "subscriptionTier" = 'institutional'
WHERE email LIKE '%@school.edu';
```

### Voice Message Usage Tracking

```sql
-- Check user's voice message count
SELECT "voiceMessagesUsed", "voiceMessagesLimit", "subscriptionTier"
FROM users
WHERE id = 123;

-- Reset monthly voice usage
UPDATE users 
SET "voiceMessagesUsed" = 0
WHERE "subscriptionTier" IN ('free', 'basic');

-- Set custom voice limit for institutional user
UPDATE users 
SET "voiceMessagesLimit" = 10000
WHERE email = 'teacher@school.edu';
```

### Stripe Integration

Subscription data is synced to the `stripe` schema via webhooks:

```sql
-- View Stripe customers
SELECT * FROM stripe.customers WHERE email = 'user@example.com';

-- View active subscriptions
SELECT * FROM stripe.subscriptions WHERE status = 'active';
```

**Note:** Do not manually modify `stripe` schema tables - they are managed by `stripe-replit-sync`.

---

## System Configuration

### Environment Variables

**Required Secrets:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session encryption key
- `OPENAI_API_KEY` - For AI chat (if using OpenAI)
- `DEEPGRAM_API_KEY` - For voice STT
- `GOOGLE_CLOUD_TTS_CREDENTIALS` - For voice TTS
- `UNSPLASH_ACCESS_KEY` - For stock images

**Optional:**
- `STRIPE_SECRET_KEY` - For payment processing
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks

### Viewing Environment Variables

Use Replit's secrets management interface or:

```bash
# List environment variables (values hidden)
env | grep -E '(DATABASE|OPENAI|DEEPGRAM|GOOGLE|STRIPE)'
```

### Database Connection Pooling

The app uses `@neondatabase/serverless` with automatic connection pooling. No configuration needed.

---

## Troubleshooting

### Common Issues

#### Issue: User can't access teacher features

**Diagnosis:**
```sql
SELECT "isTeacher" FROM users WHERE email = 'user@example.com';
```

**Solution:**
```sql
UPDATE users SET "isTeacher" = true WHERE email = 'user@example.com';
```

---

#### Issue: Student can't join class with code

**Diagnosis:**
```sql
-- Verify class exists
SELECT * FROM "teacherClasses" WHERE "classCode" = 'ABC123';

-- Check if already enrolled
SELECT * FROM "classEnrollments" 
WHERE "studentId" = 456 AND "classId" = 789;
```

**Solution:**
- If class doesn't exist: Teacher needs to create it
- If already enrolled: Student should see class in their list
- If code is wrong: Generate new code (see "Regenerating Class Code")

---

#### Issue: Assignment not visible to students

**Diagnosis:**
```sql
SELECT id, title, "isPublished", "classId"
FROM assignments
WHERE id = 999;
```

**Solution:**
```sql
-- Publish the assignment
UPDATE assignments SET "isPublished" = true WHERE id = 999;
```

---

#### Issue: Voice messages not working

**Diagnosis:**
```bash
# Check if API keys are set
echo $DEEPGRAM_API_KEY
echo $GOOGLE_CLOUD_TTS_CREDENTIALS
```

**Solution:**
- Verify API keys are set in Replit secrets
- Check Deepgram and Google Cloud quotas
- Review workflow logs for errors

---

#### Issue: Database migration failed

**Error:** "Data loss warning" during `npm run db:push`

**Solution:**
```bash
# Force the migration (WARNING: May delete data)
npm run db:push --force

# Always backup first!
pg_dump $DATABASE_URL > backup_before_migration.sql
```

---

### Checking System Health

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active connections
SELECT COUNT(*) FROM pg_stat_activity;

-- User statistics
SELECT 
  "subscriptionTier",
  COUNT(*) as users,
  COUNT(CASE WHEN "isTeacher" = true THEN 1 END) as teachers
FROM users
GROUP BY "subscriptionTier";
```

---

## Security Best Practices

### Database Access

✅ **DO:**
- Use environment variables for credentials
- Limit database user permissions (read-only for reports)
- Use SSL connections in production
- Backup before destructive operations
- Use transactions for multi-step changes

❌ **DON'T:**
- Hard-code credentials in scripts
- Use root/admin account for routine tasks
- Skip backups before migrations
- Expose database credentials in logs

### User Data Protection

✅ **DO:**
- Follow FERPA/COPPA compliance for student data
- Encrypt sensitive data at rest
- Use secure session management
- Log administrative actions
- Implement role-based access control

❌ **DON'T:**
- Share user passwords or reset tokens
- Store sensitive data in plain text
- Query production database from development tools
- Share database backups without encryption

### SQL Injection Prevention

The app uses Drizzle ORM which prevents SQL injection. When writing custom queries:

✅ **DO:**
```sql
-- Use parameterized queries
SELECT * FROM users WHERE email = $1;
```

❌ **DON'T:**
```sql
-- Never concatenate user input
SELECT * FROM users WHERE email = '" + userInput + "'";
```

---

## Quick Reference SQL Queries

### User Management

```sql
-- Make user a teacher
UPDATE users SET "isTeacher" = true WHERE email = 'teacher@example.com';

-- Change subscription tier
UPDATE users SET "subscriptionTier" = 'institutional' WHERE id = 123;

-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com';
```

### Class Management

```sql
-- View all classes for a teacher
SELECT * FROM "teacherClasses" WHERE "teacherId" = 123;

-- View class roster
SELECT u.* FROM users u
JOIN "classEnrollments" e ON u.id = e."studentId"
WHERE e."classId" = 789;

-- Manually enroll student
INSERT INTO "classEnrollments" ("studentId", "classId", "enrolledAt")
VALUES (456, 789, NOW());
```

### Assignment Management

```sql
-- View assignments for a class
SELECT * FROM assignments WHERE "classId" = 789 ORDER BY "dueDate";

-- View submissions for an assignment
SELECT s.*, u."fullName", u.email
FROM "assignmentSubmissions" s
JOIN users u ON s."userId" = u.id
WHERE s."assignmentId" = 999;

-- Publish assignment
UPDATE assignments SET "isPublished" = true WHERE id = 999;
```

### Analytics Queries

```sql
-- Class completion rate
SELECT 
  a.title,
  COUNT(DISTINCT s."userId") as submissions,
  (SELECT COUNT(*) FROM "classEnrollments" WHERE "classId" = a."classId") as total_students,
  ROUND(100.0 * COUNT(DISTINCT s."userId") / 
    (SELECT COUNT(*) FROM "classEnrollments" WHERE "classId" = a."classId"), 2) as completion_rate
FROM assignments a
LEFT JOIN "assignmentSubmissions" s ON a.id = s."assignmentId"
WHERE a."classId" = 789
GROUP BY a.id, a.title, a."classId";
```

---

## Database Schema Reference

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| email | varchar | Unique email |
| fullName | varchar | Display name |
| isTeacher | boolean | Teacher access flag |
| subscriptionTier | varchar | free, basic, pro, institutional |
| targetLanguage | varchar | Language being learned |
| nativeLanguage | varchar | User's native language |
| difficultyLevel | varchar | Current difficulty |
| actflLevel | varchar | ACTFL proficiency level |
| voiceMessagesUsed | integer | Monthly voice usage |
| voiceMessagesLimit | integer | Monthly voice limit |
| onboardingCompleted | boolean | Onboarding status |
| createdAt | timestamp | Account creation |

### Teacher Classes Table

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| teacherId | integer | Foreign key to users |
| name | varchar(200) | Class name |
| subject | varchar(200) | Subject area |
| targetLanguage | varchar | Language taught |
| description | text(2000) | Class description |
| classCode | varchar(6) | 6-char join code |
| createdAt | timestamp | Creation date |

### Assignments Table

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| classId | integer | Foreign key to teacherClasses |
| title | varchar(200) | Assignment title |
| description | text(2000) | Overview |
| instructions | text(10000) | Detailed instructions |
| type | varchar | practice, homework, quiz, project |
| maxScore | integer | Maximum points (0-1000) |
| dueDate | timestamp | Due date/time |
| isPublished | boolean | Visibility status |
| createdAt | timestamp | Creation date |

---

## Super Admin Backend (RBAC System)

**Added:** November 24, 2025  
**Version:** 1.0

### Overview

The Super Admin Backend implements a 4-tier role-based access control (RBAC) system with platform-wide oversight, user management, audit logging, and impersonation capabilities.

### Role Hierarchy

```
admin > developer > teacher > student
```

Higher roles automatically inherit permissions from lower roles.

### Role Capabilities

**Student (Base)**
- Personal learning features
- Own assignments and progress
- Join classes via code

**Teacher (Extends Student)**
- Create/manage classes
- Create assignments, grade submissions
- Access curriculum library
- View student progress in their classes

**Developer (Extends Teacher)**
- Platform-wide read access (users, classes, assignments)
- Platform metrics and analytics
- View audit logs

**Admin (Full Access)**
- User role management
- Impersonation capabilities
- Full audit log access
- Platform-wide administrative control

### Admin UI Access

**Admin Dashboard:** `/admin`  
**User Management:** `/admin/users`  
**Class Management:** `/admin/classes`  
**Reports & Audit:** `/admin/reports`  
**Voice Console:** `/admin/voices`

Only users with `role = 'developer'` or `role = 'admin'` can access these pages.

### Managing User Roles

**Check Current Role:**
```sql
SELECT id, email, "fullName", role 
FROM users 
WHERE email = 'user@example.com';
```

**Promote User to Teacher:**
```sql
UPDATE users 
SET role = 'teacher'
WHERE email = 'teacher@example.com';
```

**Promote User to Developer:**
```sql
UPDATE users 
SET role = 'developer'
WHERE email = 'developer@example.com';
```

**Promote User to Admin:**
```sql
UPDATE users 
SET role = 'admin'
WHERE email = 'admin@example.com';
```

**Demote User:**
```sql
-- Demote developer to teacher
UPDATE users 
SET role = 'teacher'
WHERE email = 'user@example.com';
```

**Bulk Role Updates:**
```sql
-- Promote all teachers at a school to developers
UPDATE users 
SET role = 'developer'
WHERE role = 'teacher' 
AND email LIKE '%@school.edu';
```

### Admin API Endpoints

All admin endpoints are protected by RBAC middleware and require proper authentication.

**Get All Users** (Developer+):
```bash
GET /api/admin/users?role=teacher&limit=50
```

**Update User Role** (Admin only):
```bash
PATCH /api/admin/users/:userId/role
Body: { "role": "teacher" }
```

**Get Platform Metrics** (Developer+):
```bash
GET /api/admin/metrics
```

**Get Audit Logs** (Admin only):
```bash
GET /api/admin/audit-logs?limit=100
```

**Start Impersonation** (Admin only):
```bash
POST /api/admin/impersonate
Body: { "targetUserId": "user-123", "durationMinutes": 60 }
```

**End Impersonation** (Admin only):
```bash
POST /api/admin/end-impersonation
Body: { "targetUserId": "user-123" }
```

### Impersonation System

Admins can temporarily view the platform as another user to troubleshoot issues.

**Safety Features:**
- Mandatory session expiration (default 60 minutes)
- Clear UI banner when impersonating
- All impersonation events logged to audit trail
- Cannot impersonate other admins

**Database Fields:**
```sql
-- Check if user is being impersonated
SELECT 
  id,
  email,
  "impersonatedById",
  "impersonatedAt",
  "impersonationExpiresAt"
FROM users
WHERE "impersonatedById" IS NOT NULL;
```

**Manually End Impersonation:**
```sql
-- Emergency: End all impersonation sessions
UPDATE users 
SET "impersonatedById" = NULL,
    "impersonatedAt" = NULL,
    "impersonationExpiresAt" = NULL;

-- End specific impersonation
UPDATE users 
SET "impersonatedById" = NULL,
    "impersonatedAt" = NULL,
    "impersonationExpiresAt" = NULL
WHERE id = 'user-123';
```

**Cleanup Expired Sessions:**
```sql
-- Remove expired impersonation sessions
UPDATE users 
SET "impersonatedById" = NULL,
    "impersonatedAt" = NULL,
    "impersonationExpiresAt" = NULL
WHERE "impersonationExpiresAt" < NOW();
```

### Audit Logging

All administrative actions are logged to the `adminAuditLog` table:

**View Recent Admin Actions:**
```sql
SELECT 
  a.action,
  a."targetType",
  a."targetId",
  a.metadata,
  a."createdAt",
  u.email as "adminEmail"
FROM "adminAuditLog" a
JOIN users u ON a."actorId" = u.id
ORDER BY a."createdAt" DESC
LIMIT 50;
```

**View Actions by Specific Admin:**
```sql
SELECT * FROM "adminAuditLog"
WHERE "actorId" = 'admin-user-id'
ORDER BY "createdAt" DESC;
```

**View Role Changes:**
```sql
SELECT 
  a.*,
  u.email as "adminEmail"
FROM "adminAuditLog" a
JOIN users u ON a."actorId" = u.id
WHERE a.action = 'update_user_role'
ORDER BY a."createdAt" DESC;
```

**View Impersonation History:**
```sql
SELECT 
  a.*,
  u.email as "adminEmail",
  target.email as "targetEmail"
FROM "adminAuditLog" a
JOIN users u ON a."actorId" = u.id
LEFT JOIN users target ON a."targetId" = target.id
WHERE a.action IN ('start_impersonation', 'end_impersonation')
ORDER BY a."createdAt" DESC;
```

---

## Voice Console (TTS Management)

**Added:** November 26, 2025  
**Access:** `/admin/voices`  
**Required Role:** Developer or Admin

### Overview

The Voice Console allows administrators and developers to preview, test, and configure tutor voices across all supported languages. It integrates with the 3-layer emotion control system for testing emotionally expressive AI tutors.

### Features

**Voice Preview**
- Select any supported language (Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian)
- Preview target language and native language (English) voice samples
- Test sample phrases in each language

**Emotion Audition Controls**
- **Personality Presets**: Test warm, calm, energetic, or professional personalities
- **Expressiveness Slider (1-5)**: Test different emotional ranges
- **Emotion Selection**: Select specific emotions allowed for the personality/expressiveness combination

**Voice Comparison**
- Play target language samples to hear foreign pronunciation
- Play native language samples to hear English explanations
- Compare different voice configurations side-by-side

### How to Use

1. Navigate to `/admin/voices` (requires developer or admin role)
2. Select a language from the dropdown
3. Choose emotion settings:
   - Select personality preset (warm, calm, energetic, professional)
   - Adjust expressiveness slider (1-5)
   - Select an emotion from the available options
4. Click "Play Target" to hear the voice in the target language
5. Click "Play English" to hear the voice in English

### Emotion Control Configuration

**Personality Presets:**
| Preset | Baseline Emotion | Description |
|--------|------------------|-------------|
| warm | friendly | Encouraging and supportive teaching style |
| calm | calm | Patient and measured teaching approach |
| energetic | enthusiastic | Excited and engaging teaching style |
| professional | neutral | Formal and focused teaching style |

**Expressiveness Levels:**
| Level | Behavior |
|-------|----------|
| 1-2 | Baseline emotion only, minimal deviation |
| 3 | Core emotions for the personality |
| 4 | Extended emotion set |
| 5 | Full spontaneous emotions including surprised/excited |

### API Endpoints

**Get TTS Metadata** (Developer+):
```bash
GET /api/admin/tts-meta
```
Returns: personalities, expressiveness levels, emotion mappings

**Preview Voice** (Developer+):
```bash
POST /api/admin/tutor-voices/preview
Body: {
  "voiceId": "voice-id",
  "text": "Hello, how are you?",
  "language": "en",
  "speakingRate": 0.9,
  "emotion": "friendly"
}
```
Returns: Audio blob (MP3)

### Managing User Voice Settings

**Check User's Voice Settings:**
```sql
SELECT 
  id, 
  email, 
  "tutorPersonality", 
  "tutorExpressiveness",
  "tutorVoiceId"
FROM users
WHERE email = 'user@example.com';
```

**Update User Voice Settings:**
```sql
UPDATE users 
SET 
  "tutorPersonality" = 'warm',
  "tutorExpressiveness" = 3
WHERE email = 'user@example.com';
```

**Reset Voice Settings to Default:**
```sql
UPDATE users 
SET 
  "tutorPersonality" = 'warm',
  "tutorExpressiveness" = 3,
  "tutorVoiceId" = NULL
WHERE id = 123;
```

### Troubleshooting Voice Issues

**Issue: Voice preview not playing**

**Diagnosis:**
- Check browser console for audio errors
- Verify CARTESIA_API_KEY is set in environment secrets

**Solution:**
```bash
# Check if Cartesia API key is set
echo $CARTESIA_API_KEY | head -c 10
```

**Issue: Emotion not changing in voice output**

**Diagnosis:**
- Check if emotion is in the allowed list for the personality/expressiveness
- Check TTS service logs for validation warnings

**Solution:**
Ensure the selected emotion is valid for the personality/expressiveness combination. The Voice Console automatically filters to show only valid emotions.

**Issue: Fallback to Google Cloud TTS**

**Diagnosis:**
- Cartesia API may be unavailable or rate limited
- Check workflow logs for TTS provider selection

**Solution:**
The system automatically falls back to Google Cloud Chirp HD if Cartesia is unavailable. This is expected behavior and ensures voice features continue working.

---

## Voice Console Permissions Model (Nov 29, 2024)

### Three-Tier Permission System

Voice emotion controls are restricted by user role to prevent students from accessing advanced tutor customization:

| Role | Gender Control | Personality/Expressiveness/Emotion |
|------|---------------|-----------------------------------|
| **Student** | ✅ Male/Female toggle | ❌ Hidden |
| **Teacher** | ✅ Male/Female toggle | ❌ Hidden |
| **Developer** | ✅ Male/Female toggle | ✅ Full control |
| **Admin** | ✅ Male/Female toggle | ✅ Full control |

### Security Enforcement

**Backend Protection** (`server/routes.ts`):
The `/api/user/preferences` endpoint strips restricted fields for non-developers:

```typescript
// Non-developers cannot modify voice emotion settings
if (user.role !== 'developer' && user.role !== 'admin') {
  delete preferences.tutorPersonality;
  delete preferences.tutorExpressiveness;
  delete preferences.tutorEmotions;
}
```

**Frontend Controls** (`client/src/pages/settings.tsx`):
Voice emotion sliders are conditionally rendered based on user role:

```typescript
// Only show emotion controls to developers/admins
{(user.role === 'developer' || user.role === 'admin') && (
  <VoiceEmotionControls ... />
)}
```

### User Settings Available by Role

**All Users (Student+)**:
- Tutor gender: Male/Female toggle
- Target language
- Native language
- Difficulty level
- Subtitle mode: Off, Target, All

**Developers/Admins Only**:
- Personality preset: warm, calm, energetic, professional
- Expressiveness level: 1-5 slider
- Emotion selection: varies by personality/expressiveness

### Checking User Voice Permissions

```sql
-- Check if user has developer/admin voice permissions
SELECT 
  id, 
  email, 
  role,
  CASE WHEN role IN ('developer', 'admin') 
       THEN 'Full voice control' 
       ELSE 'Gender only' 
  END as "voicePermissions"
FROM users
WHERE email = 'user@example.com';
```

### Granting Voice Control Access

To give a user full voice emotion control access, promote them to developer role:

```sql
UPDATE users 
SET role = 'developer'
WHERE email = 'trusted-tester@example.com';
```

**Note**: Developer role also grants read access to platform metrics and audit logs. Only grant to trusted users.

---

### Platform Metrics

**User Statistics:**
```sql
SELECT 
  role,
  COUNT(*) as count
FROM users
GROUP BY role
ORDER BY 
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'developer' THEN 2
    WHEN 'teacher' THEN 3
    WHEN 'student' THEN 4
  END;
```

**Class Statistics:**
```sql
SELECT 
  COUNT(*) as "totalClasses",
  AVG("enrollmentCount") as "avgEnrollment",
  MAX("enrollmentCount") as "largestClass"
FROM (
  SELECT 
    c.id,
    COUNT(e."studentId") as "enrollmentCount"
  FROM "teacherClasses" c
  LEFT JOIN "classEnrollments" e ON c.id = e."classId"
  GROUP BY c.id
) stats;
```

**Assignment Completion Rates:**
```sql
SELECT 
  a.id,
  a.title,
  COUNT(DISTINCT s."userId") as submissions,
  (SELECT COUNT(*) FROM "classEnrollments" WHERE "classId" = a."classId") as students,
  ROUND(100.0 * COUNT(DISTINCT s."userId") / 
    NULLIF((SELECT COUNT(*) FROM "classEnrollments" WHERE "classId" = a."classId"), 0), 2) as "completionRate"
FROM assignments a
LEFT JOIN "assignmentSubmissions" s ON a.id = s."assignmentId"
GROUP BY a.id, a.title, a."classId"
ORDER BY "completionRate" DESC;
```

### Troubleshooting RBAC Issues

**Issue: Admin endpoints return 500 error**

**Diagnosis:**
Check middleware ordering in `server/routes.ts`. Correct order is:
```typescript
app.get("/api/admin/users", 
  isAuthenticated, 
  loadAuthenticatedUser(storage), 
  requireRole('developer'), 
  handler
);
```

**Solution:**
Ensure `loadAuthenticatedUser(storage)` comes AFTER `isAuthenticated` and BEFORE `requireRole()`.

**Issue: User can't access admin UI after role change**

**Diagnosis:**
```sql
-- Check user's current role
SELECT role FROM users WHERE email = 'user@example.com';

-- Check if session is cached
SELECT * FROM session WHERE sess::text LIKE '%user@example.com%';
```

**Solution:**
User needs to log out and log back in for role change to take effect. Session data is cached.

**Issue: Impersonation not ending automatically**

**Diagnosis:**
```sql
-- Check expired sessions
SELECT * FROM users 
WHERE "impersonationExpiresAt" < NOW()
AND "impersonatedById" IS NOT NULL;
```

**Solution:**
Run cleanup query to remove expired sessions (see "Cleanup Expired Sessions" above).

### Security Best Practices

**Role Management:**
- ✅ Only grant admin role to trusted users
- ✅ Use developer role for platform monitoring
- ✅ Audit all role changes via audit logs
- ❌ Don't create multiple admin accounts unnecessarily

**Impersonation:**
- ✅ Use shortest duration needed
- ✅ Always end session when done
- ✅ Review audit logs regularly
- ❌ Don't impersonate users for non-support reasons

**Audit Logs:**
- ✅ Review logs weekly
- ✅ Archive old logs (>1 year)
- ✅ Alert on sensitive actions
- ❌ Don't delete audit logs

### Migration from isTeacher to role

If you have existing data using the legacy `isTeacher` boolean:

```sql
-- Migrate teachers to new role system
UPDATE users 
SET role = 'teacher'
WHERE "isTeacher" = true AND role = 'student';

-- Verify migration
SELECT 
  COUNT(*) as migrated
FROM users
WHERE role = 'teacher' AND "isTeacher" = true;
```

**Note:** The `isTeacher` field is now deprecated and maintained for backwards compatibility only. Use `role` field going forward.

---

## Getting Support

### Documentation Resources

- **Technical Documentation:** `replit.md`
- **Institutional Features:** `docs/institutional-standards-integration.md`
- **Teacher Guide:** `TEACHER_GUIDE.md`
- **Developer Commands:** `DEVELOPER_QUICK_COMMANDS.md`

### Reporting Issues

When reporting system issues, include:
- PostgreSQL version: `SELECT version();`
- Table schema: `\d tablename` in psql
- Error messages from workflow logs
- Steps to reproduce

### Emergency Contacts

- **Database Issues:** Contact your hosting provider (Neon/Replit)
- **Application Issues:** Check workflow logs and `replit.md` troubleshooting
- **Security Issues:** Follow incident response procedures

---

## ACTFL Progress Management

### Overview

LinguaFlow tracks learner proficiency using ACTFL World-Readiness Standards with real-time FACT criteria assessment.

### Viewing ACTFL Progress

**Get User's ACTFL Level:**
```sql
SELECT 
  u.id,
  u.email,
  u."fullName",
  u."actflLevel",
  ap."currentLevel",
  ap."totalVoiceMinutes",
  ap."wordsLearned",
  ap."avgPronunciationConfidence",
  ap."tasksCompleted"
FROM users u
LEFT JOIN "actflProgress" ap ON u.id = ap."userId"
WHERE u.email = 'user@example.com';
```

**View All Progress for a User:**
```sql
SELECT * FROM "actflProgress"
WHERE "userId" = 'user-id-here'
ORDER BY "updatedAt" DESC;
```

**Class ACTFL Statistics:**
```sql
SELECT 
  u."fullName",
  u.email,
  ap."currentLevel",
  ap."totalVoiceMinutes",
  ap."wordsLearned",
  ap."avgPronunciationConfidence"
FROM "classEnrollments" e
JOIN users u ON e."studentId" = u.id
LEFT JOIN "actflProgress" ap ON u.id = ap."userId"
WHERE e."classId" = 789
ORDER BY ap."avgPronunciationConfidence" DESC NULLS LAST;
```

### Updating ACTFL Progress

**Manually Update ACTFL Level:**
```sql
UPDATE users 
SET "actflLevel" = 'novice_mid'
WHERE email = 'user@example.com';

UPDATE "actflProgress"
SET "currentLevel" = 'novice_mid'
WHERE "userId" = 'user-id-here';
```

**Reset ACTFL Progress (Testing):**
```sql
-- Warning: This resets all progress data
UPDATE "actflProgress"
SET 
  "currentLevel" = 'novice_low',
  "totalVoiceMinutes" = 0,
  "wordsLearned" = 0,
  "avgPronunciationConfidence" = 0,
  "tasksCompleted" = '[]'::jsonb
WHERE "userId" = 'user-id-here';
```

### ACTFL Advancement Thresholds

From `server/actfl-advancement.ts`:

| Level | Practice Hours | Messages | Pronunciation | Tasks | Topics |
|-------|---------------|----------|---------------|-------|--------|
| Novice Low | 5 | 50 | 70% | 3 | 2 |
| Novice Mid | 10 | 80 | 75% | 6 | 4 |
| Novice High | 15 | 120 | 78% | 10 | 6 |
| Intermediate Low | 25 | 150 | 80% | 15 | 8 |
| Intermediate Mid | 40 | 200 | 82% | 20 | 12 |

### Troubleshooting ACTFL Issues

**Issue: Pronunciation confidence always 0**

**Diagnosis:**
```sql
-- Check recent voice exchanges
SELECT 
  "pronunciationConfidence",
  "userWordCount",
  "createdAt"
FROM "actflProgress"
WHERE "userId" = 'user-id'
ORDER BY "updatedAt" DESC
LIMIT 5;
```

**Solution:**
This was fixed with per-session confidence tracking. Ensure you're running the latest code. Previous versions had a race condition with shared class properties.

**Issue: User not advancing despite meeting criteria**

**Diagnosis:**
Check if accuracy gating is blocking:
```sql
SELECT 
  "avgPronunciationConfidence",
  "totalVoiceMinutes",
  "wordsLearned"
FROM "actflProgress"
WHERE "userId" = 'user-id';
```

**Solution:**
Users need 70%+ pronunciation confidence for Novice Low (higher for advanced levels) to receive advancement notifications. If other metrics are met but accuracy is low, encourage more practice.

---

**Last Updated:** November 28, 2025  
**Maintainer:** LinguaFlow Development Team
