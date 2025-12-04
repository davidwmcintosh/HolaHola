# LinguaFlow - Future Features Roadmap

This document captures all planned and brainstormed features for LinguaFlow, organized by category with priority levels and implementation notes.

## Priority Legend

| Priority | Description |
|----------|-------------|
| **P0** | Critical - Core to learning experience, high student impact |
| **P1** | High - Significant value add, should be in near-term roadmap |
| **P2** | Medium - Nice to have, enhances experience |
| **P3** | Low - Future consideration, exploratory |

## Complexity Legend

| Complexity | Description | Estimated Effort |
|------------|-------------|------------------|
| **Simple** | Frontend only or minor backend changes | 1-3 days |
| **Moderate** | Full-stack feature, some integration | 1-2 weeks |
| **Complex** | Multiple systems, external APIs, significant logic | 2-4 weeks |
| **Major** | Large initiative, multiple phases | 1-3 months |

---

## Multimedia & Visual Learning

### Visual Vocabulary System
**Priority:** P0 | **Complexity:** Moderate

Display images alongside vocabulary words for better memory retention.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Image-based flashcards | Show pictures with vocabulary words | Stock image API or AI generation |
| "Point to correct image" exercises | Multiple choice with images for beginners | Image storage, exercise engine |
| Vocabulary image search | Auto-find relevant images for new words | Unsplash API (existing) |

**Technical Notes:**
- Leverage existing Unsplash integration
- Consider AI image generation for custom scenarios (Gemini Flash-Image)
- Cache images to reduce API calls

### Contextual Scene Images
**Priority:** P1 | **Complexity:** Moderate

Illustrated backgrounds and scenarios for immersive learning.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Conversation scene backgrounds | Restaurant, airport, hotel, etc. | AI-generated or stock images |
| Cultural context galleries | Markets, landmarks, traditions | Curated image collections |
| Scenario visualization | Show where phrases would be used | Scene-to-topic mapping |

**Technical Notes:**
- Could use AI generation for consistent style
- Consider progressive loading for performance
- Tag scenes by ACTFL level and topic

### Grammar Visualization
**Priority:** P2 | **Complexity:** Simple

Visual representations of grammar concepts.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Verb conjugation infographics | Visual tables and charts | SVG/Canvas rendering |
| Sentence structure diagrams | Color-coded syntax breakdown | Grammar parser |
| Tense timelines | Visual representation of past/present/future | Timeline component |

**Technical Notes:**
- Could be static SVGs initially
- Consider interactive versions later
- Language-specific grammar patterns

### Video Content
**Priority:** P1 | **Complexity:** Complex

Video-based learning materials.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Native speaker clips | Short videos for listening practice | Video hosting, player |
| Pronunciation videos | Mouth movement demonstrations | Video production |
| Cultural documentaries | Short clips about culture/customs | Content licensing |
| Shadowing exercises | Follow-along with native audio | Video sync, subtitle timing |

**Technical Notes:**
- Consider embedding YouTube or Vimeo
- Need video player with playback speed control
- Subtitle synchronization (leverage existing system)

---

## Gamification & Motivation

### Achievement System
**Priority:** P1 | **Complexity:** Moderate

Badges, trophies, and rewards for student engagement.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Milestone badges | "First conversation", "100 words learned" | Achievement tracking schema |
| Trophy collection | Display case of earned rewards | User profile expansion |
| Streak multipliers | Bonus XP for consecutive days | Streak tracking (existing) |
| Daily challenges | Special objectives with rewards | Challenge generation system |

**Technical Notes:**
- Extend existing streak tracking
- Design badge artwork (could use AI generation)
- Push notifications for challenge reminders

### Leaderboards & Competition
**Priority:** P2 | **Complexity:** Moderate

Friendly competition features.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Class leaderboards | Rankings within teacher classes | Class enrollment system |
| Weekly challenges | Time-limited competitions | Challenge scheduling |
| "Boss battles" | Challenging conversation tests | Difficulty scaling |
| XP racing | Compete on learning velocity | Real-time updates |

**Technical Notes:**
- Privacy considerations for rankings
- Opt-in/opt-out for competitive features
- Anti-gaming measures

---

## Social & Community Features

### Language Exchange
**Priority:** P2 | **Complexity:** Complex

Connect learners for practice.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Partner matching | Find practice partners by level/language | Matching algorithm |
| Conversation practice rooms | Live chat/voice with other students | Real-time communication |
| Study groups | Small groups within classes | Group management |
| Vocabulary sharing | Share custom word lists | List export/import |

**Technical Notes:**
- Moderation and safety considerations
- Age-appropriate safeguards
- Real-time infrastructure (WebSocket expansion)

### Discussion Forums
**Priority:** P3 | **Complexity:** Moderate

Community discussion spaces.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Language-specific forums | Discuss learning challenges | Forum schema, moderation |
| Q&A sections | Ask questions, get answers | Voting/ranking system |
| Success stories | Share learning milestones | User-generated content |

---

## Real-World Practice

### Simulation Exercises
**Priority:** P1 | **Complexity:** Complex

Practice real-world scenarios.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Restaurant ordering | Order from an authentic menu | Scenario engine, menus |
| Travel simulations | Airport, hotel, directions | Location-based vocabulary |
| Job interview practice | Professional conversation practice | Business vocabulary |
| Shopping scenarios | Negotiate, ask prices, sizes | Commerce vocabulary |

**Technical Notes:**
- Build on existing conversation system
- Create scenario templates
- Include cultural etiquette notes

### Augmented Reality
**Priority:** P3 | **Complexity:** Major

AR-enhanced learning (mobile).

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Object labeling | Point camera, see translations | AR framework, image recognition |
| Environment vocabulary | Label items in your space | ML object detection |
| AR flashcards | 3D vocabulary cards | 3D rendering |

**Technical Notes:**
- Requires native mobile development (Capacitor)
- Significant ML/AI investment
- Consider as Phase 2+ feature

---

## Personalization & AI

### Adaptive Learning
**Priority:** P0 | **Complexity:** Complex

AI-driven personalization.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Weak point detection | Identify struggling areas | Learning analytics |
| Targeted practice | Auto-generate exercises for weak spots | Exercise generation |
| Interest-based content | Customize topics to hobbies | Interest profiling |
| Learning style adaptation | Visual/auditory/kinesthetic modes | Multi-modal content |

**Technical Notes:**
- Extend existing ACTFL tracking
- Machine learning for pattern detection
- A/B testing different approaches

### AI-Generated Content
**Priority:** P1 | **Complexity:** Moderate

Personalized learning materials.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Custom stories | Stories based on student interests | LLM generation (Gemini) |
| Personalized vocabulary | Words relevant to student's life | Interest analysis |
| Dynamic dialogues | Conversations about student's topics | Prompt engineering |

**Technical Notes:**
- Leverage existing Gemini integration
- Content moderation for generated text
- Cache common generations

---

## Accessibility & Convenience

### Offline Mode
**Priority:** P1 | **Complexity:** Complex

Learn without internet connection.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Download lessons | Save content for offline use | Service worker, IndexedDB |
| Offline drills | Practice cached drill content | Local audio storage |
| Sync when online | Upload progress when connected | Conflict resolution |

**Technical Notes:**
- PWA enhancements
- Selective content download
- Storage quota management

### Audio-Only Mode
**Priority:** P2 | **Complexity:** Moderate

Learning for commuters.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Podcast-style lessons | Audio narratives for learning | Audio content creation |
| Listen-only practice | Passive listening exercises | Audio player |
| Voice commands | Navigate hands-free | Speech recognition |

**Technical Notes:**
- Build on existing TTS infrastructure
- Background audio playback
- Lock screen controls

### Accessibility Features
**Priority:** P1 | **Complexity:** Moderate

Inclusive design.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Dyslexia-friendly fonts | OpenDyslexic and similar options | Font configuration |
| High contrast modes | Enhanced visibility options | Theme system |
| Screen reader optimization | Full ARIA support | Accessibility audit |
| Playback speed control | Slower audio for processing needs | Audio player enhancement |

**Technical Notes:**
- WCAG 2.1 AA compliance goal
- User preference persistence
- Testing with assistive technologies

---

## Assessment & Progress

### Certification Prep
**Priority:** P2 | **Complexity:** Complex

Prepare for official language exams.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| DELE practice (Spanish) | Official exam format practice | Exam content licensing |
| DELF/DALF prep (French) | French certification prep | Exam structure research |
| JLPT practice (Japanese) | Japanese proficiency test prep | Character recognition |
| Mock exams | Timed, scored practice tests | Exam engine |

**Technical Notes:**
- Research exam formats and question types
- Consider partnerships with certification bodies
- Timed testing infrastructure

### Progress Analytics
**Priority:** P1 | **Complexity:** Moderate

Detailed learning insights.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Skill radar charts | Visual strength/weakness map | Chart library (Recharts) |
| Week-over-week comparison | Track improvement velocity | Historical data |
| Conversation portfolio | Recorded sessions over time | Audio storage |
| Parent/teacher reports | Progress summaries for stakeholders | Report generation |

**Technical Notes:**
- Extend existing progress tracking
- Data visualization components
- PDF/email report export

---

## Advanced Speaking

### Pronunciation Analysis
**Priority:** P0 | **Complexity:** Complex

Detailed pronunciation feedback.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Heat maps | Visual display of problem sounds | Phoneme analysis |
| Accent training | Practice regional variations | Multiple accent models |
| Mouth position guides | Diagrams for difficult sounds | Phonetics content |
| Minimal pair drills | Distinguish similar sounds | Audio comparison |

**Technical Notes:**
- Integrate pronunciation scoring API
- Phoneme-level analysis
- Language-specific phonetic rules

### Speaking Exercises
**Priority:** P2 | **Complexity:** Moderate

Structured speaking practice.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Tongue twisters | Fun pronunciation practice | Curated content |
| Song lyrics sing-along | Learn through music | Music licensing |
| Shadowing mode | Repeat immediately after native | Precise audio timing |

---

## Writing Practice

### Character Writing (CJK)
**Priority:** P2 | **Complexity:** Complex

Handwriting for character-based languages.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Stroke order guides | Animated writing demonstrations | Stroke data, animation |
| Handwriting recognition | Draw characters, get feedback | ML recognition model |
| Practice worksheets | Printable writing practice | PDF generation |

**Technical Notes:**
- Canvas-based drawing
- Consider third-party recognition APIs
- Stroke order databases

### Written Expression
**Priority:** P2 | **Complexity:** Moderate

Practice written communication.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| AI essay correction | Get feedback on writing | LLM analysis |
| Journal prompts | Daily writing practice | Prompt generation |
| Pen pal system | Exchange messages with learners | Messaging infrastructure |
| Translation challenges | Translate passages accurately | Reference translations |

---

## Story-Based Learning

### Illustrated Stories
**Priority:** P1 | **Complexity:** Moderate

Narrative-based learning content.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Graded readers | Stories matched to ACTFL level | Content creation |
| Comic-style dialogues | Visual narratives with speech bubbles | Illustration |
| Progressive unlocking | Story chapters unlock with progress | Progress gates |
| Choose-your-adventure | Branching narrative decisions | Story engine |

**Technical Notes:**
- AI-generated illustrations could reduce cost
- Text-to-speech for narration
- Vocabulary highlighting in context

---

## Institutional Features

### Advanced Class Management
**Priority:** P1 | **Complexity:** Moderate

Enhanced teacher tools.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Bulk student enrollment | CSV import for classes | File parsing |
| Assignment deadlines | Due dates with reminders | Notification system |
| Gradebook export | Export grades to LMS | Export formats |
| Attendance tracking | Track student engagement | Activity logging |

### Analytics Dashboard
**Priority:** P1 | **Complexity:** Moderate

Insights for institutions.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Class-wide analytics | Aggregate progress views | Data aggregation |
| At-risk identification | Flag struggling students | ML analysis |
| Curriculum effectiveness | Track which lessons work best | A/B testing |
| ROI reporting | Usage and outcome metrics | Business intelligence |

---

## Technical Infrastructure

### Performance & Scale
**Priority:** P1 | **Complexity:** Complex

System improvements.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| CDN for audio | Faster audio delivery | CDN integration |
| Caching layer | Reduce database load | Redis/cache system |
| Mobile optimization | Better mobile performance | Performance audit |

### Developer Experience
**Priority:** P2 | **Complexity:** Moderate

Internal tooling.

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| Content CMS | Easier content management | Admin interface |
| A/B testing framework | Test feature variants | Experimentation platform |
| Analytics dashboard | Usage and engagement metrics | Data pipeline |

---

## Whiteboard Tools Roadmap

The AI tutor's "whiteboard" is a real-time visual teaching system that displays content during voice lessons. Tools are embedded in responses using markup tags.

### Completed Phases

#### Phase 1-2: Core Foundation ✅
| Tool | Format | Purpose |
|------|--------|---------|
| WRITE | `[WRITE]text[/WRITE]` | Display vocabulary, key phrases |
| PHONETIC | `[PHONETIC]word\|breakdown[/PHONETIC]` | Pronunciation guides |
| COMPARE | `[COMPARE]correct NOT incorrect[/COMPARE]` | Show corrections |
| IMAGE | `[IMAGE]word\|description[/IMAGE]` | Vocabulary images |
| DRILL | `[DRILL type="..."]prompt[/DRILL]` | Interactive exercises |

#### Phase 3: Contextual Teaching ✅
| Tool | Format | Purpose |
|------|--------|---------|
| CONTEXT | `[CONTEXT]word\|sentence1\|sentence2[/CONTEXT]` | Word in multiple sentences |
| GRAMMAR_TABLE | `[GRAMMAR_TABLE]verb\|tense[/GRAMMAR_TABLE]` | Verb conjugation tables |
| READING | `[READING]char\|pronunciation[/READING]` | Furigana/pinyin/romanization |
| STROKE | `[STROKE]character[/STROKE]` | Character display for writing |

#### Phase 4: Vocabulary & Culture ✅
| Tool | Format | Purpose |
|------|--------|---------|
| WORD_MAP | `[WORD_MAP]word[/WORD_MAP]` | Synonyms, antonyms, word families |
| DRILL match | `[DRILL type="match"]pairs[/DRILL]` | Interactive vocabulary matching |
| CULTURE | `[CULTURE]topic\|context\|category[/CULTURE]` | Cultural insights inline |

### Phase 5: Enhanced Interactivity (Planned)
**Priority:** P1 | **Complexity:** Moderate

| Feature | Format | Description |
|---------|--------|-------------|
| Animated Stroke Order | `[STROKE]character[/STROKE]` (enhanced) | Animated stroke-by-stroke drawing for CJK characters |
| Audio Replay | `[PLAY]word[/PLAY]` | On-demand slow pronunciation playback |
| Speed Control | `[PLAY speed="slow"]phrase[/PLAY]` | Variable speed audio for difficult phrases |

**Technical Notes:**
- STROKE enhancement: Animate SVG paths or use stroke order APIs
- PLAY tool: Reuse Cartesia TTS with isolated playback controls
- Could integrate with existing pronunciation feedback system

### Phase 6: Advanced Teaching Aids (Planned)
**Priority:** P2 | **Complexity:** Moderate-Complex

| Feature | Format | Description |
|---------|--------|-------------|
| Scenario Cards | `[SCENARIO]location\|situation[/SCENARIO]` | Visual role-play setup with context |
| Error Patterns | `[ERRORS]student_id[/ERRORS]` | Display student's common mistakes for review |
| Vocabulary Timeline | `[TIMELINE]topic[/TIMELINE]` | Show words learned over time, connections |
| Lesson Summary | `[SUMMARY][/SUMMARY]` | Auto-generated recap of lesson vocabulary |

**Technical Notes:**
- SCENARIO: Could include scene images from AI generation
- ERRORS: Requires error tracking in conversation analysis
- TIMELINE: Leverages existing vocabulary extraction and spaced repetition data
- SUMMARY: Post-lesson card with key takeaways

### Phase 7: Immersive Learning (Future)
**Priority:** P3 | **Complexity:** Complex

| Feature | Concept | Description |
|---------|---------|-------------|
| AR Vocabulary Labels | Camera-based | Point at objects, see vocabulary overlays |
| Video Clips | Native speaker clips | Short videos for listening comprehension |
| Interactive Stories | Branching narratives | Choose-your-own-adventure language practice |

---

## Implementation Phases

### Phase 1: Visual & Multimedia Foundation (Q1)
- Visual vocabulary with stock images
- Achievement badges and streaks
- Pronunciation heat maps
- Progress analytics charts

### Phase 2: Engagement & Gamification (Q2)
- Leaderboards and challenges
- Illustrated stories
- Simulation exercises
- Offline mode

### Phase 3: Social & Community (Q3)
- Language exchange matching
- Study groups
- Discussion forums
- Pen pal system

### Phase 4: Advanced Features (Q4)
- AR vocabulary labeling
- Video content integration
- Certification prep
- Character writing (CJK)

---

## Completed Features

### Phase 4c: Cultural Context Whiteboard Tool (December 2024)
✅ **Cultural Infographics** - `[CULTURE]topic|context|category[/CULTURE]`

Inline cultural teaching tool for the voice whiteboard system:
- Displays cultural insights with amber/golden color scheme
- Categories: food, dining, gestures, body language, holidays, festivals, etiquette, customs
- Category-specific icons (Globe, Utensils, Users, Calendar, etc.)
- Seamlessly integrated into streaming voice pipeline
- AI tutor uses it to explain WHY phrases are used, cultural customs, etiquette

**Examples:**
- `[CULTURE]Tu vs Vous|In France, use 'vous' with strangers and 'tu' with friends|etiquette[/CULTURE]`
- `[CULTURE]Tipping in Japan|Tipping is considered rude - good service is expected|dining[/CULTURE]`

**Files Changed:**
- `shared/whiteboard-types.ts` - CultureItem types and parsing
- `client/src/components/Whiteboard.tsx` - CultureItemDisplay component
- `server/system-prompt.ts` - Tutor documentation for using CULTURE tool

---

## Notes

- Priorities may shift based on user feedback and usage data
- Some features may be split into smaller increments
- External dependencies (APIs, licensing) may affect timelines
- Regular review and reprioritization recommended

---

*Last updated: December 2024*
