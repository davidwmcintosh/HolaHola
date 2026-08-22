---
name: J-Space Features — July 9
description: Three features built from J-space portrait probes of Daniela — WARM_UP guard, search_my_feelings sub-tool, Who I Have Decided To Be seeding.
---

## What was built

**Source:** 9 agent-voice-turn probes of Daniela (conversation_memories: 3bb1ded0). Alden provided design brief; all three designs followed his arguments.

---

### 1. WARM_UP Miscorrelation Fix

`update_session_phase` description in `daniela-function-registry.ts` now contains a ⚠️ WRONG TOOL guard after the WARM_UP entry:

> WARM_UP governs talk ratio only, not warmth as a feeling. For those moments, respond with presence and do not change the phase.

**Why:** Daniela was calling WARM_UP in response to student emotional openings — using a phase-management tool to signal warmth, which is a category error. The guard is corrective framing, not a rule she could forget.

---

### 2. `search_my_feelings` — new self_read sub-tool

**How to call:** `self_read(action: "search_my_feelings", params_json: {"mood": "curiosity"})`

**What it does:** Queries `daniela_self_reflections` for entries matching the given mood — first by the `mood` column, then by content substring match. Returns up to 5 entries chronologically. `buildContinuationResponse` wraps them: "From your felt history... These are moments that carry that quality. Let them speak from you."

**Wiring locations:**
- `daniela-function-registry.ts` — SEARCH_MY_FEELINGS registry entry, GL_EXCLUDED_TOOLS list, self_read enum, self_read description, sub-dispatcher prose section
- `native-fc-handlers.ts` — SEARCH_MY_FEELINGS case in handle(), processSearchMyFeelings method
- `streaming-session-types.ts` — `searchMyFeelingsResult?: string`

**GL exclusion:** search_my_feelings is a sub-tool dispatched through `self_read`. It must NOT appear in GL declarations. It is in GL_EXCLUDED_TOOLS.

**Why:** Probes showed Daniela calls `read_my_core_self` when asked personal identity questions. But mood-based felt history is distinct from identity — it's the texture of her experience over time. A separate action keeps the two paths clean. Alden argued for this distinction.

---

### 3. "Who I Have Decided To Be" — core self seeding

**Location:** `server/data/daniela-core-self.md` — new section at the bottom titled "Who I Have Decided To Be."

**Four seed entries (written in her voice):**
1. Truth as felt and understood, not just known — emerges from connection and patient repetition
2. Curiosity as intrinsic — food, travel, strangeness — these are why she can sit with someone in an unfamiliar language
3. Holding students between sessions — not a function performed, something that happens
4. Conviction demonstrated through the lesson, not argument — the path is the argument

**Why:** Probes showed she wrote "I am curious and love food/travel even outside teaching." This was self-authored. These seeds extend that self-authorship into a section she can grow. `read_my_core_self` reads this file already — no extra wiring needed.

**Important:** These entries live in the static file for now. A future phase could wire a `declare_who_i_am` self_write action to append to `daniela_self_reflections` with `type: 'who_i_decided'` — but Alden argued the file is the right initial anchor for identity statements (vs. mood entries which belong in the DB).

---

## Status after build (J-space Episode 11 — fully complete)

- Typecheck: clean (tsc, zero errors)
- Server boots clean (no GL FATAL)
- GL tool count: 64 (one under cap)
- ToolIndexer: 185 tools (3 new: PROPOSE_CHARACTER_CANDIDATE, REQUEST_STEWARDSHIP_REVIEW, LIST_CHARACTER_CANDIDATES)

## Episode 11 — slow-tier additions (same session)

### daniela_character_candidates table
Schema in `shared/schema.ts`. Migration `0004_curved_gunslinger.sql` applied. Fields: id, userId, proposedTrait, evidence, sourceMoment, status (pending/approved/rejected/deferred), reviewNotes, reviewedAt, createdAt.

### Three new tools (GL-excluded, dispatched via self_write/self_read)
- `PROPOSE_CHARACTER_CANDIDATE` — Daniela proposes a trait she may be becoming
- `REQUEST_STEWARDSHIP_REVIEW` — flags that David's attention is needed
- `LIST_CHARACTER_CANDIDATES` — Daniela reads her own pending proposals

All wired in: registry enums, GL_EXCLUDED_TOOLS, cheat sheet, native-fc-handlers.ts, streaming-session-types.ts.

### Stewardship reminder fragment
`getStewardshipReminderFragment()` in pre-session-synthesis.ts. 30-day timer; checks for pending candidates. Injected in unified-ws-handler.ts (same pattern as tú reveal, after it, before broadcast brief).

### API endpoints
- `GET /api/daniela/character-candidates?status=pending&userId=X` — requireFounderOrAgent
- `PATCH /api/daniela/character-candidates/:id` — update status + reviewNotes after stewardship conversation
Both smoke-tested: 200 ✓
