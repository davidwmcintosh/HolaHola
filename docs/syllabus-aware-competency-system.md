# Syllabus-Aware Competency System

## Executive Summary

LinguaFlow's Syllabus-Aware Competency System automatically recognizes when students naturally cover curriculum topics during their AI conversation practice. Instead of forcing students through redundant lessons they've already mastered, the system detects organic learning and allows early completion with teacher verification.

**Key Benefits:**
- Students progress faster by getting credit for what they already know
- Teachers save time with automated competency tracking
- Personalized learning paths adapt to each student's actual progress
- Higher engagement as students see their natural conversations contributing to class goals

---

## For Students

### What This Means For You

When you practice conversations with your AI tutor, the system now tracks what you're learning and compares it to your class syllabus. If you naturally cover topics that are coming up in your class, you'll get credit for them!

### How It Works

1. **Practice Naturally**: Have conversations with your AI tutor about topics that interest you
2. **Automatic Recognition**: The system analyzes what vocabulary, grammar, and topics you're demonstrating
3. **Early Credit**: If you cover enough of an upcoming lesson (80%+ competency), you can complete it early
4. **Teacher Approval**: Your teacher reviews and approves your organic progress
5. **Move Forward**: Skip redundant lessons and focus on what you actually need to learn

### Viewing Your Progress

In your **Assignments** page, look for the **Progress** tab to see:
- Lessons you've covered through conversations
- Your competency scores broken down by:
  - Topics covered (40% of score)
  - Vocabulary mastered (35% of score)
  - Grammar demonstrated (25% of score)
  - Pronunciation quality (must meet minimum threshold)
- Coverage percentages with visual progress bars
- Quick review options for any gaps

### Tips for Students

- Talk about diverse topics in your conversations to cover more vocabulary
- Don't worry about "studying for the test" - natural conversation practice works best
- Check your Progress tab regularly to see what you've accomplished
- Celebrate when you see "Completed Early" badges!

---

## For Teachers

### Overview

The Syllabus-Aware Competency System gives you visibility into how students are progressing through organic conversation practice, not just formal assignments.

### Key Features

#### Organic Progress Tracking
- See which students have covered curriculum topics through natural AI conversations
- View detailed competency breakdowns for each lesson
- Compare organic progress vs. assigned completion rates

#### Verification Workflow
1. Navigate to **Class Management** > **Organic Progress** tab
2. Review students who have demonstrated competency
3. See detailed breakdowns:
   - Topic coverage percentage
   - Vocabulary words mastered
   - Grammar concepts demonstrated
   - Pronunciation scores
4. Click **Verify Completion** to approve early completions
5. Add optional notes about the student's progress

#### Evidence-Based Assessment
Each early completion includes:
- Conversation IDs that demonstrate competency
- Specific vocabulary words used correctly
- Grammar structures demonstrated
- Average pronunciation scores

### Teacher Dashboard Features

**Organic Progress Tab** shows:
- Student avatars with early completion counts
- Expandable cards with competency details
- Verification buttons for quick approval
- Filter and sort by completion date or coverage

**Student Detail View** includes:
- Visual progress bars for each competency area
- List of covered vs. missing topics
- Direct links to evidence conversations
- Quick actions for verification or review

### Best Practices for Teachers

1. **Review Weekly**: Check the Organic Progress tab weekly to acknowledge student achievements
2. **Celebrate Progress**: Use the congratulatory messaging feature - students hear acknowledgment in voice chat
3. **Spot Struggling Students**: Low organic coverage may indicate students who need extra support
4. **Adjust Pacing**: If many students show early completion, consider accelerating the syllabus

---

## For Developers

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Competency Verification Flow                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Conversation → Topic Tagging → Vocabulary Extraction           │
│       ↓              ↓                    ↓                     │
│  Messages     Covered Topics      Demonstrated Words            │
│       ↓              ↓                    ↓                     │
│       └──────────────┴────────────────────┘                     │
│                      ↓                                          │
│            Competency Verifier                                  │
│                      ↓                                          │
│    ┌─────────────────┴─────────────────┐                        │
│    │   Weighted Scoring (80% threshold) │                        │
│    │   • Topics: 40%                    │                        │
│    │   • Vocabulary: 35%                │                        │
│    │   • Grammar: 25%                   │                        │
│    │   + Pronunciation gate             │                        │
│    └─────────────────┬─────────────────┘                        │
│                      ↓                                          │
│         SyllabusProgress Record                                 │
│                      ↓                                          │
│    [Student UI] ← → [Teacher Dashboard]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

#### syllabusProgress Table
```typescript
{
  id: string (UUID)
  studentId: string (FK → users)
  classId: string (FK → teacherClasses)
  lessonId: string (FK → curriculumLessons)
  status: 'not_started' | 'in_progress' | 'completed_early' | 'completed'
  evidenceType: string // 'organic_conversation' | 'assignment' | 'tutor_verified'
  topicsCoveredCount: integer
  vocabularyMastered: integer
  grammarScore: real (0-1)
  pronunciationScore: real (0-1, nullable)
  evidenceConversationId: string (FK → conversations)
  tutorVerified: boolean
  tutorNotes: text
  completedAt: timestamp
  daysAhead: integer
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### curriculumLessons Extensions
```typescript
{
  // ... existing fields
  requiredTopics: text[] // Topic names that must be covered
  requiredVocabulary: text[] // Vocabulary words required
  requiredGrammar: text[] // Grammar concepts required
  minPronunciationScore: integer // 0-100, default 70
}
```

### Key Service: competency-verifier.ts

#### Core Functions

**checkLessonCompetency(studentId, classId, lessonId)**
- Fetches all conversations for the student in the class
- Extracts covered topics via conversation tagging
- Analyzes vocabulary using Gemini AI
- Calculates weighted coverage score
- Returns recommendation: 'complete_early' | 'partial_progress' | 'needs_work'

**checkUpcomingLessonsForEarlyCompletion(studentId, classId)**
- Scans all curriculum lessons not yet completed
- Returns sorted list of lessons with progress above 40%
- Used for proactive early completion detection

**markLessonAsOrganicallyCompleted(studentId, classId, lessonId, competencyResult, tutorVerified)**
- Creates or updates syllabusProgress record
- Stores evidence conversation IDs
- Records competency breakdown

**generateCongratulatoryPromptAddition(studentId, classId)**
- Returns prompt text for voice chat system prompt
- Acknowledges when student is ahead of syllabus
- Integrated into streaming voice orchestrator

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/competency/:classId/:lessonId` | Check competency for specific lesson |
| POST | `/api/syllabus/mark-complete` | Mark lesson as completed early |
| GET | `/api/syllabus-progress/:classId` | Get student's syllabus progress |
| GET | `/api/teacher/classes/:classId/early-completions` | Get all early completions for class |
| POST | `/api/teacher/verify-completion` | Teacher verifies early completion |

### Storage Interface Methods

```typescript
interface IStorage {
  // Syllabus Progress
  createSyllabusProgress(data: InsertSyllabusProgress): Promise<SyllabusProgress>;
  getSyllabusProgress(studentId: string, classId: string): Promise<SyllabusProgress[]>;
  getSyllabusProgressByLesson(studentId, classId, lessonId): Promise<SyllabusProgress | undefined>;
  updateSyllabusProgress(id: string, data: Partial<SyllabusProgress>): Promise<SyllabusProgress>;
  getEarlyCompletions(classId: string): Promise<Array<SyllabusProgress & { student: User; lesson: CurriculumLesson }>>;
}
```

### Frontend Components

#### SyllabusProgress.tsx
- Displays competency scores with visual progress bars
- Shows topic/vocabulary/grammar/pronunciation breakdown
- Located in student assignments page under "Progress" tab

#### TeacherEarlyCompletions.tsx
- Lists students with organic progress
- Expandable cards with competency details
- Verification workflow with approve/deny buttons
- Located in class management under "Organic Progress" tab

### Voice Chat Integration

In `server/unified-ws-handler.ts`, the start_session handler:
1. Checks if conversation has a classId
2. Calls `generateCongratulatoryPromptAddition(userId, classId)`
3. Appends result to system prompt if student has early completions

This enables the AI tutor to naturally acknowledge student progress during conversations.

### Weighting Algorithm

```typescript
const weights = { topics: 0.4, vocab: 0.35, grammar: 0.25 };
const weightedCoverage = 
  (topicPercent * weights.topics) + 
  (vocabPercent * weights.vocab) + 
  (grammarPercent * weights.grammar);

// Recommendation logic
if (weightedCoverage >= 80 && pronunciationPassed) {
  recommendation = 'complete_early';
} else if (weightedCoverage >= 40) {
  recommendation = 'partial_progress';
} else {
  recommendation = 'needs_work';
}
```

---

## For Sales & Business

### Value Proposition

**Problem Solved:**
Traditional language courses force students through predetermined lesson sequences, regardless of what they already know. This wastes time, reduces engagement, and doesn't account for real-world learning that happens outside the classroom.

**Our Solution:**
LinguaFlow's Syllabus-Aware Competency System automatically detects when students master curriculum topics through natural AI conversation practice, allowing them to skip ahead and focus on what they actually need to learn.

### Key Selling Points

#### For Institutional Sales (Schools, Universities)

1. **Personalized at Scale**
   - Every student gets a customized learning path
   - No manual assessment required - it's automatic
   - Teachers save hours on progress tracking

2. **Measurable Outcomes**
   - Detailed competency metrics per student
   - Evidence-based assessment with conversation records
   - Analytics on organic vs. assigned completion rates

3. **Higher Engagement**
   - Students see immediate value in conversation practice
   - Gamification through early completion recognition
   - AI tutor celebrates achievements in real-time

4. **ACTFL Alignment**
   - Competency tracking follows ACTFL World-Readiness Standards
   - Proficiency-based assessment built-in
   - Ready for accreditation requirements

#### For B2C Marketing

1. **Learn Faster**
   - Get credit for what you already know
   - Skip redundant lessons automatically
   - Focus on gaps, not repetition

2. **Natural Learning**
   - Just have conversations - we track your progress
   - No boring drills or memorization
   - Practice what interests you

3. **Visible Progress**
   - See exactly what you've mastered
   - Track competency in real-time
   - Celebrate early completions

### Competitive Differentiators

| Feature | LinguaFlow | Traditional LMS | Other AI Tutors |
|---------|------------|-----------------|-----------------|
| Automatic competency detection | Yes | No | Limited |
| Early completion recognition | Yes | Manual only | No |
| Evidence-based assessment | Yes | Manual | No |
| ACTFL alignment | Yes | Varies | No |
| Teacher verification workflow | Yes | N/A | No |
| Voice-integrated acknowledgment | Yes | No | No |

### Pricing Implications

This feature adds significant value for institutional customers:
- Reduces teacher workload by 30-40% on assessment
- Increases student engagement and completion rates
- Provides data for institutional accreditation
- Enables outcome-based pricing models

### Demo Script

1. Show a student having a natural conversation about food
2. Switch to Progress tab - show competency detection in real-time
3. Open teacher dashboard - show Organic Progress tab
4. Demo teacher verification workflow
5. Return to student view - show voice tutor acknowledging progress
6. Highlight the metrics and evidence trail

---

## Appendix: Configuration

### Environment Variables

No additional environment variables required. The system uses existing:
- `DATABASE_URL` - PostgreSQL connection
- `GEMINI_API_KEY` - For vocabulary/grammar extraction
- `SESSION_SECRET` - For authentication

### Minimum Requirements

For competency detection:
- Students must have conversations tagged to a class
- Curriculum lessons must have `requiredTopics`, `requiredVocabulary`, and/or `requiredGrammar` arrays populated
- `minPronunciationScore` defaults to 70 if not set

### Feature Flags

Currently no feature flags. The system is always active for students enrolled in classes with defined curricula.

---

*Documentation Version: 1.0*
*Last Updated: November 2025*
*System: LinguaFlow Syllabus-Aware Competency System*
