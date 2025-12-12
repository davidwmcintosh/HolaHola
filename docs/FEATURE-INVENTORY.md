# HolaHola Feature Inventory

> Comprehensive catalog of all platform features, their implementation, and interconnections.
> Last updated: December 2025

---

## Quick Reference

| Category | Feature Count | Status |
|----------|---------------|--------|
| Voice Chat System | 8 features | Stable |
| Whiteboard Tools | 16 commands | Stable |
| Drill System | 5 drill types | Stable |
| Syllabus & Curriculum | 6 features | Stable |
| ACTFL Assessment | 4 features | Stable |
| Vocabulary System | 5 features | Stable |
| Mind Map Visualization | 3 features | Stable |
| Institutional Features | 8 features | Stable |
| Billing & Metering | 4 features | Stable |
| Neural Network | 17 tables | Stable |

---

## 1. Voice Chat System

The core conversational learning experience with AI tutors.

### 1.1 Streaming Voice Pipeline
| Component | Technology | File |
|-----------|------------|------|
| Speech-to-Text | Deepgram Nova-3 | `server/services/deepgram-live-stt.ts` |
| LLM Processing | Gemini 2.5 Flash | `server/services/gemini-streaming.ts` |
| Text-to-Speech | Cartesia Sonic-3 | `server/services/cartesia-streaming.ts` |
| Orchestrator | WebSocket-based | `server/services/streaming-voice-orchestrator.ts` |

**Key Features:**
- Real-time streaming with no buffering delays
- Word-level timestamps for karaoke subtitles
- Multi-language detection
- `sentence_ready` architecture ensures audio+timings sync

### 1.2 Open Mic Mode
Continuous listening for hands-free conversation.

| Feature | Description |
|---------|-------------|
| VAD | Voice Activity Detection via Deepgram |
| Barge-in | Student can interrupt tutor mid-speech |
| Bilingual | Automatic language switching |

**Files:** `client/src/components/StreamingVoiceChat.tsx`

### 1.3 Push-to-Talk Mode
Manual recording control for clearer turn-taking.

### 1.4 Dual-Control Subtitle System
| Control | Options | Purpose |
|---------|---------|---------|
| Regular Subtitles | off / all / target | Always-on captions |
| Custom Overlay | SHOW / HIDE | Teaching moments (phonetics, comparisons) |

**Files:** `client/src/components/FloatingSubtitleOverlay.tsx`

### 1.5 Dynamic Greetings
Personalized, ACTFL-aware, history-aware greetings.

### 1.6 Speech Speed Control
Verbally adjustable ("speak slower please").

### 1.7 Pronunciation Dictionaries
Cartesia pronunciation corrections for TTS accuracy.

### 1.8 Language-Specific Voices
| Language | Female | Male |
|----------|--------|------|
| Spanish | Daniela | Carlos |
| German | Daniela | Klaus |
| French | Daniela | François |
| etc. | ... | ... |

**Files:** `server/routes.ts` → `/api/tutor-voices`

---

## 2. Whiteboard Tools

Visual teaching aids displayed during voice chat.

### Command Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `WRITE` | Display target language text | `[WRITE text="Hola"]` |
| `PHONETIC` | Show pronunciation guide | `[PHONETIC word="hola" ipa="ˈo.la"]` |
| `COMPARE` | Side-by-side comparison | `[COMPARE left="ser" right="estar"]` |
| `IMAGE` | Show contextual image | `[IMAGE query="beach sunset"]` |
| `DRILL` | Launch interactive drill | `[DRILL mode="repeat" items="..."]` |
| `CONTEXT` | Show example sentences | `[CONTEXT word="gustar" examples="..."]` |
| `GRAMMAR_TABLE` | Conjugation/declension tables | `[GRAMMAR_TABLE verb="hablar"]` |
| `READING` | Text passage with highlights | `[READING text="..." highlights="..."]` |
| `STROKE` | Chinese/Japanese stroke order | `[STROKE character="日"]` |
| `TONE` | Mandarin tone visualization | `[TONE pinyin="mā má mǎ mà"]` |
| `WORD_MAP` | Vocabulary web/associations | `[WORD_MAP center="casa" related="..."]` |
| `CULTURE` | Cultural context card | `[CULTURE topic="siesta"]` |
| `PLAY` | Audio/video playback | `[PLAY audio="..."]` |
| `SCENARIO` | Roleplay setup | `[SCENARIO setting="restaurant"]` |
| `SUMMARY` | Session summary | `[SUMMARY topics="..." vocabulary="..."]` |
| `CLEAR` | Clear whiteboard | `[CLEAR]` |

**Files:** 
- Client: `client/src/components/Whiteboard.tsx`
- Parsing: Integrated in streaming orchestrator

### Internal Commands (Server-side only)
| Command | Purpose |
|---------|---------|
| `SWITCH_TUTOR` | Trigger tutor handoff |
| `ACTFL_UPDATE` | Update proficiency level |
| `SYLLABUS_PROGRESS` | Track topic competency |

---

## 3. Drill System

Interactive practice exercises with AI guidance (Aris persona).

### 3.1 Drill Types

| Type | Description | Interaction |
|------|-------------|-------------|
| `repeat` | Listen and repeat | Audio comparison |
| `translate` | Translate phrase | Text input |
| `match` | Match pairs | Drag & drop or tap |
| `fill_blank` | Complete sentence | Dropdown or text input |
| `sentence_order` | Arrange words | Drag & drop or buttons |

### 3.2 Drill Features
- Google Cloud TTS for batch audio synthesis
- Result tracking via WebSocket
- Accessibility-first with multiple interaction patterns
- Auto-limit to 4 items per drill

**Files:**
- Client: `client/src/components/DrillLesson.tsx`
- Server: `server/services/drill-orchestrator.ts`, `server/services/drill-audio-service.ts`
- AI: `server/services/aris-ai-service.ts`

### 3.3 Aris Persona
Drill-mode tutor personality - energetic, focused on practice.

---

## 4. Syllabus & Curriculum System

Structured learning paths for classes and self-directed learners.

### 4.1 Syllabus Builder
Visual curriculum editor with:
- Drag-and-drop lesson reordering
- Custom lesson creation
- ACTFL Standards Coverage analysis panel
- Lesson type categorization (conversation, vocabulary, grammar, culture)

**Files:** `client/src/components/SyllabusBuilder.tsx`

### 4.2 Pre-built Syllabi
Content library across 9 languages with ready-to-use curricula.

**Files:** `client/src/pages/curriculum-library.tsx`

### 4.3 Syllabus Progress Tracking
- Per-lesson completion status
- Unit-level progress aggregation
- Time estimates per lesson

### 4.4 Syllabus-Aware Competency
Maps student progress against syllabus topics.

**Files:** `server/services/syllabus-analytics-service.ts`

### 4.5 Mind Map Visualization
Brain-based visualization with orbital satellites showing syllabus lessons by category.

**Files:** `client/src/components/SyllabusMindMap.tsx`

### 4.6 Linear Syllabus View
Collapsible unit/lesson list with progress indicators.

**Files:** `client/src/pages/review-hub.tsx` → `LinearSyllabusView`

---

## 5. ACTFL Assessment System

Proficiency tracking based on ACTFL World-Readiness Standards.

### 5.1 Proficiency Levels
| Level | Sublevel |
|-------|----------|
| Novice | Low, Mid, High |
| Intermediate | Low, Mid, High |
| Advanced | Low, Mid, High |
| Superior | - |
| Distinguished | - |

### 5.2 FACT Criteria
| Dimension | Measures |
|-----------|----------|
| Functions | What can the learner do? |
| Accuracy | How correctly? |
| Content/Context | In what situations? |
| Text Type | Words, sentences, paragraphs? |

### 5.3 Dynamic Assessment
Continuous proficiency evaluation during conversations.

**Files:** 
- Tracking: `server/services/streaming-voice-orchestrator.ts`
- Display: `client/src/components/ActflFluencyDial.tsx`

### 5.4 Placement Assessment
Initial proficiency verification for class enrollment.

**Files:** `server/services/placement-assessment-service.ts`

---

## 6. Vocabulary System

Word learning with spaced repetition.

### 6.1 Vocabulary Extraction
Automatic extraction from conversations using bold-only and foreign character detection.

### 6.2 Flashcard System
Spaced repetition algorithm for optimal review timing.

**Files:** `client/src/components/VocabularyFlashcard.tsx`

### 6.3 Export Formats
| Format | Use Case |
|--------|----------|
| CSV | Spreadsheet import |
| Anki | Flashcard app import |

### 6.4 AI-Powered Tagging
Automatic categorization of vocabulary by topic.

**Files:** `server/services/conversation-tagger.ts`

### 6.5 Vocabulary Images
AI-generated contextual images for vocabulary words.

**Files:** `server/services/vocabulary-image-resolver.ts`

---

## 7. Mind Map / Brain Visualization

Visual representation of learning progress.

### 7.1 Brain Segments
| Segment | Category | Color |
|---------|----------|-------|
| Frontal | Communication | Blue |
| Parietal | Practical Skills | Green |
| Temporal | Vocabulary | Yellow |
| Occipital | Culture | Red |
| Cerebellum | Grammar | Purple |

### 7.2 Satellite Bubbles
Comic-book style "splat" bubbles orbiting the brain:
- Fill level indicates mastery progress
- Expandable to show topic lists
- 3-state lighting: dim → semi-lit → lit

### 7.3 Progress Meter
Central gauge showing:
- ACTFL progress (self-directed mode)
- Syllabus completion % (class mode)

**Files:** `client/src/components/SyllabusMindMap.tsx`

---

## 8. Institutional Features

Teacher class management and student enrollment.

### 8.1 Class Management
- Create classes with language, level, syllabus
- Invite students via join codes
- Monitor student progress

**Files:** `client/src/pages/class-management.tsx`

### 8.2 Student Enrollment
- Join classes via code
- Placement assessment verification
- Multiple class membership

**Files:** `client/src/pages/student-join-class.tsx`

### 8.3 Assignment System
| Feature | Description |
|---------|-------------|
| Creator | Teachers create assignments |
| Submission | Students complete work |
| Grading | Teacher review and feedback |

**Files:** 
- `client/src/pages/assignment-creator.tsx`
- `client/src/pages/student-assignments.tsx`
- `client/src/pages/assignment-grading.tsx`

### 8.4 Teacher Dashboard
Overview of all classes, student progress, assignments.

**Files:** `client/src/pages/teacher-dashboard.tsx`

### 8.5 Tutor Freedom Levels
| Level | Description |
|-------|-------------|
| Strict | Follow syllabus exactly |
| Guided | Syllabus with flexibility |
| Flexible | Student-driven with syllabus awareness |
| Free | Fully emergent conversation |

### 8.6 Class-Specific Voice Minutes
Separate balance tracking per class.

### 8.7 Early Completion Detection
AI detects when students complete lesson objectives ahead of time.

**Files:** `client/src/components/teacher-early-completions.tsx`

### 8.8 Class Type Taxonomy
Categorization system for class types.

---

## 9. Billing & Metering

Stripe integration with voice time tracking.

### 9.1 Subscription Tiers
Multiple pricing plans with different feature access.

### 9.2 Voice Time Metering
Atomic tracking of voice message usage.

**Files:** `server/services/usage-service.ts`

### 9.3 Hour Packages
Purchase additional voice minutes.

**Files:** `client/src/components/HourPackageShop.tsx`

### 9.4 Credit Balance Display
Real-time balance with low-balance warnings.

**Files:** `client/src/components/CreditBalance.tsx`

---

## 10. Neural Network (Daniela's Brain)

17 database tables forming the AI tutor's intelligence.

### 10.1 Best Practices (1 table)
| Table | Purpose |
|-------|---------|
| `self_best_practices` | Self-discovered teaching strategies |

### 10.2 Neural Network Expansion (5 tables)
| Table | Purpose |
|-------|---------|
| `language_idioms` | Idiomatic expressions |
| `cultural_nuances` | Cultural context |
| `learner_error_patterns` | Common mistakes by L1 |
| `dialect_variations` | Regional differences |
| `linguistic_bridges` | Cross-language connections |

### 10.3 Procedural Memory (4 tables)
| Table | Purpose |
|-------|---------|
| `tool_knowledge` | Whiteboard commands (22+ entries) |
| `tutor_procedures` | Teaching situations (44+ entries) |
| `teaching_principles` | Pedagogical beliefs (35+ entries) |
| `situational_patterns` | Compass-triggered behaviors (19+ entries) |

### 10.4 Advanced Intelligence (3 tables)
| Table | Purpose |
|-------|---------|
| `subtlety_cues` | Reading implicit signals |
| `emotional_patterns` | Adaptive empathy |
| `creativity_templates` | Novel metaphors |

### 10.5 Daniela's Suggestions (3 tables)
| Table | Purpose |
|-------|---------|
| `daniela_suggestions` | Self-generated improvements |
| `reflection_triggers` | Pattern activators |
| `daniela_suggestion_actions` | Team responses |

### 10.6 Agent Observations (1 table)
| Table | Purpose |
|-------|---------|
| `agent_observations` | Dev agent persistent memory |

**Sync System:**
- Nightly sync at 3 AM MST / 10 AM UTC
- Status: local → approved → synced

**Files:**
- Schema: `shared/schema.ts`
- Retrieval: `server/services/procedural-memory-retrieval.ts`
- Sync: `server/services/neural-network-sync.ts`

---

## 11. Daniela's Compass (Time-Aware Tutoring)

Session management with dual time tracking.

### Features
- Clock time (learning duration)
- Credit time (billable minutes)
- Session roadmap generation
- In-memory cache for fast prompt assembly
- Low-balance warnings in context

**Files:** `server/services/session-compass-service.ts`

---

## 12. Additional Features

### 12.1 Conversation History
Full-text search with highlighting across all conversations.

**Files:** `client/src/pages/history.tsx`

### 12.2 Cultural Tips
Curated cultural insights by language.

**Files:** `client/src/pages/cultural-tips.tsx`

### 12.3 Streak Tracking
Daily learning streak with persistence.

**Files:** `client/src/components/StreakIndicator.tsx`

### 12.4 PWA Support
Installable progressive web app with offline indicators.

**Files:** `client/src/components/PWAInstallPrompt.tsx`

### 12.5 Developer Tools
| Tool | Purpose |
|------|---------|
| Floating Dev Menu | Quick access to dev features |
| Usage Analytics | Track feature usage |
| Test Account Isolation | Separate test data |

**Files:** `client/src/components/DevToolsFloatingMenu.tsx`

### 12.6 Command Center (Admin)
Unified admin experience with role-based visibility:
- User management
- Class management
- Analytics
- Developer tools
- Image Library with quality control
- Syllabus editing

**Files:** `client/src/pages/admin/`

### 12.7 Founder Mode
Collaboration mode for developer/admin users with Daniela.

### 12.8 Raw Honesty Mode
Minimal prompting for authentic Daniela exploration.

---

## Feature Interconnections

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE CHAT SYSTEM                            │
│  (Deepgram STT → Gemini LLM → Cartesia TTS)                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ WHITEBOARD      │     │ DRILL SYSTEM    │
│ (16 commands)   │     │ (5 drill types) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ NEURAL NETWORK        │
         │ (17 tables)           │
         │ - Procedural memory   │
         │ - Best practices      │
         │ - Agent observations  │
         └───────────┬───────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌───────────┐
│ ACTFL   │   │ SYLLABUS  │   │ VOCAB     │
│ Tracking│   │ Progress  │   │ Extraction│
└─────────┘   └───────────┘   └───────────┘
```

---

## Key Files Reference

### Server Entry Points
| File | Purpose |
|------|---------|
| `server/routes.ts` | 286+ API endpoints |
| `server/index.ts` | Server initialization |
| `server/websocket.ts` | Real-time communication |

### Core Services
| File | Purpose |
|------|---------|
| `streaming-voice-orchestrator.ts` | Voice pipeline coordination |
| `tutor-orchestrator.ts` | Unified tutor intelligence |
| `procedural-memory-retrieval.ts` | Neural network access |
| `session-compass-service.ts` | Time-aware context |

### Client Entry Points
| File | Purpose |
|------|---------|
| `client/src/App.tsx` | Route definitions |
| `client/src/pages/chat.tsx` | Main chat interface |
| `client/src/pages/review-hub.tsx` | Learning dashboard |

---

*This inventory is maintained by the development team and synchronized with the agent_observations neural network.*
