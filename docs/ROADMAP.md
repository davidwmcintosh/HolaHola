# LinguaFlow Roadmap

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

## Recently Completed

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

*Last updated: December 2025*
