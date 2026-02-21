# HolaHola Capabilities Inventory

**Last Updated**: February 21, 2026  
**Purpose**: Track what exists, what works, what's incomplete, and what's planned.

---

## 1. Daniela — Voice Function Calls (44 total)

These are the native Gemini function calls Daniela can invoke during voice or text chat. Each one triggers a backend handler and (usually) renders something on the student's whiteboard.

### Whiteboard Content Tools (16) — HAVE
| Tool | What it does | Renders on whiteboard? |
|------|-------------|----------------------|
| `write` | Display text (headings, notes, vocabulary) | Yes — text card |
| `phonetic` | Show IPA or simplified pronunciation guide | Yes — phonetic card |
| `compare` | Side-by-side comparison of two items | Yes — compare card |
| `grammar_table` | Formatted conjugation/declension tables | Yes — grammar table |
| `word_map` | Visual word relationships/associations | Yes — word map card |
| `culture` | Cultural insight or tip | Yes — culture card |
| `context` | Usage context for a word/phrase | Yes — context card |
| `summary` | Lesson or conversation summary | Yes — summary card |
| `reading` | Reading passage with annotations | Yes — reading card |
| `dialogue` | Structured dialogue display | Yes — dialogue card |
| `show_image` | Display a photo (stock or AI-generated) | Yes — image card |
| `play_audio` | Play an audio clip for pronunciation modeling | Yes — audio player |
| `stroke` | Character stroke order (CJK languages) | Yes — stroke card |
| `tone` | Tonal pronunciation guide (Chinese, Vietnamese, Thai) | Yes — tone card |
| `subtitle` | Show/control floating subtitles | Yes — subtitle overlay |
| `show_overlay` / `hide_overlay` | Custom text overlay on screen | Yes — overlay |

### Drill System (5 drill types via `drill` function) — HAVE
| Drill Type | What student does |
|-----------|------------------|
| `repeat` | Listen and repeat a phrase (pronunciation) |
| `translate` | Translate from native to target language |
| `fill_blank` | Fill in missing word(s) in a sentence |
| `match` | Match vocabulary pairs |
| `sentence_order` | Arrange scrambled words into correct order |

**Additional drill types rendered on whiteboard** (exist in type system but not all confirmed active):
- `multiple_choice`, `true_false`, `conjugation`, `dictation`, `speak`, `cognate_match`, `false_friend_trap`

### Curriculum Navigation (5) — HAVE (NEW, Feb 21 2026)
| Tool | What it does |
|------|-------------|
| `browse_syllabus` | Shows enrolled class units/lessons with completion status |
| `start_lesson` | Loads a specific lesson with objectives, vocab, drills, topics |
| `load_vocab_set` | Pulls lesson vocabulary for systematic teaching |
| `show_progress` | Displays ACTFL level, lessons completed, streak, stats |
| `recommend_next` | Suggests best next lesson based on progress gaps |

### Scenario / Roleplay System (4) — HAVE
| Tool | What it does |
|------|-------------|
| `scenario` | Display scenario setup text |
| `load_scenario` | Load an immersive roleplay scenario with props |
| `update_prop` | Update a prop within the scenario |
| `end_scenario` | End the scenario and show performance summary |

### Voice Control (3) — HAVE
| Tool | What it does |
|------|-------------|
| `voice_adjust` | Change Daniela's speaking style/speed/energy |
| `voice_reset` | Reset voice to defaults |
| `word_emphasis` | Mark specific words for emphasis in TTS |

### Session Management (5) — HAVE
| Tool | What it does |
|------|-------------|
| `switch_tutor` | Switch between Daniela and assistant tutor |
| `call_support` | Hand off to Sofia (support agent) |
| `call_assistant` | Delegate drill practice to assistant |
| `phase_shift` | Annotate teaching phase transitions |
| `first_meeting_complete` | Signal new student onboarding complete |

### Student Tracking (5) — HAVE
| Tool | What it does |
|------|-------------|
| `actfl_update` | Update student's ACTFL proficiency level |
| `syllabus_progress` | Record syllabus lesson completion |
| `check_student_credits` | Check student's credit balance and usage |
| `milestone` | Record a learning milestone or breakthrough |
| `take_note` | Save an observation about the student |

### Whiteboard Control (3) — HAVE
| Tool | What it does |
|------|-------------|
| `clear_whiteboard` | Clear all whiteboard content |
| `hold_whiteboard` | Prevent auto-clearing of content |
| `request_text_input` | Ask student to type instead of speak |

### Classroom Personalization (2) — HAVE
| Tool | What it does |
|------|-------------|
| `change_classroom_photo` | Change Daniela's North Star Polaroid photo |
| `change_classroom_window` | Change the view from the classroom window |

### Memory & Intelligence (5) — HAVE
| Tool | What it does |
|------|-------------|
| `memory_lookup` | Search past conversations and neural network |
| `express_lane_lookup` | Search developer collaboration channel |
| `recall_express_lane_image` | Recall an image from Express Lane |
| `express_lane_post` | Post to the Express Lane channel |
| `hive_suggestion` | Contribute insight to the Hive |

### Self-Evolution (2) — HAVE
| Tool | What it does |
|------|-------------|
| `self_surgery` | Propose modifications to own neural network |
| `pronunciation_tag` | Tag pronunciation patterns for learning |

---

## 2. Frontend Pages & Features

### Student-Facing Pages
| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Landing | `/` | HAVE | Public landing page |
| Pricing | `/pricing` | HAVE | Stripe integration |
| Chat (Voice Tutor) | `/chat` | HAVE | Core experience — voice + text with Daniela |
| Review Hub | `/dashboard` | HAVE | Main student dashboard |
| Interactive Textbook | `/interactive-textbook` | HAVE — WINDING DOWN | Being replaced by Daniela's conversational capabilities |
| Vocabulary | `/vocabulary` | HAVE | Vocabulary list view |
| Grammar | `/grammar` | HAVE | Grammar reference |
| Lessons | `/lessons` | HAVE | Lesson list |
| Can-Do Progress | `/can-do-progress` | HAVE | ACTFL Can-Do statement tracking |
| Scenarios | `/scenarios` | HAVE | Scenario browser |
| Practice (Aris) | `/practice` | HAVE | Self-directed drill practice |
| Pronunciation Drill | `/pronunciation` | HAVE | Dedicated pronunciation practice |
| Cultural Tips | `/cultural-tips` | HAVE | Cultural insights page |
| Chat Ideas | `/chat-ideas` | HAVE | Conversation starter suggestions |
| History | `/history` | HAVE | Past conversation history |
| Session Replay | `/session-replay` | HAVE | Replay past sessions |
| Settings | (settings) | HAVE | User preferences |
| Onboarding | `/onboarding` | HAVE | New user setup flow |

### Teacher-Facing Pages
| Page | Route | Status |
|------|-------|--------|
| Teacher Dashboard | `/teacher/dashboard` | HAVE |
| Class Management | `/teacher/classes/:classId` | HAVE |
| Assignment Creator | `/teacher/assignments/new` | HAVE |
| Assignment Grading | `/teacher/assignments/:id/grade` | HAVE |
| Class Creation Hub | `/teacher/create-class` | HAVE |

### Student-Teacher Pages
| Page | Route | Status |
|------|-------|--------|
| Classes | `/classes` | HAVE |
| Class Detail | `/classes/:id` | HAVE |
| Student Assignments | (student-assignments) | HAVE |
| Student Join Class | (student-join-class) | HAVE |

### Auth Pages
| Page | Route | Status |
|------|-------|--------|
| Login | `/login` | HAVE |
| Signup | `/signup` | HAVE |
| Get Started | `/get-started` | HAVE |
| Complete Registration | `/complete-registration` | HAVE |
| Forgot Password | `/forgot-password` | HAVE |
| Reset Password | `/reset-password` | HAVE |

---

## 3. Backend Systems

### Voice Pipeline — HAVE
| Component | Status | Details |
|-----------|--------|---------|
| STT (Speech-to-Text) | Working | Deepgram Nova-3, live streaming |
| TTS - Google (Primary) | Working | Chirp 3 HD, batch mode for cross-sentence prosody |
| TTS - Cartesia | Working | Sonic-3, auto language detect |
| TTS - ElevenLabs | Working | Flash v2.5 |
| TTS - OpenAI | Available | Fallback |
| WebSocket streaming | Working | Push-to-talk + Open Mic modes |
| Voice diagnostics | Working | Telemetry system for TTS observability |

### AI & Intelligence — HAVE
| System | Status | Details |
|--------|--------|---------|
| Gemini integration | Working | Text + voice LLM |
| Neural network | Working | Procedural memory for pedagogical strategies |
| Hybrid memory | Working | Infinite memory architecture |
| Express Lane | Working | Developer collaboration channel |
| Hive Collaboration | Working | Multi-agent system (Daniela, Wren, Lyra) |
| Unified Daniela Context | Working | One consistent Daniela across all contexts |
| Classroom environment | Working | Spatial metaphor with all persistent context |
| Student Learning Service | Working | Tracks student progress and adaptation |

### Automated Agents — HAVE
| Agent | Status | Details |
|-------|--------|---------|
| Wren (Security Officer) | Working | Runs every 6h, scans for security issues |
| Lyra (Learning Analyst) | Working | Runs every 12h, content quality + student success analysis |

### Curriculum System — HAVE
| Component | Status | Details |
|-----------|--------|---------|
| 10 language syllabi | Working | Pre-built curriculum paths |
| ACTFL assessment | Working | Unified competency tracking |
| AI lesson generation | Working | Auto-creates structured lesson drafts |
| Lesson publishing | Working | Processes generated lessons |
| Fluency wiring | Working | Connects Can-Do statements to lessons |

### Payment & Auth — HAVE
| Component | Status | Details |
|-----------|--------|---------|
| Stripe integration | Working | Subscriptions and payments |
| Replit Auth (OIDC) | Working | Authentication |
| RBAC | Working | Role-based access control |

---

## 4. Strategic Pivot Status: Daniela as Interactive Textbook

**Goal**: Daniela replaces most textbook/drill UI with conversational equivalents.

### What Daniela CAN now do conversationally (DONE)
- Browse the student's syllabus and show what's available
- Start a specific lesson and teach from it
- Load and teach vocabulary sets with images
- Show student progress and ACTFL level
- Recommend what to study next
- Run 5+ drill types interactively
- Load and run roleplay scenarios
- Show grammar tables, comparisons, cultural notes
- Display images, play audio, show phonetics
- Track milestones and take notes on student performance

### What still requires standalone UI (KEEP)
- **Syllabus view** — Lightweight navigation aid for students to see the big picture
- **Mind map** — Visual concept relationships (planned)
- **Teacher dashboard** — Class management, assignments, grading
- **Settings** — User preferences
- **Landing/Pricing/Auth** — Public-facing pages

### What can be wound down over time
- Interactive textbook page (lesson prep cards, visual vocab grid, flashcards, chapter recaps)
- Practice Explorer (Daniela can run drills conversationally)
- Dedicated pronunciation drill page (Daniela handles this)
- Standalone grammar page (Daniela shows grammar tables)
- Standalone cultural tips page (Daniela teaches culture in context)

---

## 5. Open Questions

1. **Mind map feature** — Is this a planned frontend component for visual concept navigation? Currently not built. Should it be a new page or integrated into the syllabus view?

2. **Whiteboard rendering for new curriculum tools** — The 5 new curriculum navigation functions (browse_syllabus, start_lesson, etc.) send data to the whiteboard. Do we need dedicated whiteboard card renderers for these, or is the existing `write` card sufficient for displaying the data Daniela narrates?

3. **Drill type coverage** — The type system defines 12 drill types but the Aris database enum only has 5 (repeat, translate, match, fill_blank, sentence_order). Are the additional 7 (multiple_choice, true_false, conjugation, dictation, speak, cognate_match, false_friend_trap) fully wired end-to-end, or are some of them whiteboard-only renderers without full scoring?

4. **Progressive wind-down plan** — Should we deprecate the standalone pages (interactive textbook, practice explorer, pronunciation drill) by hiding navigation links first, or by redirecting to chat with a prompt?

5. **Scenario coverage** — How many pre-built scenarios exist in the database? Are there scenarios for all 10 languages?
