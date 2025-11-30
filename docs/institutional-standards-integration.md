# LinguaFlow B2B Institutional Standards Integration Plan

## ✅ Implementation Status (Updated November 29, 2025)

**Completed Features**:
- ✅ **Milestone 1: Standards Mapping** - ACTFL proficiency levels integrated across all content
- ✅ **Milestone 2: Teacher Dashboard MVP** - Complete class management, student tracking, progress reports
- ✅ **Milestone 3: Assignment System** - Full assignment creation, submission, and grading workflows
- ✅ **Milestone 3.5: Curriculum Paths** - Hierarchical path/unit/lesson structure with management UI
- ✅ **Security & Authorization** - Frontend route guards + backend role-based access control
- ✅ **Form Architecture** - All 6 institutional forms use standardized shadcn Form + zodResolver pattern
- ✅ **Production Polish** - Offline support, mobile responsiveness, security hardening (Nov 24, 2025)
- ✅ **Syllabus-Aware Competency** - Organic learning detection with early completion (Nov 25, 2025)
- ✅ **Conversational Syllabus Navigation** - Students can ask tutor about class progress (Nov 29, 2025)
- ✅ **Unified Learning Filters** - Cross-page filtering by language and class (Nov 29, 2025)
- ✅ **Hybrid Grammar System** - Research-backed grammar instruction combining conversational + explicit drills (Nov 30, 2025)

**Production-Ready Components**:
- Teacher Dashboard with class creation and management
- Assignment Creator (8-field form with validation)
- Assignment Grading interface
- Student Join Class flow (6-character code system)
- Student Assignments view with submission dialog
- Curriculum Builder (3-level hierarchy: paths/units/lessons)
- ProtectedRoute component for teacher-only pages
- OfflineIndicator component with reconnection handling
- Enhanced service worker with comprehensive API caching
- Curriculum Context Service for voice/text tutor integration
- LearningFilterContext for cross-page content filtering
- Grammar Hub with ACTFL-organized competencies and practice drills
- Grammar assignment system for teacher-assigned exercises
- 32+ backend storage methods + 29+ secure API endpoints

**Conversational Syllabus Navigation (Nov 29, 2025)**:
- Students can ask AI tutor about class progress during voice or text conversations
- Supported queries: "What's next?", "Do I have assignments?", "How am I doing?"
- Tutor switch detection: "Let me talk to my Spanish tutor"
- `curriculum-context.ts` service builds context from enrollments, curricula, and assignments
- System prompt integration provides AI tutor with full curriculum awareness

**Unified Learning Filters (Nov 29, 2025)**:
- LearningFilterContext provides shared filter state across pages
- Filter by target language and learning context (class vs self-directed)
- Applied to Review Hub, Vocabulary, Grammar, and Chat History pages
- Persistent filter settings via localStorage

**Production Polish (Nov 24, 2025)**:
- Offline support with automatic reconnection detection
- Mobile-responsive design across all institutional pages
- Unified frontend/backend validation with max-length constraints
- Input sanitization and security hardening

See `replit.md` → Institutional Features Implementation and Production Polish for complete technical details.

---

## Executive Summary

This document outlines how LinguaFlow integrates with state education standards to serve the B2B institutional market (schools, districts, universities). Our goal is to make LinguaFlow the first choice for language teachers by providing comprehensive standards alignment, progress tracking, and administrative features.

## Market Context

### Standards Landscape

**ACTFL (American Council on the Teaching of Foreign Languages)** provides the national framework that most U.S. states adopt:

1. **World-Readiness Standards for Learning Languages** (the "5 C's"):
   - Communication (Interpersonal, Interpretive, Presentational)
   - Cultures
   - Connections
   - Comparisons
   - Communities

2. **ACTFL Proficiency Guidelines 2024** (Latest: April 2024):
   - 11 proficiency levels: Novice Low/Mid/High → Intermediate Low/Mid/High → Advanced Low/Mid/High → Superior → Distinguished
   - Four domains: Speaking, Writing, Listening, Reading
   - Assessment criteria (FACT): Functions, Accuracy, Context/Content, Text Type

3. **NCSSFL-ACTFL Can-Do Statements** (2017):
   - Self-assessment checklists aligned to proficiency levels
   - Students track progress toward specific competencies

### State Adoption
- **Minnesota, Washington**: State law requires ACTFL standards (Minn. Stat.120B.022)
- **California**: 2019 World Languages Standards + 2020 Framework (600 pages)
- **Most states**: Adopted ACTFL standards fully or in modified form
- **Common Core**: Does NOT include foreign language (ACTFL fills this gap)

### Current Market Players
- **Duolingo for Schools**: Free, 500K+ teachers, CEFR/ACTFL aligned, limited to XP tracking
- **PopSuite**: Premium paid, ACTFL-aligned games, spaced repetition
- **AVANT/AAPPL**: Assessment-only tools (not learning platforms)

---

## Phase 1: Core Standards Integration (MVP for Institutional Launch)

### 1.1 Proficiency Level Mapping

**Implementation**: Map all LinguaFlow content to ACTFL proficiency levels

```
Database Schema Addition:
- conversations.actflLevel (novice_low, novice_mid, novice_high, etc.)
- vocabularyWords.actflLevel
- grammarExercises.actflLevel
- messages.actflLevel (auto-tagged by AI based on complexity)
```

**AI System Prompt Update**:
- Add ACTFL level awareness to conversation AI
- Tag vocabulary/grammar by proficiency level in real-time
- Automatically adjust difficulty to match student's current ACTFL level

### 1.2 Can-Do Statements Progress Tracking

**Implementation**: Track student progress against Can-Do benchmarks

```
New Database Tables:
- canDoStatements (id, category, level, statement, language)
- userCanDoProgress (userId, statementId, selfAssessed, teacherVerified, dateAchieved)
```

**Features**:
- Students self-assess against Can-Do statements
- AI automatically tracks evidence of Can-Do achievement during conversations
- Teachers can verify/override AI assessments
- Dashboard shows % completion by category and level

**Example Can-Do Statements** (Spanish Novice-Mid):
- "I can greet someone and introduce myself"
- "I can order simple food items"
- "I can ask and answer questions about weather"

### 1.3 Standards Alignment Documentation

**Deliverable**: PDF "LinguaFlow ACTFL Standards Alignment Guide"

Contents:
- Mapping of LinguaFlow features to 5 C's framework
- Proficiency level progression chart (Novice → Advanced)
- Sample lesson plans aligned to state standards
- Can-Do statement coverage matrix
- CEFR equivalency chart (for international schools)

**Distribution**: Downloadable on website, included in institutional sales materials

---

## Phase 2: Teacher Administrative Features

### 2.1 Teacher Dashboard (Admin Panel)

**Core Features**:

```
New Routes:
- /teacher/dashboard - Overview of all classes
- /teacher/class/:id - Detailed class view
- /teacher/student/:id - Individual student profile
- /teacher/reports - Custom reporting
```

**Dashboard Metrics**:
- Class-level proficiency distribution (% at each ACTFL level)
- Individual student progress charts
- Time on task (total voice minutes, message counts)
- Can-Do statement completion rates
- Vocabulary mastery (SRS statistics)
- Conversation topic coverage
- Assignment completion rates

**Real-Time Activity Feed**:
- Live student activity log (like Duolingo)
- Recent conversations, vocabulary reviews
- Achievements/milestones reached

### 2.2 Classroom Management

**Features**:

1. **Class Creation & Rostering**:
   - Teacher creates classes with join codes
   - CSV bulk student import
   - Integration with Google Classroom/Clever (Phase 3)

2. **Assignment System**:
   - Assign specific conversation topics
   - Set vocabulary review goals
   - Create grammar exercise sets
   - Set due dates and track completion

3. **Custom Voice Message Limits**:
   - Override default limits for institutional accounts
   - Set per-class or per-student allowances

4. **Privacy Controls**:
   - FERPA/COPPA compliant student data handling
   - Teacher approval required for student conversations
   - Content moderation settings

### 2.3 Reporting & Export

**Report Types**:

1. **Student Progress Report** (PDF/CSV):
   - ACTFL proficiency level trajectory
   - Can-Do statement achievements
   - Vocabulary growth chart
   - Time on task summary
   - Recommended next steps

2. **Class Summary Report**:
   - Proficiency distribution histogram
   - Average time on task
   - Engagement metrics
   - Standards coverage map

3. **Parent/Guardian Reports**:
   - Simplified student progress summary
   - Achievements and milestones
   - Practice recommendations

**Export Formats**: PDF, CSV, Excel-compatible

---

## Phase 3: Learning Management System (LMS) Integration

### 3.1 Priority Integrations (Widest Market Reach)

1. **Google Classroom** (K-12 dominant):
   - SSO via Google OAuth
   - Auto-roster sync
   - Assignment creation from Classroom
   - Grade passback to Classroom gradebook

2. **Canvas** (Higher ed + K-12):
   - LTI 1.3 integration
   - Assignment & Grade Sync
   - Deep linking for content

3. **Clever** (K-12 SSO aggregator):
   - Single Sign-On
   - Automated rostering
   - Reduces admin burden (AAPPL integration model)

### 3.2 Technical Implementation

**Standards to Support**:
- LTI 1.3 (Learning Tools Interoperability)
- OAuth 2.0 / OpenID Connect
- SCORM/xAPI for learning activity tracking

**Grade Passback**:
- Automatically sync proficiency assessments to LMS gradebook
- Map ACTFL levels to letter grades (configurable by teacher)
- Track Can-Do statement completion as assignments

---

## Phase 4: Curriculum & Assessment Alignment

### 4.1 Pre-Built Curriculum Paths

**Implementation**: Create standards-aligned curriculum sequences

**Examples**:

1. **Spanish 1 (High School) - 150 hours**:
   - Units aligned to ACTFL Novice Low → Intermediate Low
   - Covers California WL Standards Communication domains
   - Integrated cultural tips (Cultures standard)
   - Cross-disciplinary topics (Connections standard)

2. **French 2 (High School) - 150 hours**:
   - Intermediate Low → Intermediate High
   - Focus on paragraph-level discourse
   - Cultural comparisons (Comparisons standard)

3. **Mandarin for Heritage Speakers**:
   - Accelerated proficiency progression
   - Cultural identity exploration
   - Reading/writing emphasis

**Teacher Control**:
- Teachers can customize sequences
- Add/remove topics, adjust pacing
- Align to district-specific curriculum maps

### 4.2 Integrated Performance Assessments (IPA)

**Status**: 🔜 Planned for future implementation

**ACTFL IPA Model**: Combine all 3 communication modes around a common theme

**Proposed LinguaFlow Implementation**:

```
Example IPA: "Planning a Trip to Mexico"

1. Interpretive (Listening/Reading):
   - Student listens to AI-generated travel podcast
   - Reads authentic hotel reviews
   - Answers comprehension questions

2. Interpersonal (Conversation):
   - Voice chat with AI tutor about trip preferences
   - Negotiate hotel booking, ask about local customs

3. Presentational (Speaking/Writing):
   - Record a video presentation about planned itinerary
   - Write a blog post reflection on cultural research
```

**Planned Features**:
- AI auto-scores interpretive tasks
- Teachers manually score presentational tasks using ACTFL rubrics
- Built-in rubric templates (customizable)
- Integration with existing assignment system

**Current Workaround**: Teachers can approximate IPA tasks using existing features:
- **Interpersonal Mode**: Create conversation-based assignments with AI tutor
- **Presentational Mode**: Create written submission assignments
- **Grading**: Use ACTFL Can-Do statements as rubric guidance for manual scoring

### 4.3 Seal of Biliteracy Support

**State Seals** (e.g., California):
- Recognition for high school graduates with proficiency in English + 1+ other languages

**LinguaFlow Support**:
- Track progress toward Intermediate Mid proficiency (typical requirement)
- Generate documentation for Seal applications
- Provide ACTFL-aligned assessment data
- Practice tests mimicking official assessments (AAPPL, AVANT)

---

## Phase 5: Advanced Features (Competitive Differentiation)

### 5.1 AI-Powered Curriculum Recommendations

**Feature**: AI analyzes student performance and recommends personalized learning paths

**Implementation**:
- Use performance data (vocabulary mastery, conversation fluency, grammar accuracy)
- Recommend specific topics, difficulty adjustments
- Suggest Can-Do statements to focus on next
- Alert teachers to students needing intervention

### 5.2 Collaborative Learning Features

**Peer-to-Peer Conversations**:
- Students practice with classmates via voice chat
- AI monitors and provides feedback to both parties
- Teacher can review conversation transcripts

**Class Challenges**:
- Whole-class vocabulary competitions
- Collaborative cultural research projects
- Inter-class conversation exchanges (different schools)

### 5.3 Cultural Competency Tracking

**Beyond Language**: Track cultural learning outcomes

**Implementation**:
- Tag cultural tips by ACTFL Cultures standard sub-categories
- Track student engagement with cultural content
- Assess cultural understanding through conversation analysis
- Generate cultural competency reports for teachers

---

## Pricing Strategy for Institutional Market

### Recommended Pricing

**Institutional Tier**: $7/seat/month (annual billing)
- **Break-even analysis**: At 45 hours/year average (Spanish 1 equivalent)
  - Cost: ~$81/student in GPT-4o-mini API costs
  - Revenue: $84/student/year
  - **Profitable with modest usage**

**Value Proposition**:
- Unlimited voice chat (vs. 20 messages/month for free tier)
- Teacher dashboard and admin features
- Standards-aligned reporting
- LMS integration
- Dedicated support
- Professional development resources

**Comparison to Competition** (Updated November 2025):

| Competitor | Pricing | Voice Tutoring | ACTFL | Key Limitations |
|------------|---------|----------------|-------|-----------------|
| **LinguaFlow** | **$50-100/student/year** | ✅ Full AI voice | ✅ Full | - |
| Rosetta Stone Schools | ~$125/student/year | ❌ Drills only | ⚠️ Claims | No conversational AI, TruAccent only |
| Duolingo for Schools | Free | ❌ Text AI only | ❌ None | No real-time voice, no teacher controls |
| Jumpspeak | $80/year (consumer) | ⚠️ Limited | ❌ None | Mobile-only, no institutional features |
| Babbel | $84-130/year (consumer) | ❌ None | ❌ None | Live tutoring $99-249/mo extra |
| Pimsleur | $165/year (consumer) | ❌ Audio only | ❌ None | Pre-recorded content, no interactivity |
| Talkpal | $60-72/year (consumer) | ✅ GPT text/voice | ❌ None | No curriculum integration, teams only |

**LinguaFlow Competitive Advantages:**

| vs. Competitor | LinguaFlow Advantage |
|----------------|---------------------|
| **Rosetta Stone** | Live AI conversation vs. scripted drills; 75% cheaper for schools |
| **Duolingo** | True voice tutoring vs. text AI; full teacher controls and curriculum |
| **Jumpspeak** | Desktop/web access; ACTFL standards; full institutional features |
| **Babbel** | AI voice tutoring included vs. $99-249/mo add-on for live classes |
| **Pimsleur** | Interactive AI dialogue vs. passive audio; teacher dashboards |
| **Talkpal** | ACTFL alignment; curriculum integration; assignment grading system |

**Key Differentiators:**
- **Only platform** with full ACTFL Can-Do statement tracking
- **Teacher-assignable grammar** with completion and score tracking
- **Curriculum builder** with paths, units, and lessons
- **Syllabus-aware AI** that recognizes organic learning during conversations
- **75% cheaper** than human tutors with 24/7 availability

---

## Implementation Roadmap

### ✅ Milestone 1: Standards Mapping (COMPLETED)
- [x] Map all content to ACTFL proficiency levels
- [x] Create Can-Do statements database
- [x] Update AI prompts with proficiency awareness
- [x] Write ACTFL alignment documentation (PDF)

### ✅ Milestone 2: Teacher Dashboard MVP (COMPLETED)
- [x] Build teacher role and permissions
- [x] Create class management UI
- [x] Implement student progress tracking
- [x] Build basic reporting (student & class reports)
- [x] Add ProtectedRoute component for frontend authorization

### ✅ Milestone 3: Assignment System (COMPLETED)
- [x] Create assignment types (practice, homework, quiz, project)
- [x] Build assignment creation UI (8-field form with validation)
- [x] Track completion and scoring
- [x] Build assignment grading interface
- [x] Implement student submission dialog
- [x] Add student join class flow with 6-character codes

### ✅ Milestone 3.5: Curriculum Paths (COMPLETED)
- [x] Design hierarchical curriculum structure (paths/units/lessons)
- [x] Build curriculum builder UI with 3 nested dialogs
- [x] Implement auto-ordering for units and lessons
- [x] Add language and target level selection
- [x] Create publish/draft workflow

### Milestone 4: Google Classroom Integration (2 weeks)
- [ ] OAuth integration
- [ ] Roster sync
- [ ] Assignment sync
- [ ] Grade passback

### Milestone 5: Curriculum Paths (3 weeks)
- [ ] Design Spanish 1-4 curriculum sequences
- [ ] Design French 1-3 sequences
- [ ] Create IPA templates
- [ ] Build curriculum assignment UI

### Milestone 6: Canvas/Clever Integration (3 weeks)
- [ ] LTI 1.3 provider setup
- [ ] Clever SSO integration
- [ ] Test with partner schools

**Total Implementation Time**: ~15 weeks (3.75 months)

---

## Go-to-Market Strategy

### Target Markets (Priority Order)

1. **California** (largest language ed market):
   - 6.2M K-12 students
   - Strong world language requirements (2 years for UC/CSU)
   - Active Seal of Biliteracy programs
   - 2019 standards adoption = recent focus

2. **Texas** (2nd largest):
   - 5.5M K-12 students
   - Growing bilingual education emphasis

3. **New York** (3rd largest):
   - 2.7M K-12 students
   - Strong language education tradition

### Sales Channels

1. **Direct to Teachers** (freemium funnel):
   - Teachers try free tier personally
   - Discover value of voice chat
   - Upgrade to institutional for their classes

2. **District Pilots**:
   - Offer 3-month free pilot to districts
   - Target world language department heads
   - Demonstrate ROI with data

3. **Conference Presence**:
   - ACTFL Annual Convention (4,000+ attendees)
   - State language teacher association conferences (CLTA, etc.)
   - EdTech conferences

4. **Content Marketing**:
   - Blog posts on ACTFL standards implementation
   - Free resources: lesson plans, Can-Do checklists
   - Webinars for language teachers

### Key Messaging

**For Teachers**:
- "The only AI language tutor built for your ACTFL standards"
- "Track every Can-Do statement, automatically"
- "Turn 20 minutes of homework into real conversation practice"

**For Administrators**:
- "ACTFL-aligned voice conversation at $7/student/year"
- "Save $100+ per student vs. Rosetta Stone"
- "One teacher manages 150 students with automated tracking"

---

## Competitive Advantages

1. **Only AI voice tutor with ACTFL integration**: Duolingo lacks real-time voice, others lack AI
2. **Affordable institutional pricing**: Undercuts Rosetta Stone by 95%
3. **Teacher-first design**: Unlike consumer apps, built for classroom use
4. **Real conversation practice**: Not just gamified drills
5. **Comprehensive tracking**: Auto-generated standards-aligned reports
6. **Organic learning detection**: Recognizes curriculum coverage during free practice (syllabus-aware competency)
7. **Conversational syllabus access**: Students can ask tutor about assignments and progress naturally
8. **Mid-conversation tutor switching**: Students can seamlessly switch between language tutors
9. **Unified learning context**: Filter all content by class enrollment for focused practice

---

## Success Metrics

### Year 1 Goals (B2B Focus)
- 50 schools/districts using institutional tier
- 5,000 student seats sold
- $420K ARR from institutional tier
- 80%+ teacher satisfaction (NPS 50+)
- 70%+ student weekly active usage

### Year 2 Goals
- 300 schools/districts
- 30,000 student seats
- $2.52M ARR
- Expand to 4+ LMS integrations
- Launch Spanish 1-4 complete curriculum

---

## Next Steps

1. **Validate with pilot teachers** (5-10 early adopters):
   - Show mockups of teacher dashboard
   - Get feedback on reporting needs
   - Test standards alignment documentation

2. **Build MVP teacher dashboard** (Milestone 2):
   - Start with manual class creation
   - Focus on progress tracking
   - Get data flowing to teachers

3. **Create alignment documentation** (Milestone 1):
   - Essential for institutional sales
   - Demonstrates serious commitment to education market

4. **Establish partnerships**:
   - Connect with ACTFL for endorsement opportunities
   - Partner with state language teacher associations
   - Pilot with 2-3 forward-thinking districts
