# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

---

## Pending Updates

### [December 6, 2025] - Phase 2 Dual Time Tracking for Students
**Target:** TECHNICAL-REFERENCE.md
**Section:** API Endpoints / Services
**Content:**
New analytics service and endpoints for student time tracking:

**SyllabusAnalyticsService** (`server/services/syllabus-analytics-service.ts`):
- Aggregates expected vs actual time spent per syllabus lesson
- Joins syllabusProgress, voiceSessions, and curriculum tables
- Uses existing data relationships (syllabusProgress.evidenceConversationId → voiceSessions.conversationId)
- Caching: Credit balance 1-min TTL, session data 5-min TTL

**API Endpoints:**
- `GET /api/analytics/syllabus-time/:classId` - Returns detailed time breakdown per unit/lesson for authenticated student
- `GET /api/analytics/pace-summary?classId={optional}` - Returns weekly learning pace, streak, and stats

**Response shapes documented in syllabus-analytics-service.ts interfaces.**

---

### [December 6, 2025] - Learning Pace UI Components
**Target:** USER-MANUAL.md
**Section:** Dashboard / Progress Tracking
**Content:**
New student-facing components for time awareness:

**Learning Pace Card** (Dashboard sidebar):
- Shows lessons completed, total time learned, current streak
- 8-week activity sparkline showing weekly learning trends
- Average minutes per lesson calculation
- Visible on larger screens in dashboard sidebar

**Syllabus Time Progress** (Review Hub - class context only):
- Shows expected vs actual time per syllabus unit
- Collapsible unit details with lesson-level breakdown
- Green/amber color palette (no red - "learning journey" not "budget surveillance")
- Progress indicators per unit
- Only appears when viewing a class context (not self-directed learning)

---

### [December 6, 2025] - Design Philosophy Update
**Target:** ROADMAP.md
**Section:** Recently Completed / Phase 2
**Content:**
Phase 2 Dual Time Tracking complete:
- Student-facing time displays showing expected vs actual learning time per syllabus section
- Weekly learning pace trends with credit consumption visibility
- UX philosophy: Frame as "learning journey" not surveillance - green/amber colors only
- Uses existing data relationships rather than new schema fields

---

### [December 6, 2025] - Tutor Autonomy: Natural Session Openings
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / System Prompt Architecture
**Content:**
"Freeing Daniela" update - reducing prescriptive constraints on tutor behavior:

**Speed Control Removed:**
- Removed voice speed slider from ImmersiveTutor UI
- Students now ask Daniela to repeat slowly (e.g., "Can you say that again slower?")
- This is itself valuable language practice and keeps tutor in control of pacing

**Greeting Prompt Simplified:**
- `buildGreetingPrompt()` in streaming-voice-orchestrator.ts now provides context-only bullet points
- Ends with simple directive: "speak first with a natural opening message"
- No more prescriptive scripts for different student types

**System Prompt Addition:**
- Added "OPENING SESSIONS NATURALLY" section to IMMUTABLE_PERSONA
- Guidance for different scenarios (returning student, class student, new student, after break)
- Philosophy: "Read the context, trust your instincts, be yourself"

---

### [December 6, 2025] - Tutor Autonomy: Design Philosophy
**Target:** ROADMAP.md
**Section:** Recently Completed / Design Philosophy
**Content:**
"Freeing Daniela" philosophy reinforcement:
- Tutors ARE the product - everything else is infrastructure to help them shine
- Provide rich context about WHO the student is, not scripts for HOW to teach
- Real tutors synthesize context and make judgment calls - AI tutors should too
- Removed speed control UI (students ask tutor directly - language practice)
- Replaced greeting scripts with context bullets + simple directive

---

## Instructions

When user says "add to the batch" or "batch doc updates":
1. Add the item below with date and description
2. Reference which master doc should be updated
3. Include any code snippets or details needed

## Update Format

```markdown
### [Date] - Brief Description
**Target:** USER-MANUAL.md | TEACHER-GUIDE.md | ADMIN-GUIDE.md | TECHNICAL-REFERENCE.md | ROADMAP.md
**Section:** Which section to update
**Content:**
Details to add...
```

---

## Archive

Previous batch updates that have been applied:

- _(December 2025)_ Consolidated 21 scattered docs into 5 master documents:
  - USER-MANUAL.md - Learner-facing guide
  - TEACHER-GUIDE.md - Educator features
  - ADMIN-GUIDE.md - Command Center administration
  - TECHNICAL-REFERENCE.md - API and architecture
  - ROADMAP.md - Future features
