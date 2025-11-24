# LinguaFlow Administrator Backend Guide

**Last Updated:** November 24, 2025  
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

**Last Updated:** November 24, 2025  
**Maintainer:** LinguaFlow Development Team
