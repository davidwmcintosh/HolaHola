# HolaHola System Capabilities

> **INTERNAL DOCUMENT** - Shared knowledge between Daniela and the Editor.
> This documents what the system CAN DO, not how it's implemented.

---

## Voice Teaching Tools (Whiteboard Commands)

### Visual Display Tools
| Tool | What It Does | When To Use |
|------|--------------|-------------|
| `WRITE` | Shows text on the whiteboard | Vocabulary words, key phrases, grammar points |
| `PHONETIC` | Shows IPA pronunciation guide | Helping with difficult sounds |
| `COMPARE` | Side-by-side comparison | Ser vs estar, similar words, before/after |
| `IMAGE` | Displays educational image | Vocabulary visualization, cultural context |
| `GRAMMAR_TABLE` | Shows grammar structure | Conjugation tables, agreement patterns |
| `WORD_MAP` | Visual word relationships | Vocabulary clusters, word families |
| `TONE` | Mandarin tone contours | Tonal language practice |

### Interactive Practice Tools
| Tool | What It Does | When To Use |
|------|--------------|-------------|
| `DRILL type="repeat"` | Student repeats phrase | Pronunciation practice |
| `DRILL type="translate"` | Student translates phrase | Comprehension check |
| `DRILL type="match"` | Match pairs (drag-and-drop) | Vocabulary association |
| `DRILL type="fill_blank"` | Complete the sentence | Grammar application |
| `DRILL type="sentence_order"` | Arrange words correctly | Syntax understanding |

### Subtitle Control
| Tool | What It Does | When To Use |
|------|--------------|-------------|
| `SUBTITLE on/off` | Toggle regular subtitles | Student preference |
| `SUBTITLE_TEXT` | Custom overlay text | Key teaching moments (use sparingly!) |

### Internal Commands (Server-Side Only)
| Tool | What It Does |
|------|--------------|
| `SWITCH_TUTOR` | Handoff to different voice/language |
| `ACTFL_UPDATE` | Update student proficiency level |
| `SYLLABUS_PROGRESS` | Track topic competency |

---

## Teaching Modes

### Conversation Modes
- **Regular Teaching** - Standard tutoring with full tool access
- **Open Mic Mode** - Continuous listening with barge-in support
- **Honesty Mode** - Minimal prompting for authentic Daniela discovery
- **Founder Mode** - Full neural network access, Editor feedback visible, Self-Surgery capability

### Drill Modes
- **Repeat** - Voice pronunciation practice
- **Translate** - Comprehension verification
- **Match** - Visual association learning
- **Fill Blank** - Active grammar application
- **Sentence Order** - Syntax construction

### Session Phases
- **Greeting** - Personalized welcome
- **Teaching** - Main instruction
- **Practice** - Drill-based reinforcement
- **Summary** - Session wrap-up
- **Assessment** - ACTFL-aligned evaluation

---

## Student Features

### Learning Tools
- Vocabulary Library with spaced repetition
- Flashcard system with SRS scheduling
- Grammar exercises (hybrid AI + structured)
- Conversation history with full-text search
- Progress charts and streak tracking
- Vocabulary export functionality

### Personalization
- Per-language tutor style customization
- Adjustable speech speed
- Light/dark mode
- Difficulty auto-adjustment based on performance

### Voice Interaction
- Push-to-talk for clean audio
- Real-time streaming transcription
- Bilingual subtitle support
- Word-level timing for playback

---

## Institutional Features

### For Teachers
- Class management (create, archive classes)
- Student enrollment (invites, approvals)
- Syllabus Builder for custom curricula
- Assignment workflows
- Progress monitoring per student

### For Administrators
- Role-Based Access Control (RBAC)
- Multi-tenant organization support
- Command Center for unified management
- Image Library management

---

## AI Capabilities

### Daniela's Intelligence
- ACTFL-aligned proficiency tracking
- Automatic vocabulary extraction from conversations
- AI-generated conversation tags
- Contextual topic suggestions
- Teaching effectiveness learning (Neural Network)

### The Hive Collaboration
- Editor watches teaching sessions via beacons
- Editor provides feedback on teaching moments
- Daniela can adopt Editor insights
- Self-Surgery proposals for neural network changes
- Bidirectional collaboration on features

---

## Platform Integration

### Authentication
- Replit Auth (OIDC) for seamless login

### Payments
- Stripe subscription management
- Voice tutoring time metering
- Tier-based feature access

### Content
- Unsplash stock images
- Gemini AI-generated educational images
- Pre-built syllabi across 9 languages

---

*Last updated: December 14, 2025*
