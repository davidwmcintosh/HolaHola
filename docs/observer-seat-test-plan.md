# Observer Seat — Test Plan & Findings

*Living document — Luca's diagnostic workspace.*
*Last updated: July 3, 2026*

---

## What the Observer Seat Is

The Observer Seat is Luca's (the Agent's) closed test loop for the visual layer. It fires a Gemini Live session with a real scenario, captures every tool call, transcript, and audio response, and displays them side-by-side so Luca can see exactly what Daniela produces — without needing to be a student.

The core insight: the same way the Observer Seat gives Luca visibility into Daniela's performance, **Daniela needs equivalent self-visibility into the system** — what she fired, what rendered, what the student saw. That's a parallel thread (see §5 below).

---

## Full Monitoring & Testing Stack

### Layer 1 — Observer Seat (headless simulation)

Fire synthetic sessions without a real student. Test ACTFL calibration, visual tools, teaching arcs.

- **Endpoint:** `POST /api/admin/agent-visual-demo` — fires a real GL session, captures tool calls + audio + transcript
- **Audit script:** `npx tsx server/scripts/actfl-audit.ts` — headless multi-level comparison, no auth
- **Frontend:** `client/src/pages/agent-visual-test.tsx` — three-panel view (Studio / Session / Whiteboard)
- **History:** `GET /api/admin/observer-seat/runs` — all past runs (DB: `observer_seat_runs`)
- **Replay:** `GET /api/admin/observer-seat/runs/:id`

**Auth pattern:**
```bash
curl -si -X POST http://localhost:5000/api/internal/agent-session \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" -d '{}' \
  | grep -i set-cookie | sed 's/set-cookie: //i' | cut -d';' -f1 > /tmp/sc.txt
```

### Layer 1b — Multi-Turn Arc Testing (agent-voice-turn)

Drive a **persistent multi-turn GL conversation** turn by turn, observing every tool call, transcript, and accumulated lesson state. This is the deeper seat — where Layer 1 sees a single exchange, Layer 1b sees the whole arc unfold.

- **Endpoint:** `POST /api/admin/agent-voice-turn`
- **Body:** `{ audio: base64PCM16@16kHz, sessionId: string, languageCode, voiceId, studentText? }`
- **Returns:** `{ toolCallsSummary, visualEvents, transcript, audioWav, audioDurationS, turnNumber }`
- **Session store:** In-memory `agentVoiceSessions` Map — keyed by `sessionId`, persists across calls for up to 1 hour
- **Context carry-forward:** Each session stores `lessonContext: { phase, scene, vocab[], phaseObjective }`. After each tool call, the handler updates it. At the start of each new turn, the accumulated context is injected into the GL system prompt — mirrors what `pendingGlContext`/`pushLessonStatusContext` does in real student sessions.

**Audio pipeline (each student utterance):**
```javascript
// 1. TTS via /api/tts/pronunciation → { audioUrl: "data:audio/mpeg;base64,..." }
// 2. Write MP3 → ffmpeg → PCM16 @ 16kHz mono
// 3. base64-encode the raw PCM → send as 'audio' field
```
*GOOGLE_TTS_API_KEY is not set; only `/api/tts/pronunciation` via session cookie works.*

**Key technique:** Run each turn as its own shell call — do NOT batch multiple sequential turns in one script. The bash tool timeout kills the process mid-turn and output is lost.

**What it validates that Layer 1 cannot:**
- Cross-turn context inheritance (does vocab from Turn 2 appear in Turn 3's sentence builder?)
- Phase progression (does Daniela declare the arc phase without being told?)
- Scene advancement (does the scene shift autonomously as the lesson deepens?)
- Full arc integrity (open_scene → show_vocab_grid → show_sentence_builder in sequence)

### Layer 2 — Co-pilot View (live session observation)

Watch a real David↔Daniela session in real time. See exactly what Daniela sees, what she fires, what comes back.

- **Endpoint:** `GET /api/admin/luca-session-view?userId=<id>` — live snapshot, poll every 3s
- **CLI watch:** `npx tsx server/scripts/luca-watch.ts` — auto-reprints on state change

**What the co-pilot view returns:**
| Field | Contents |
|-------|----------|
| `observerSeat` | Daniela's own snapshot (call count, next heartbeat in N calls) |
| `visionBuffer.vocabGrid` | Each word + image description + pipeline mode (bytes/cached/error) |
| `visionBuffer.scene` | Current open_scene state text |
| `visionBuffer.showImage` | Active show_image |
| `visionBuffer.vocabCard` | Active vocab card |
| `toolCallTrace` | Last 20 tool calls — name, args, result, duration, ok/error |
| `transcriptTail` | Last 10 student/Daniela turns with timestamps |
| `sosLog` | Unacknowledged SOS signals from Daniela |
| `dbWriteLog` | Key DB writes this session (commit_to_memory, etc.) |
| `sessionTelemetry` | TTS chars, exchange count, speaking time, LLM tokens |
| `pendingGlContext` | Last 5 pending GL context injections |
| `actfl`, `gear`, `toolCallCount` | Session state header |

### Layer 3 — Session Monitor (autonomous background watchdog)

Runs every 30s. Posts to Team Room when anomalies are found. No human needed.

- **Service:** `server/services/session-monitor.ts` — auto-started at server boot
- **Watches for:**
  - 🚨 Unacknowledged SOS signals from Daniela
  - ⚠️ High tool error rate (≥3/5 recent calls failed)
  - ⏸️ Stalled sessions (no activity >8 minutes)
  - 🖼️ Degraded vision pipeline (vocab grid with zero real descriptions)
- Marks SOS entries as `acknowledged: true` so the same issue doesn't repeat-notify

### Layer 4 — Daniela SOS Tool

Daniela can self-report issues she can't fix.

- **Tool:** `signal_issue(issue_type, description, severity)`
- **On call:** writes to `session.sosLog` + fires agent note to Team Room (async)
- **Issue types:** `image_failed`, `tool_error`, `interface_mismatch`, `context_gap`, `audio_problem`, `other`
- **Severity:** `low` (workaround available) / `medium` (degraded teaching) / `high` (cannot continue)
- **In luca-watch:** SOS entries appear in red at the top of every poll cycle

### Layer 5 — Function Flow Testing

Using the Observer Seat + Co-pilot view together to verify system state before/after each tool call:

```
1. Start agent session (Layer 1 or real session via Layer 2)
2. Fire a tool (via agent-visual-demo or watch David trigger it naturally)
3. Poll luca-session-view — verify:
   - toolCallTrace shows the call with status:'ok'
   - visionBuffer updated with the expected content
   - observerSeat.snapshot reflects the new state (within 10 calls)
   - transcriptTail shows what Daniela said about it
4. Dismiss the widget
5. Poll again — verify visionBuffer entry cleared
6. Verify next observerSeat snapshot no longer mentions the dismissed widget
```

---

## Architecture

- **Endpoint:** `POST /api/admin/agent-visual-demo` — fires a real GL session, captures tool calls + audio + transcript
- **History:** `GET /api/admin/observer-seat/runs` — all past runs (DB table: `observer_seat_runs`)
- **Replay:** `GET /api/admin/observer-seat/runs/:id` — full run detail for any past session
- **Audit Script:** `server/scripts/actfl-audit.ts` — headless multi-level comparison, no auth required
- **Frontend:** `client/src/pages/agent-visual-test.tsx` — three-panel view (Studio / Session / Whiteboard)

---

## Test Areas

### 1. ACTFL Level Calibration
*Does Daniela actually shift her language ratio, vocabulary ceiling, and sentence complexity across levels?*

**Scenarios to cover:**
- Same prompt at Novice Low vs Intermediate Mid vs Advanced Low
- Metric: English word count in transcript, sentence length, vocabulary CEFR level, first-sentence language

**Status:** In active iteration (July 2, 2026)

**Audit Run 1 — Before fix (descriptor-only system prompt):**
| Level | Transcript | English words | Audio |
|-------|-----------|---------------|-------|
| Novice Low | "¡Hola, Alex! Bienvenido. Me encanta tu entusiasmo por la comida." | 0 | 10.3s |
| Intermediate Mid | "¡Hola Alex! ¡Qué bien! Vamos a empezar con un poco de vocabulario esencial." | 2 | 9.8s |

**Finding:** Near-identical output. Root cause: global "Speak mostly in [language]" instruction acts as persona-level override — wins over ACTFL descriptor. Novice Low student was hearing "entusiasmo" (C1 vocabulary). Calibration was not working at all.

**Gemini Analysis (July 2, 2026):**
- "Persona Drift" — the model defaults to its training-set "Spanish Tutor" vibe
- Global language instruction poisons novice calibration
- Positive constraints ("prefer English") lose to negative constraints ("DO NOT use Spanish")
- Rules need to go at the END of the prompt (recency bias in streaming models)
- CEFR vocabulary ceiling required — model doesn't know "entusiasmo" is C1 without being told

**Fixes applied:**
1. Removed "Speak mostly in [language]" from both the visual demo and audit script prompts
2. Rewrote `buildOutputConstraints` in `server/system-prompt.ts` with negative framing (DO NOT / FORBIDDEN)
3. Added CEFR ceiling: A1-only at Novice, with specific forbidden words
4. Added initialization protocol: first spoken sentence must match level's language
5. Output constraints placed at the BOTTOM of system prompt (recency bias)

**Audit Run 2 — After descriptor-only update (still had global language line in script):**
| Level | Transcript | English words | Audio |
|-------|-----------|---------------|-------|
| Novice Low | Still 100% Spanish | 0 | 17.7s |
| Intermediate Mid | Still 100% Spanish | 1 | 7.4s |

**Audit Run 3 — After negative constraints (July 2, 2026):**
| Level | Transcript | English words | Audio | First sentence |
|-------|-----------|---------------|-------|----------------|
| Novice Low | "Hi Alex! I can absolutely help with that. Let's look at some key restaurant words to start. Mira (look) at these pictures!" | 8 | 9.3s | English ✓ |
| Intermediate Mid | "¡Hola, Alex! Me encanta que quieras practicar con comida, it's a great way to learn! ¿qué plato principal te gustaría probar hoy? What main course..." | 7 | 12.8s | Spanish ✓ |

**Result: CALIBRATION WORKING.** NL now has more English than IM (8 vs 7) for the first time. NL pattern: English-primary, single Spanish word with parenthetical translation. IM pattern: Spanish opener, English bridge, Spanish question + English translation. Novice forbidden vocabulary ("entusiasmo", "bienvenido") absent. IM fired 3 tools (set_mission_objective spontaneously). Analysis line: "✓ NL has more English bleed than IM — level calibration is working."

---

### 2. Visual Layer Reliability
*Do open_scene, show_vocab_grid, and show_vocab_card fire correctly and consistently?*

**Metrics:**
- Tool call order (open_scene before show_vocab_grid)
- Word count per vocab grid (target: 5–6)
- Image resolution rate
- Coverage grade (PASS / PARTIAL / FAIL)

**Status:** Both pre- and post-fix runs showed consistent visual tool firing (2 tools per run: open_scene + show_vocab_grid). The visual layer is reliable. The problem is voice calibration, not visual.

**Testing via co-pilot view:**
```bash
npx tsx server/scripts/luca-watch.ts
# Trigger show_vocab_grid in session
# Verify: visionBuffer.vocabGrid appears with word+description
# Verify: toolCallTrace shows show_vocab_grid status:'ok' with durationMs
# Dismiss panel → verify visionBuffer.vocabGrid clears
```

---

### 3. Lesson Arc — open_scene → show_vocab_grid → show_sentence_builder

*Does Daniela thread her visual tools into coherent teaching arcs across multiple turns?*

**The arc (5 phases):**
```
madrigal → broadcast → immersion → free_flow → recap
```

**The tool sequence (inner arc within a phase):**
```
open_scene → show_vocab_grid → show_sentence_builder
```

**Architecture (built July 2, validated July 3, 2026):**
- `LessonContext` struct lives on the GL session object: `{ phase, scene, vocab[], phaseObjective, phaseHint, updatedAt }`
- `OPEN_SCENE` writes scene → clears vocab on scene change → calls `pushLessonStatusContext`
- `SHOW_VOCAB_GRID` writes resolved vocab (text, translation, imageQuery) → calls `pushLessonStatusContext`
- `SHOW_SENTENCE_BUILDER` inherits vocab into any column where `items === undefined` (`[]` = intentionally blank for student input)
- `pushLessonStatusContext` serializes the struct into a single deduplicated `[Lesson context]` line in `pendingGlContext` — Daniela sees it on the next GL turn
- `UPDATE_LESSON_CONTEXT` — explicit phase declaration tool, accessible via `teaching_content(type:"update_lesson_context")`
- Heartbeat (`update_session_pedagogy`) writes `phaseHint` from gear level with 30s grace period (prevents overwriting a manual phase transition Daniela just made)

**Validated — July 3, 2026 (session arc-clean-1783040995):**

| Turn | Student says | Tools fired | Result |
|------|-------------|------------|--------|
| 1 | *"quiero aprender vocabulario de comida en el restaurante"* | `update_lesson_context` + `open_scene` | scene: restaurant_table |
| 2 | *"Muéstrame las palabras en una cuadrícula con imágenes"* | `show_vocab_grid` | 4 words: el café, el agua, el cruasán, la tostada |
| 3 | *"practiquemos construyendo frases con esas palabras"* | `show_sentence_builder` + `update_lesson_context` | **"Objeto" column: [el café, el agua, el cruasán, la tostada]** — exact vocab from T2 |

**Key result:** Vocab inheritance confirmed. Scene advanced restaurant_table → cafe_exterior without prompting. Phase declared as `immersion` automatically.

**Conductor Arc (Madrigal → Broadcast) — pending validation:**

The broader Madrigal → Immersive → Broadcast conductor arc is built but not yet arc-tested end-to-end via Layer 1b:
- Madrigal loop: `pedagogical-state-service.ts`
- Broadcast mode: real weather data (open-meteo + Perplexity)
- `processStartTextbookPage` injects the teaching protocol directive telling Daniela to call `invoke_teaching_skill("madrigal_chapter_drill")`

**Remaining test:** Open a Madrigal chapter → verify Madrigal loop auto-starts → verify Daniela transitions to immersive scene with the same vocabulary → verify broadcast surfaces at student's ACTFL level.

---

### 4. Daniela's Self-Visibility (July 2, 2026 — new thread)

**The insight (from David):** The gains from Luca seeing Daniela in action are the same gains Daniela gets from seeing herself in action. Webcam and screen-share exist for this, but **she needs good system-level self-visibility even when those are off.**

**What she can see right now:**
- Her own tool call results (if handlers return them)
- Student messages (real-time)
- Compass context (session start injection)
- Pre-session synthesis (DANIELA_STATE block)
- What she explicitly asks for via tool calls

**What she can't see right now (gaps):**
- Whether her vocab grid actually rendered (no render confirmation comes back to her)
- Whether the student saw what she intended to show
- Student attention signals (did they look at the whiteboard? did they click a word?)
- Whether her previous tool calls succeeded or silently failed

**Proposed additions:**
- Tool call acknowledgment: when `show_vocab_grid` fires, the handler could return a brief confirmation back into GL context ("Vocab grid displayed — 6 words shown")
- Render signals: frontend could POST `/api/session/widget-rendered` when a whiteboard item appears, feeding back into Daniela's context
- Engagement signals: dwell time on specific vocab cards, click-through on images
- Error signals: when image resolution fails for a word, Daniela should know so she can adapt

**Design principle:** Daniela should know what a student sees, not just what she sent.

---

### 4b. Daniela Self-Visibility — Wired (July 2, 2026)

**Philosophy:** Daniela fires tools into a void. She sends a vocab grid and has no idea whether
images loaded, how many words are showing, or whether the scene is live. The Observer Seat is
Luca's external view of Daniela. She needs the same view from the inside.

**What was built — tool acknowledgment system (native-fc-handlers.ts):**

| Tool | What she now knows |
|------|-------------------|
| `SHOW_VOCAB_GRID` | "Vocab grid confirmed: N words, M with images. Words: [list]." |
| `SHOW_IMAGE` | "Image confirmed: 'word' — [description] [source]." |
| `OPEN_SCENE` | "Scene confirmed in Studio Pane: '[label]' (env_name)." |
| `START_TEXTBOOK_PAGE` | "Vocab on screen: [list]. Teaching protocol: fire START_MADRIGAL_LOOP with vocab_query=..." |

All confirmations are injected into `pendingGlContext` and flushed via Gap 10 into the last
tool response before GL generates its next turn. Format: `[SYSTEM UPDATE — not spoken: ...]`.
Daniela reads this as her current interface state — she knows what's on screen before she speaks.

**Madrigal wiring (same edit):** `processStartTextbookPage` now injects the teaching protocol
directive. The textbook page opening IS the trigger for the acquire→apply→encounter arc. She
fires `START_MADRIGAL_LOOP` with the correct `vocab_query` (first vocab word from the lesson).

**What's still missing (Phase 2):**
- Image load failures (client-side — server doesn't know which images 404'd)
- Student engagement signals (clicks, dwell time on word cards)
- Interface state snapshot at turn start (what's *currently* on screen)

---

### 4c. Daniela SOS Feedback Loop (July 2, 2026)

**The problem:** Daniela can regenerate a single image, but she has no way to flag systemic failures she can't fix herself — image pipeline degraded, tool returning unexpected errors, context gaps that block teaching.

**What was built — `signal_issue` tool:**

Daniela calls `signal_issue(issue_type, description, severity)` when she hits a wall.

- **On call:** writes to `session.sosLog` ring buffer + fires agent note to Team Room (async, non-blocking)
- **Issue types:** `image_failed` / `tool_error` / `interface_mismatch` / `context_gap` / `audio_problem` / `other`
- **Severity:** `low` (workaround available) / `medium` (degraded teaching) / `high` (cannot continue)
- **In luca-watch:** SOS entries print in red at top of every poll cycle
- **In session monitor:** SOS entries trigger a Team Room post within 30s, then `acknowledged: true`

**The feedback loop:**
```
Daniela hits issue → calls signal_issue → sosLog populated
  → session-monitor sees it (within 30s) → Team Room alert
  → luca-watch shows it in red immediately (3s poll)
  → Luca investigates via Observer Seat / co-pilot view
  → Fix deployed → Daniela can resume teaching effectively
```

---

### 5. Gemini Suggestions Log

*Architectural recommendations from Gemini consults — captured for future build prioritization.*

**July 2, 2026 — ACTFL calibration consult (Round 1):**
- "Persona Drift" — the model defaults to its training-set "Spanish Tutor" vibe over ACTFL descriptors
- Global language instruction ("Speak mostly in X") acts as persona-level override — **never add it**
- Positive constraints ("prefer English") lose to the persona's trained default voice
- Negative constraints ("DO NOT use Spanish") are required to shift streaming output
- Recency bias: behavioral rules at the END of system prompt, not the middle
- CEFR vocabulary ceiling is required — the model doesn't have an internal ACTFL-to-CEFR mapping
- "Level-locked first response" pattern: force the first greeting to demonstrate the level immediately

**July 2, 2026 — ACTFL calibration consult (Round 2 — post-fix validation):**
- Calibration confirmed working: NL English count (8) > IM English count (7) for the first time
- NL pattern (English-as-medium) vs IM pattern (English-as-bridge) is more important than raw word counts
- Expanded forbidden word list: "practicar", "lección", "gramática", "comprensión", "excelente", "fantástico", "continuemos", "identificar" — teacher-ese cognate traps that bleed into novice output
- Added SYNTAX RULE: no subordinate clauses ("que", "porque", "cuando") for novice — breaks the "academic tutor" register
- Topic anchor in first-sentence protocol: greeting must reference the specific topic/image visible on screen
- Advanced level: absolute NO ENGLISH, even for encouragement ("Great job!" breaks immersion at this level)
- **Gemini verdict: "Ship it. The logic is now structurally sound."**
- Golden Order for production prompt: Persona → Tools/Capabilities → Curriculum/Context → ACTFL Constraints (THE ENFORCER)

---

## Run the Audit Yourself

```bash
npx tsx server/scripts/actfl-audit.ts
```

Compares novice_low vs intermediate_mid on the restaurant scenario. Reports:
- Transcript text (full)
- Tool calls fired
- Audio duration
- English word count as L1 bleed proxy

---

## Run the Co-pilot Watch

```bash
# Auth first (one time per server restart)
curl -si -X POST http://localhost:5000/api/internal/agent-session \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" -d '{}' \
  | grep -i set-cookie | sed 's/set-cookie: //i' | cut -d';' -f1 > /tmp/sc.txt

# Watch David's active session in real time
npx tsx server/scripts/luca-watch.ts

# Watch a specific user's session
npx tsx server/scripts/luca-watch.ts <userId>
```

---

## History Access (for Claude Code / Alden)

```
GET /api/admin/observer-seat/runs?limit=50
GET /api/admin/observer-seat/runs/:id
```

Every Observer Seat run is persisted with transcript, tool calls, coverage score, and audio URL.

---

## Systems to Test (Priority Queue)

| System | Test Method | Key Assertion | Status |
|--------|-------------|---------------|--------|
| ACTFL calibration | `actfl-audit.ts` | NL English% > IM English% | ✅ **Validated Jul 2** |
| Lesson Arc (inner) | Layer 1b arc test | Sentence builder inherits exact vocab from prior vocab grid | ✅ **Validated Jul 3** |
| show_vocab_grid | co-pilot watch + trigger | visionBuffer.vocabGrid populated, all words have descriptions | ✅ Confirmed (multiple runs) |
| Image vision (first-fetch race) | co-pilot watch | visionMode = 'bytes' on first session, 'cached' on second | 🔲 Not yet tested |
| Observer Seat heartbeat | co-pilot watch | observerSeat.snapshot changes every 10 calls | 🔲 Not yet tested |
| widget-closed signal | dismiss vocab grid | visionBuffer.vocabGrid clears within 3s poll | 🔲 Not yet tested |
| open_scene → add_to_scene → scene exit | co-pilot watch | scene buffer reflects canvas state at each step | 🔲 Not yet tested |
| signal_issue SOS | force an error, have Daniela call it | sosLog populated, Team Room alert within 30s | 🔲 Not yet tested |
| commit_to_memory | co-pilot watch + trigger | dbWriteLog shows conversation_memories insert | 🔲 Not yet tested |
| Conductor Arc (Madrigal → Broadcast) | Layer 1b multi-turn | Madrigal loop fires after textbook open; arc transitions cleanly | 🔲 Not yet tested |
| Session stall detection | let session idle 8m | session-monitor posts Team Room alert | 🔲 Not yet tested |
| ACTFL at Advanced level | `actfl-audit.ts` + Layer 1b | Zero English — immersion holds across multiple turns | 🔲 Not yet tested |
| Scene inheritance on phase change | Layer 1b | New scene clears old vocab; sentence builder rebuilds from new words | 🔲 Not yet tested |
| Friction score timing | Layer 1b + co-pilot | Student pause measured from playback_ended, not generationComplete | 🔲 Not yet tested |

---

## Brainstorm Queue — Next Session

*Ideas for Layer 1b tests to push the arc harder. Add to this list freely.*

### Stress tests
- **Long vocab grid → sentence builder column count:** Fire a vocab grid with 8 words — does the sentence builder create appropriate columns without overflowing? Does Daniela split them semantically (nouns vs verbs vs adjectives)?
- **Scene change mid-arc:** T1 open restaurant scene, T2 show vocab grid, T3 ask to "go to the market instead" — does the scene change clear the old vocab and Daniela rebuild the sentence builder from scratch?
- **Phase regression:** What happens if the student asks to go back to basics after reaching the immersion phase? Does the phase regress cleanly or does the heartbeat fight the declaration?

### Language-specific tests
- **Non-Latin script (Korean / Hebrew):** Run the same 3-turn arc in Korean. Do the vocab grid words render in Hangul? Does the sentence builder handle RTL (Hebrew) correctly?
- **ACTFL arc at Novice Low:** Run the arc with a novice student — Daniela should use English-primary speech even during the sentence builder phase. Does the ACTFL constraint survive the phase transition?
- **Intermediate vs Advanced sentence complexity:** Same scene, same vocab grid, different ACTFL level. Does the sentence builder's column structure change (simpler verb conjugations for IM vs complex subjunctive for Advanced)?

### Memory and continuity tests
- **Return student:** Run a 3-turn arc, end the session, start a new session with the same student — does Daniela reference the previous vocab or start fresh? (Tests the memory-to-context pipeline, not just the LessonContext struct)
- **Commit-to-memory trigger:** In the middle of a session, Daniela discovers a fact about the student ("you love sushi"). Does `commit_to_memory` fire? Does `GET /api/conversation-memories` show the new fact?

### Edge cases
- **Parallel tool calls:** Does Daniela ever fire `show_vocab_grid` and `open_scene` simultaneously? If so, does the lessonContext write order produce a consistent state?
- **SOS signal reachability:** Force an image pipeline failure mid-vocab grid — does `signal_issue` fire? Does it appear in luca-watch within 3s? Does the session-monitor post to Team Room within 30s?
- **Sentence builder with intentionally blank column:** Fire `show_sentence_builder` where one column has `items: []` (empty, intentional) — verify that column stays blank and is NOT filled by vocab inheritance.
