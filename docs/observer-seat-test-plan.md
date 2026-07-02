# Observer Seat — Test Plan & Findings

*Living document — Luca's diagnostic workspace.*
*Last updated: July 2, 2026*

---

## What the Observer Seat Is

The Observer Seat is Luca's (the Agent's) closed test loop for the visual layer. It fires a Gemini Live session with a real scenario, captures every tool call, transcript, and audio response, and displays them side-by-side so Luca can see exactly what Daniela produces — without needing to be a student.

The core insight: the same way the Observer Seat gives Luca visibility into Daniela's performance, **Daniela needs equivalent self-visibility into the system** — what she fired, what rendered, what the student saw. That's a parallel thread (see §5 below).

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

---

### 3. Conductor Arc — Stitching Madrigal + Broadcast + Immersive
*Daniela's three teaching modes need to hand off to each other gracefully.*

**The arc:**
```
Acquire (Madrigal vocab drill)
  → Apply (immersive scene — student uses the words in context)
    → Encounter (broadcast mode — real-world material at their level)
```

**Current state:**
- Madrigal loop: exists in `pedagogical-state-service.ts` (`startMadrigalLoop`) but is NOT wired to textbook chapter opening. `processStartTextbookPage` doesn't call it.
- Broadcast mode: fully implemented with real weather data (open-meteo + Perplexity)
- Immersive scene: `open_scene` works; narrative immersion mode needs Conductor coordination

**Gap:** No automatic trigger from textbook chapter → Madrigal → immersive → broadcast. Each mode runs independently; Daniela doesn't know to thread them.

**Planned fix:** Inject continuation instruction in `processStartTextbookPage` when a Madrigal chapter opens, telling Daniela to call `invoke_teaching_skill("madrigal_chapter_drill")`.

**Test plan for Conductor Arc:**
1. Open a Madrigal chapter from the textbook → verify Madrigal loop auto-starts
2. After Madrigal completes → verify Daniela transitions to an immersive scene with the same vocabulary
3. After immersive → verify Daniela can surface broadcast mode with real-world weather/news at student's ACTFL level

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

### 4b. Daniela Self-Visibility in the Visual Demo (Observer Seat)

The visual demo's `buildDemoOutputConstraints` now matches the production `buildOutputConstraints` logic:
negative framing, CEFR ceiling, initialization protocol, output constraints at bottom of prompt.

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

## History Access (for Claude Code / Alden)

```
GET /api/admin/observer-seat/runs?limit=50
GET /api/admin/observer-seat/runs/:id
```

Every Observer Seat run is persisted with transcript, tool calls, coverage score, and audio URL.
