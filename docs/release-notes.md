# HolaHola Release Notes

This file is the authoritative log of features shipped. Updated by Alden and the agent after every build.
Format: reverse chronological. Each entry includes what it does, what to check, and any config required.

---

## Study Mode
**Shipped:** March 10, 2026
**Built by:** Agent (prompted by Team Room discussion)
**Route:** `/study-mode` (sidebar → Study Mode)

### What it does
Proactively works through any Spanish curriculum unit as an immersive conversation session with Daniela.

Select a unit → Daniela generates a structured immersion scenario for each lesson in that unit, complete with a scene context, learning objectives, grammar scaffold, and a visual. You then practice with Daniela directly in that scenario — she keeps you in the scene, corrects inline, and adapts to your level.

### How it works
1. `GET /api/study-mode/units` — returns all Spanish units grouped by course level
2. `POST /api/study-mode/generate` — takes a `unitId`, fetches lessons from DB, uses Gemini/Daniela to build `ImmersionScenario` objects for each lesson, and calls DALL-E for scene visuals
3. `POST /api/study-mode/chat` — sends a message to Daniela in full scenario context, returns her immersion response

### Files added/modified
- `server/services/study-mode-service.ts` — new; core logic (unit fetching, Gemini scenario generation, Daniela chat)
- `client/src/pages/StudyMode.tsx` — new; frontend page
- `server/routes.ts` — 3 new endpoints injected at line ~27950
- `client/src/App.tsx` — route `/study-mode` registered; added to `isFullHeightPage`
- `client/src/components/app-sidebar.tsx` — "Study Mode" link added to student nav

### Config required
- **DALL-E images**: Requires `OPENAI_API_KEY` or `USER_OPENAI_API_KEY` secret with image generation enabled. Without it, visuals show Picsum placeholder images (everything else works normally). A banner shows on the page when running in placeholder mode.
- **Gemini**: Uses existing `AI_INTEGRATIONS_GEMINI_API_KEY` — already configured.

---

## Visual Content Service
**Shipped:** March 10, 2026
**Built by:** Alden (Team Room session, then agent wire-up)

### What it does
A shared image generation service that any AI participant can call by name: `generateVisual(concept, type, data, style)`.

Returns an image URL, alt text, semantic tags (ACTFL-aware: `actfl-novice`, `vocabulary`, `culture`, etc.), accessibility description, and concept alignment score.

### How it works
- Auto-detects provider at runtime: checks `OPENAI_API_KEY` / `USER_OPENAI_API_KEY` → `STABILITY_API_KEY` → placeholder
- DALL-E 3: landscape (1792×1024) for infographics, square (1024×1024) for images
- Stability AI: SDXL 1.0
- Placeholder: Picsum Photos seeded from concept string (deterministic, same concept = same image)
- `generateVisualBatch()`: parallel processing in groups of 3
- `validateVisualQuality()`: checks URL, alt text length, tag count, concept alignment score

### Files added/modified
- `server/services/visual-content-service.ts` — new; 256 lines
- `server/services/team-room-alden-service.ts` — imports and re-exports `generateVisual` so Team Room AI participants can call it

### Config required
- `USER_OPENAI_API_KEY` (or `OPENAI_API_KEY`) for DALL-E 3 — **currently set but returning invalid_api_key from OpenAI; needs verification**
- `STABILITY_API_KEY` (optional fallback)

---

## Conversational Immersion Framework (Types)
**Shipped:** March 10, 2026
**Built by:** Alden (Team Room session — Daniela's curriculum input shaped the design)

### What it does
TypeScript interfaces defining how a structured immersion session is represented throughout the system.

- `ImmersionObjective` — target skill + description + success criteria
- `ImmersionScaffold` — level-keyed hints, grammar notes (inline, non-interrupting), fallback prompts
- `ImmersionScenario` — the full scenario: context string, objectives, scaffold, optional visual prompt
- `ImmersionSession` — runtime state tracker: current objective index, completed objectives, grammar points introduced, adaptive level

These are consumed by Study Mode and available to any Team Room participant or future feature.

### Files modified
- `server/services/team-room-alden-service.ts` — interfaces added at lines 63–103; Daniela's system prompt extended to reference her role as immersion architect

---

## Team Room Chat Quality Improvements
**Shipped:** March 10, 2026
**Built by:** Agent

### What changed
- **Response cap**: On untargeted messages, max 2 participants respond (Alden + highest-confidence peer). Everyone else holds back.
- **PASS mechanism**: Daniela, Sofia, Lyra, and Wren each scan their own recent messages before responding. If their core point is already in the thread, they output `VOICE: PASS` — treated as silence, no message posted.
- **Daniela's format**: System prompt now explicitly bans the "As the AI / As co-founder / As student advocate" structure. One perspective, colleague voice.
- **Alden self-check**: He can't PASS (always anchors), but if he's covered the topic he's instructed to pivot to a new angle or follow-up question rather than re-summarize.

### Files modified
- `server/services/team-room-alden-service.ts` — all persona response prompts updated; PASS parsing added to all parsers; response cap added in `evaluateAllParticipants`

---

## How to Add to This File

After shipping any feature — whether built in the Team Room or directly by the agent — add an entry here before closing the session. Minimum required fields:
- What it does (user-facing, plain language)
- Any config/secrets required (and current status of those secrets)
- Files added or modified
- Route or entry point

If a feature is **blocked** on a missing secret or config, note it explicitly and flag it in the summary to the user.
