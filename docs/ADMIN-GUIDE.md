# HolaHola Admin Guide

Guide for administrators using the Command Center and managing the HolaHola platform.

---

## Table of Contents

1. [Command Center Overview](#command-center-overview)
2. [User Management](#user-management)
3. [Image Library](#image-library)
4. [Analytics Dashboard](#analytics-dashboard)
5. [Voice Lab](#voice-lab)
6. [Developer Tools](#developer-tools)

---

## Command Center Overview

The Command Center (`/admin`) is a unified tab-based admin experience with role-based access control.

### Access Levels

| Role | Tabs Visible |
|------|--------------|
| **Admin** | All tabs |
| **Developer** | Overview, Users, Classes, Analytics, Voice Lab, Dev Tools |
| **Teacher** | Overview, Classes (own classes only) |

### Navigation

Tabs available:
- **Overview** - Platform metrics, growth charts, top performers
- **Users** - User management, role changes, credits
- **Classes** - Platform-wide class management
- **Images** - Image library with review workflow
- **Analytics** - Usage reports
- **Voice Lab** - Voice preview and configuration
- **Dev Tools** - Developer usage analytics

---

## User Management

### Viewing Users

The Users tab displays all platform users with:
- Name and email
- Role (student, teacher, admin, developer)
- Account status
- Credits balance

### User Actions

| Action | Description |
|--------|-------------|
| **Change Role** | Promote/demote user roles |
| **Toggle Test Account** | Mark as dev/QA account (unlimited credits) |
| **Toggle Beta Tester** | Mark as external beta user |
| **Grant Credits** | Add voice tutoring time to account |

### Dual Testing System

Two-tier testing architecture for analytics segmentation:

| Account Type | Purpose | Credits |
|--------------|---------|---------|
| **Test Account** | Internal dev/QA | Unlimited |
| **Beta Tester** | External beta users | Admin-granted |

Both account types:
- Set `isTestSession` flag on voice sessions
- Are excluded from production analytics
- Have separate tracking for accurate metrics

### Granting Credits

1. Click **Grant Credits** on a user
2. Enter hours and/or minutes
3. Optionally set expiration date
4. Confirm

Credits are added to usage ledger with audit logging.

---

## Image Library

### Overview

The Image Library manages all vocabulary images used by the AI tutor, including quality control workflow.

### View Modes

| Mode | Description |
|------|-------------|
| **Grid View** | 5-column layout with larger thumbnails (default) |
| **Compact View** | 8-column layout for quick browsing |
| **List View** | Table with sortable columns |

### Sorting Options (List View)

- Date Added (newest/oldest)
- Image Source (stock/AI-generated/user upload)
- Usage Count (most/least used)
- Language
- File Size

### Review Workflow

New images require quality review before appearing in production.

**Tracking Fields:**
- `targetWord` - Vocabulary word that triggered the image
- `isReviewed` - Review status
- `reviewedAt` - When reviewed
- `reviewedBy` - Who reviewed

**Review Status Indicators:**
- **Green check badge** - Reviewed and approved
- **Gray clock badge** - Pending review

**Unreviewed Count Badge:**
- Red warning badge in tab header
- Shows count of images pending review
- Helps prioritize quality control

### Bulk Actions

1. Switch to **List View**
2. Use checkboxes to select images
3. Use bulk action buttons:
   - **Mark as Reviewed** - Approve selected images
   - **Mark as Unreviewed** - Revert to pending
   - **Select All** / **Clear** - Selection shortcuts

Selection automatically clears when changing page, filter, or view mode.

### Image Detail Modal

Click any image to see:
- Full-size preview
- Target word
- Language
- Source (stock/AI-generated)
- Usage count
- Review status with timestamp
- Reviewer information

**Actions:**
- Toggle review status
- Delete image

### Requesting New Images

1. Click **Request Image** button
2. Enter vocabulary word
3. Select language (9 options)
4. Submit

The system uses the vocabulary-image-resolver to:
1. Check cache for existing image
2. Search stock images
3. Generate with AI if needed

New images are marked for review.

---

## Analytics Dashboard

### Usage Reports

View platform-wide usage with test/production separation:

| Metric | Description |
|--------|-------------|
| **Active Users** | Daily/weekly/monthly active users |
| **Voice Minutes** | Total tutoring time consumed |
| **Conversations** | Total conversations started |
| **Vocabulary** | Words learned across platform |

### Test vs Production

Analytics automatically separate:
- **Production data** - Real user activity
- **Test data** - Dev/QA and beta tester activity

This ensures accurate metrics for business decisions.

### Export

Reports can be exported as CSV for further analysis.

---

## Voice Lab

### Overview

Test voice configurations and preview TTS output.

### Features

- **Voice Selection** - Choose from available Cartesia voices
- **Speed Control** - Test different speaking rates
- **Language Preview** - Hear pronunciation in any supported language
- **Sample Phrases** - Quick test phrases by category

---

## Developer Tools

### Usage Analytics

Comprehensive analytics for development and testing:

- **Credit consumption** by user/time period
- **API costs** estimated from usage
- **Session logs** with detailed breakdowns
- **Error tracking** for voice pipeline

### Cost Estimates

Track estimated costs for:
- Voice synthesis (Cartesia)
- Speech recognition (Deepgram)
- AI responses (Gemini)
- Image generation

### Test Account Management

Quickly toggle test/beta status for accounts during development.

---

## API Endpoints Reference

### User Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/:id` | PATCH | Update user (role, test status) |
| `/api/admin/users/:id/credits` | POST | Grant credits |

### Image Library

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/media` | GET | List images (with unreviewedCount) |
| `/api/admin/media/:id` | PATCH | Update image (review status) |
| `/api/admin/media/bulk-review` | POST | Bulk update review status |
| `/api/admin/media/request-image` | POST | Generate new vocabulary image |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/analytics` | GET | Platform usage metrics |
| `/api/admin/analytics/export` | GET | Export analytics data |

---

## Cost & Pricing

### Voice Pipeline Cost

**Cost per hour of tutoring: ~$2.47**

| Component | Cost/Hour | % of Total |
|-----------|-----------|------------|
| TTS (Cartesia Sonic-3) | $2.25 | 91% |
| STT (Deepgram Nova-3) | $0.12 | 5% |
| LLM (Gemini 2.5 Flash) | $0.10 | 4% |

**Key Insight:** TTS dominates costs. LLM optimization would save <4%.

### Institutional Pricing (Per Student/Year)

| Package | Hours | Our Cost | Price | Margin |
|---------|-------|----------|-------|--------|
| Basic | 10 hrs | $24.70 | $50 | 102% |
| Standard | 20 hrs | $49.40 | $100 | 102% |
| Premium | 30 hrs | $74.10 | $150 | 102% |
| Full Year | 120 hrs | $296.40 | $600 | 102% |

> **Detailed Analysis:** See `docs/archive/cost-analysis-2025.md`

---

## Demo & Test Accounts

### Official HolaHola Classes

All demo students are pre-enrolled in 19 official classes:

| Language | Classes | Join Codes |
|----------|---------|------------|
| Spanish | Spanish 1-4 / AP Prep | SP1-LF01 through SP4-LF04 |
| French | French 1-3 | FR1-LF01 through FR3-LF03 |
| German | German 1-2 | DE1-LF01, DE2-LF02 |
| Italian | Italian 1-2 | IT1-LF01, IT2-LF02 |
| Portuguese | Portuguese 1-2 | PT1-LF01, PT2-LF02 |
| Japanese | Japanese 1-2 | JA1-LF01, JA2-LF02 |
| Mandarin | Mandarin 1-2 | ZH1-LF01, ZH2-LF02 |
| Korean | Korean 1-2 | KO1-LF01, KO2-LF02 |

> **Demo Account Credentials:** See `docs/archive/demo-accounts.md` (CONFIDENTIAL)

---

## Development Metrics

### Project Cost Benchmarks

| Project | Cost | Time | Scope |
|---------|------|------|-------|
| LLM Migration | $7 | 45-60 min | 3 API migrations, 150 lines |
| Institutional Platform | $90 | ~13 hrs | 50+ files, 5,000+ lines, 29 endpoints |
| Super Admin Backend | $6 | 25 min | Backend-only feature |
| Command Center Enhancements | $4 | 20 min | Dual testing, credit grants |

> **Full Metrics:** See `docs/archive/DEVELOPMENT_METRICS.md`

---

*Last updated: December 2025*
