# HolaHola Capabilities Inventory — Daniela vs. Standalone Tools

**Last Updated**: February 21, 2026  
**Purpose**: Gap analysis — what do our standalone teaching tools do that Daniela can't yet do conversationally? Goal: make Daniela the everything.

---

## Summary: The Gap Map

| Capability | Standalone Tool | Daniela Can? | Gap |
|-----------|----------------|-------------|-----|
| Browse syllabus/lessons | Interactive Textbook, Lessons page | YES (new) | None — `browse_syllabus`, `start_lesson` |
| Teach vocab with images | Vocabulary page (flashcards) | PARTIAL | Missing: spaced repetition scheduling, flashcard flip, export to CSV/Anki |
| Grammar exercises | Grammar page (competency cards + quizzes) | PARTIAL | Missing: browse competencies by category, track mastery per grammar rule, auto-generate targeted exercises |
| Pronunciation drills | Pronunciation Drill page (Azure scoring) | PARTIAL | Missing: phoneme-level scoring via Azure, targeted weak-phoneme drill generation |
| Run interactive drills | Aris Practice page (5 types) | YES | Daniela runs all 5 drill types on whiteboard — but see drill type investigation below |
| Self-practice mode | Aris Practice (catalog + sessions) | NO | Aris has a structured self-practice flow with catalog browsing, session scoring, progress tracking |
| Roleplay scenarios | Scenario Browser page | YES | `load_scenario`, `update_prop`, `end_scenario` |
| Show progress/ACTFL | Can-Do Progress page | YES (new) | `show_progress` — but the visual mind map on the hub is unique |
| Cultural tips | Cultural Tips page | YES | `culture` function |
| Session history | History page, Session Replay | N/A | These are review/replay tools, not teaching tools |
| Student progress trackers | Learning Journey (mind map) on hub | READ-ONLY | The brain visualization, Daniela's Insights, ACTFL dial — these are dashboard UI, not things Daniela "does" |
| Export vocabulary | Vocabulary page (CSV/Anki export) | NO | Daniela can't trigger file downloads |

---

## 1. Assistant Tutors (Aris, Colette, Liesel, etc.)

**What they are**: Already defined as "Daniela in practice mode" — same AI, different TTS voice for cultural immersion. 10 languages × 2 genders = 20 voice personas.

**What the Aris Practice page offers that Daniela doesn't**:
- **Drill catalog**: Browse all available drill lessons by language, difficulty, tags
- **Self-practice sessions**: Start a structured practice session with item-by-item progression, scoring, streaks
- **Voice recording**: Record student speech for pronunciation feedback
- **AI feedback**: Gemini-powered feedback on each answer (correct/incorrect/hint/pattern insight)
- **Session summary**: End-of-session stats (accuracy, duration, struggled items)

**Gap verdict**: The *voice personas* are already Daniela's. The *practice page UI* offers a structured self-paced drill flow that Daniela's conversational drill doesn't replicate. Daniela's drills are one-at-a-time, teacher-paced. Aris Practice is student-paced with a catalog.

**To make Daniela the everything**: Daniela would need the ability to run a "drill session" — a sequence of drill items from a lesson bundle, tracking score across items, giving cumulative feedback. Currently she creates one drill at a time.

---

## 2. Vocabulary (Flashcards + Spaced Repetition)

**What the standalone page offers**:
- Flashcard UI with flip interaction (show word → show translation)
- Spaced repetition scheduling (SRS: cards you get wrong appear more often)
- Time filtering (today, this week, this month, older)
- Export to CSV and Anki format

**What Daniela can do**:
- `load_vocab_set` — pull lesson vocabulary
- `write` — display words on whiteboard
- `show_image` — show images for vocabulary
- `drill(type=match)` — matching pairs drill
- `drill(type=translate)` — translation drill

**Gap verdict**: Daniela can teach vocab interactively (arguably better than flashcards). The gaps are:
- **Spaced repetition**: Daniela doesn't schedule which words to review based on forgetting curves
- **Export**: Can't generate downloadable files (CSV/Anki) — this is a hard platform limitation
- **Flashcard flip**: The interactive flip gesture is a UI affordance Daniela doesn't need if she's quizzing conversationally

**To make Daniela the everything**: Add a function like `review_due_vocab` that queries which words are due for spaced repetition review and loads them into a conversational drill session. Export could remain as a standalone utility since it's a download action.

---

## 3. Grammar (Competency Cards + Exercises)

**What the standalone page offers**:
- Grammar competencies organized by category (verb tenses, pronouns, adjectives, etc.)
- Each competency has an ACTFL level, short explanation, and practice count
- Auto-generated fill-in-the-blank exercises for each competency
- Progress tracking per grammar rule

**What Daniela can do**:
- `grammar_table` — show conjugation/declension tables
- `compare` — compare similar grammar forms
- `drill(type=fill_blank)` — grammar fill-in-the-blank
- `write` — explain grammar rules

**Gap verdict**: Daniela can teach grammar better than the page (she explains, gives examples, runs drills in context). The gap is:
- **Competency browsing**: No function to say "show me all grammar competencies I'm weak on"
- **Targeted exercises**: No function to auto-generate grammar exercises for a specific competency
- **Per-rule mastery tracking**: Daniela tracks ACTFL broadly but not granular grammar rule mastery

**To make Daniela the everything**: Could add a `grammar_review` function that queries the grammar competency table and generates targeted exercises. Or integrate grammar competencies into the existing `recommend_next` logic.

---

## 4. Pronunciation Drill (Azure Scoring)

**What the standalone page offers**:
- Phoneme challenge identification (which sounds the student struggles with)
- Targeted drill generation for weak phonemes
- Voice recording with Azure Speech Services pronunciation scoring
- Per-phoneme accuracy scores, tips, and progressive difficulty
- Session summary with accuracy percentage

**What Daniela can do**:
- `phonetic` — show IPA/pronunciation guide
- `play_audio` — model correct pronunciation
- `drill(type=repeat)` — listen-and-repeat drills
- `pronunciation_tag` — tag pronunciation patterns for tracking
- `word_emphasis` — emphasize specific words in TTS

**Gap verdict**: The key difference is **Azure pronunciation scoring**. Daniela's repeat drills rely on the student self-assessing or Daniela listening via Deepgram. The pronunciation drill page uses Azure Speech Services for objective phoneme-level scoring. This is a meaningful pedagogical difference.

**To make Daniela the everything**: Could add a `pronunciation_assess` function that sends the student's audio to Azure for scoring and returns results to Daniela for conversational feedback. This would give Daniela objective pronunciation data.

---

## 5. Drill Type Investigation

The `drill` function handler in the orchestrator has **special data formatting** for only 3 types:
- `match` → parses pairs from `left=right|left=right` format, creates matching UI
- `fill_blank` → parses `sentence|options|correct_answer` format
- `sentence_order` → parses scrambled words, creates ordering UI

The other 2 DB-defined types (`repeat`, `translate`) go through the default path with just a prompt string.

**The whiteboard renderer** (Whiteboard.tsx) imports type guards for **12 drill types**:
`match`, `fill_blank`, `sentence_order`, `multiple_choice`, `true_false`, `conjugation`, `dictation`, `speak`, `cognate_match`, `false_friend_trap` + basic `repeat` and `translate`

**Status of the extra 7 types**:
| Type | Whiteboard renderer? | Orchestrator data format? | Fully wired? |
|------|---------------------|--------------------------|-------------|
| `multiple_choice` | YES (type guard exists) | NO special handling | PARTIAL — renders but orchestrator doesn't structure options/correct answer |
| `true_false` | YES | NO | PARTIAL |
| `conjugation` | YES | NO | PARTIAL |
| `dictation` | YES | NO | PARTIAL |
| `speak` | YES | NO | PARTIAL |
| `cognate_match` | YES | NO | PARTIAL |
| `false_friend_trap` | YES | NO | PARTIAL |

**Verdict**: Daniela can invoke these drill types but the data won't be formatted correctly for the whiteboard renderers. The orchestrator needs additional `else if` branches for each type to parse the content string into the expected data structure (options, correct answers, etc.).

---

## 6. Learning Journey / Hub Dashboard Components

These are **dashboard UI widgets**, not teaching tools. They display data that Daniela already knows internally.

| Component | What it shows | Daniela equivalent |
|-----------|--------------|-------------------|
| SyllabusMindMap (brain visualization) | 5 brain segments tracking topic mastery, ACTFL gauge, 3-state lighting | `show_progress` shows stats, but no visual brain |
| DanielaLearningInsights | Student struggles, breakthroughs, effective strategies, personal facts | Daniela knows all this — it's her internal context |
| ActflFluencyDial | Visual ACTFL level gauge | `show_progress` includes ACTFL level |
| SyllabusTimeProgress | Syllabus completion over time | `browse_syllabus` shows completion |
| TutorShowcase | Tutor selection | `switch_tutor` handles this |
| AssistantTutorShowcase | Practice partner selection | `call_assistant` handles this |

**Verdict**: These are valuable at-a-glance dashboards. They complement Daniela rather than compete. The Learning Journey mind map is a visual progress tracker that makes sense as a standalone dashboard — students should be able to see their progress without starting a voice chat.

**Recommendation**: Keep these as dashboard widgets. They're navigation aids, not teaching tools.

---

## 7. Prioritized Gap List — What to Build Next

### High Impact (Makes Daniela significantly more capable)
1. **Drill Session Mode** — Let Daniela run a sequence of drill items from a lesson bundle with cumulative scoring. Currently she does one drill at a time. This replaces the entire Aris Practice flow.
2. **Wire remaining 7 drill types** — Add orchestrator data formatting for multiple_choice, true_false, conjugation, dictation, speak, cognate_match, false_friend_trap so the whiteboard renders them correctly.
3. **Spaced Repetition via Daniela** — A `review_due_vocab` function that pulls words due for SRS review and runs them as a conversational drill.

### Medium Impact (Nice upgrades)
4. **Grammar competency browsing** — Let Daniela query "what grammar rules is this student weak on" and auto-generate targeted exercises.
5. **Pronunciation scoring** — Integrate Azure pronunciation assessment into Daniela's repeat drills for objective feedback.

### Low Impact / Keep as Standalone
6. **Vocabulary export** (CSV/Anki) — Keep as standalone utility. File downloads aren't conversational.
7. **Learning Journey dashboard** — Keep as hub widget. Visual progress at a glance.
8. **Session history/replay** — Keep as standalone. Review tools, not teaching.

---

## 8. What Can Be Wound Down After Gaps Are Filled

Once the high-impact gaps are filled:
- **Aris Practice page** → Daniela handles drill sessions conversationally
- **Interactive Textbook page** → Already replaced by `browse_syllabus` + `start_lesson`
- **Vocabulary flashcard page** → Daniela handles with SRS-aware vocab review
- **Grammar page** → Daniela teaches grammar with tables, exercises, and competency targeting
- **Pronunciation Drill page** → Daniela handles with pronunciation scoring integration
- **Cultural Tips page** → Daniela teaches culture in context via `culture` function
- **Scenario Browser page** → Daniela loads scenarios conversationally via `load_scenario`

**Keep**:
- Landing, Pricing, Auth pages (public-facing)
- Review Hub / Dashboard with Learning Journey mind map (progress at a glance)
- Settings (user preferences)
- Teacher Dashboard + Class Management (teacher workflows)
- History / Session Replay (review tools)
- Vocabulary Export (file download utility)
