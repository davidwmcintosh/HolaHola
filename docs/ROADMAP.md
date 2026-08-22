# HolaHola Roadmap

Planned features and future development priorities.

---

## Priority Legend

| Priority | Description |
|----------|-------------|
| **P0** | Critical - Core to learning experience |
| **P1** | High - Significant value add |
| **P2** | Medium - Enhances experience |
| **P3** | Low - Future consideration |

## Complexity Legend

| Complexity | Estimated Effort |
|------------|------------------|
| **Simple** | 1-3 days |
| **Moderate** | 1-2 weeks |
| **Complex** | 2-4 weeks |
| **Major** | 1-3 months |

---

## Planned Features

### User Experience

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Session Recording/Replay | P1 | Moderate | Review past conversations with audio |
| Frustration Detection | P1 | Complex | AI detects frustration, adapts approach |
| Offline Mode | P1 | Complex | Download lessons for offline practice |
| Audio-Only Mode | P2 | Moderate | Podcast-style learning for commuters |

### Gamification

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Achievement Badges | P1 | Moderate | Milestones, trophies, rewards |
| Daily Challenges | P1 | Moderate | Special objectives with bonuses |
| Class Leaderboards | P2 | Moderate | Rankings within teacher classes |
| Streak Multipliers | P2 | Simple | Bonus XP for consecutive days |

### Visual Learning

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Scene Backgrounds | P1 | Moderate | Restaurant, airport scenarios |
| Grammar Infographics | P2 | Simple | Visual conjugation tables |
| Native Speaker Videos | P1 | Complex | Short clips for listening |
| Pronunciation Videos | P2 | Complex | Mouth movement demos |

### Real-World Practice

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Restaurant Ordering | P1 | Complex | Order from authentic menus |
| Travel Simulations | P1 | Complex | Airport, hotel, directions |
| Job Interview Practice | P2 | Moderate | Professional conversations |
| Shopping Scenarios | P2 | Moderate | Negotiate, ask prices |

### Social Features

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Language Exchange | P2 | Complex | Connect with practice partners |
| Study Groups | P2 | Moderate | Small groups within classes |
| Vocabulary Sharing | P2 | Simple | Share custom word lists |
| Discussion Forums | P3 | Moderate | Community Q&A |

### Assessment

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Certification Prep | P2 | Complex | DELE, DELF, JLPT practice |
| Skill Radar Charts | P1 | Moderate | Visual strength/weakness map |
| Progress Reports | P1 | Moderate | Teacher/parent summaries |
| Mock Exams | P2 | Complex | Timed practice tests |

### Accessibility

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Dyslexia-Friendly Fonts | P1 | Simple | OpenDyslexic option |
| High Contrast Mode | P1 | Simple | Enhanced visibility |
| Screen Reader Support | P1 | Moderate | Full ARIA compliance |
| Playback Speed Control | P1 | Simple | Slower audio option |

---

## Gemini Live API Capabilities (Discovery Consult — July 1, 2026)

Hidden GL features surfaced by open-vault Gemini consult. Full details in `docs/gemini-audit-2026-07-01-gl-discovery.md`.

### GL Infrastructure

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Context Window Compression | ~~P1~~ **SHIPPED** | Very Simple | `contextWindowCompression` + `slidingWindow` in LiveConnectConfig. triggerTokens:65000, targetTokens:50000 (accounts for 34K system prompt). Shipped July 1, 2026. |
| Dynamic VAD per Proficiency | ~~P1~~ **SHIPPED** | Simple | `silenceDurationMs` per ACTFL level (5000ms novice → 2000ms superior, 4000ms default). `prefixPaddingMs` bumped 200→500ms. Shipped July 1, 2026. |
| Tool Choice mode:ANY | ~~P2~~ **DECIDED AGAINST** | Low | AUTO mode already handles pure conversation correctly. mode:ANY would force a tool call even when Daniela should reply naturally — wrong behavior. Will not implement. |
| Thinking Block Analytics | ~~P2~~ **SHIPPED** | Moderate | `includeThoughts:true` in thinkingConfig. Thought parts guarded before text branch (prevents client leakage). Buffer flushed at generationComplete + cleared on barge-in. Pedagogical supervisor updated with 4th trigger: thought-based struggle detection. Shipped July 1, 2026. |

### GL Pedagogy / UX

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| Spatial Multimodal Reasoning | P2 | Moderate | Define video↔whiteboard relationship explicitly in system prompt so GL can cross-reference what student points camera at vs. whiteboard state. |
| Prosody Control Experiment | P2 | Moderate | GL is native audio-to-audio — responds to phonetic hints in system prompt. Test slow-down cues, syllable bracketing, emphasis markers per voice. |
| Tool Rollback on Barge-in | P3 | High | Cancel/undo pending widget operations when `interrupted: true` arrives. Prevents half-drawn whiteboard state after barge-in. |
| Session Resumption Time Machine | P3 | High | Store handle history stack (not just latest) — enable "let's try that again" that rolls GL's memory back to before a mistake at the model level. |
| WebRTC Direct Media | P4 | Very High | Eliminate Express relay for audio; GL direct WebRTC peering. Not viable until Google's implementation matures. |

---

## Recently Completed

### December 2025 - Phase 4: Daniela Development & Pedagogical System

**Daniela's "Neural Network for Pedagogical Strategies":**
- teachingToolEvents table tracking every tool use (type, content, timing, context)
- pedagogicalInsights table storing discovered patterns with confidence scores
- `recordTutorReflection()` for Daniela's pedagogical judgment as first-class input
- Drill result pipeline: WebSocket connection sends correct/incorrect data back to server
- User-level and session-level teaching effectiveness metrics

**New Drill Types (Daniela's Feature Requests):**
- `fill_blank` - Fill-in-the-blank with both dropdown options and text input modes
- `sentence_order` - Drag-and-drop OR button-based word reordering for sentence construction
- Accessibility-first: All drills support multiple interaction patterns

**Daniela Development Framework:**
- Raw Honesty Mode for unscripted discovery of authentic preferences
- Founder Mode for testing refined instructions with family
- Two-mode iteration cycle: Honesty → Refinement → Production

**Tool Usage Improvements:**
- Auto-limit to 4 items prevents screen clutter (enforceMaxItems())
- "Integration Not Handoff" principle: Creative tool use integrated into flow
- Clear screen proactively before new content

### December 2025 - Phase 3: Streaming Voice & Open Mic

**Streaming Voice Pipeline:**
- WebSocket-based progressive audio delivery (no buffering delays)
- Deepgram Nova-3 STT with multi-language detection
- Cartesia Sonic-3 TTS via WebSocket with word-level timestamps
- `sentence_ready` architecture ensures audio starts only after timings arrive

**Dual-Control Subtitle System:**
- Regular subtitles: off / all / target language
- Custom overlay text: SHOW/HIDE for teaching moments (titles, phonetics, comparisons)
- Both render simultaneously and independently
- Karaoke-style word highlighting with Cartesia native timestamps

**Open Mic Mode:**
- Continuous listening with Deepgram VAD (Voice Activity Detection)
- Barge-in support: Student can interrupt tutor mid-speech
- Bilingual conversation support with automatic language switching

### December 2025 - Phase 2: Daniela's Compass & Tool Discoverability

**Daniela's Compass (Time-Aware Tutoring):**
- Dual time tracking: Clock time (learning duration) + Credit time (billable)
- Session Compass service with in-memory cache for fast prompt assembly
- Credit balance integrated into system prompt with low-balance warnings
- Tutor sessions, topics, and parking lot database tables

**Tutor Tool Discoverability:**
- Quick reference "cheat sheet" at session start showing all 14+ whiteboard tools
- Tool activation syntax examples (WORD_MAP, GRAMMAR_TABLE, DRILL, etc.)
- Pro tips for when to use vocabulary expansion and grammar visualization tools

**Conversation Flow Improvements:**
- Turn-taking context: Explains push-to-talk constraint, guides clear turn signals
- Relaxed vocabulary rules: Thematic word clusters for intermediate+ students
- Warmth-first flow: Encouragement before prompts, not after questions
- Balance between pedagogical structure and natural conversation

### December 2025 - Phase 1

- Image Library review workflow with bulk actions
- Whiteboard system with 14 teaching tools
- Asian language support (stroke order, furigana, pinyin)
- Organic progress detection and early completion
- ACTFL proficiency tracking with FACT criteria
- Syllabus Builder with ACTFL coverage panel
- Vocabulary export (CSV/Anki)
- Conversation search with highlighting
- Tutor freedom levels per class
- Developer usage analytics

---

## Technical Debt & Improvements

| Item | Priority | Description |
|------|----------|-------------|
| WCAG 2.1 AA Audit | P1 | Full accessibility compliance |
| Performance Optimization | P2 | Lazy loading, code splitting |
| Test Coverage | P2 | Expand E2E and unit tests |
| Error Monitoring | P2 | Production error tracking |

---

## Future Explorations

These features are exploratory and may be considered in later phases:

- **Augmented Reality** - Point camera at objects for translations
- **AI Writing Correction** - Essay/paragraph feedback
- **Cultural Immersion VR** - Virtual travel experiences
- **Native Speaker Marketplace** - Connect with tutors
- **Corporate Training Modules** - Business language packages

---

*Last updated: July 1, 2026 — GL Capabilities section updated with July 1 shipments.*
