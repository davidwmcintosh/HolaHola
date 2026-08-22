# HolaHola Release Notes

This file is the authoritative log of features shipped. Updated by the agent after every build session.
Format: reverse chronological. Each entry includes what it does, what to check, and any config required.

> **Note on docs:** This is the single source of truth. `batch-doc-updates.md` is retired — all session notes go here directly.

---

## March 10 Session: Scenario Routing + Agent Activity Log
**Shipped:** March 10, 2026
**Built by:** Replit Agent

### Scenario direct-launch from browser
Navigating to `/chat?scenario=cafe-ordering` (or any scenario slug) now works end-to-end. Previously the URL parameter was silently ignored.

**How it works:** The slug is captured in `chat.tsx` → stored in `sessionStorage` → picked up in `StreamingVoiceChat.tsx` → passed through the WS `request_greeting` message → the orchestrator's `processGreetingRequest` appends an override instruction telling Daniela to call `load_scenario(slug)` immediately instead of giving a standard greeting.

**Files modified:**
- `client/src/pages/chat.tsx` — new `scenario` param branch in URL handler
- `client/src/lib/streamingVoiceClient.ts` — `requestGreeting()` gains `scenarioSlug` param
- `client/src/components/StreamingVoiceChat.tsx` — reads pending slug from sessionStorage before calling requestGreeting
- `server/unified-ws-handler.ts` — both handlers parse `scenarioSlug` and pass to orchestrator
- `server/services/streaming-voice-orchestrator.ts` — `processGreetingRequest` injects scenario override when slug present

### Agent Activity Log
A new "Agent Activity" panel in the Team Room sidebar (below Past sessions) shows what agents are currently building, have completed, or are blocked on — similar to the think-aloud style in this chat.

**How it works:** New `agent_activity_logs` table with actor, action_type, title, details, status (complete/in_progress/blocked), and a `todos` array for remaining items. GET `/api/agent-activity` reads the last 40 entries. POST `/api/agent-activity` writes a new entry (founder-only). At the end of each coding session, the agent writes a summary entry.

**Files modified:**
- `shared/schema.ts` — `agentActivityLogs` table + insert schema/types
- `server/storage.ts` — `addAgentActivityLog()`, `getAgentActivityLogs()`
- `server/routes.ts` — `GET /api/agent-activity`, `POST /api/agent-activity`
- `client/src/pages/TeamRoom.tsx` — collapsible "Agent Activity" sidebar section with status icons and todo list

### Config required
None — uses existing DB connection.

---

## generate_visual() — Daniela's On-Demand DALL-E Illustration Tool
**Shipped:** March 10, 2026
**Built by:** Replit Agent

Daniela can now call `generate_visual(concept, style?)` during any conversation to create a custom DALL-E 3 illustration that appears on the student's whiteboard. This was the original intent behind building the visual generation service.

**Difference from `show_image`:**
- `show_image(word)` → finds a real Unsplash photo of a vocabulary noun ("manzana", "mercado")
- `generate_visual(concept)` → creates a custom AI illustration of any scene, grammar concept, cultural moment, or scenario setting that a stock photo can't capture

**Rich metadata returned:**
- `semanticTags` — ACTFL-aligned vocabulary tags
- `accessibilityDescription` — full accessibility description
- `conceptAlignment` — 0–1 score of how well the image matched the concept

**Async by design:** Generation takes ~10 seconds. Daniela calls the function and keeps talking; the image appears on the whiteboard when ready (same buffering system as `show_image`). The image is immediately archived to permanent object storage so it's served from cache on repeat visits.

**Files modified:**
- `server/services/daniela-function-registry.ts` — added `generate_visual` function declaration
- `server/services/native-fc-handlers.ts` — added `GENERATE_VISUAL` async handler
- `server/services/classroom-environment.ts` — updated Tool Rack to distinguish `show_image` vs `generate_visual`

---

## Permanent Image Storage for Study Mode Visuals
**Shipped:** March 10, 2026
**Built by:** Replit Agent

DALL-E images are now archived to permanent cloud storage immediately after generation. All subsequent students load the same lesson and get the stored image for free — zero regeneration cost per lesson.

**How it works:**
1. DALL-E generates the image (returns a URL that expires in ~1 hour)
2. `image-storage.ts` downloads the bytes and uploads them to the object storage bucket at `public/ai-images/{md5hash}.jpg`
3. The permanent `storage.googleapis.com` URL is saved in `media_files.url` and linked via `lesson_visual_aids`
4. Cache check no longer uses a TTL — if a record exists, it's permanent and returned directly

**Fallback:** If object storage is unavailable, logs a warning and falls back to the original DALL-E URL (so Study Mode keeps working).

**Note:** Existing `lesson_visual_aids` rows with old expiring DALL-E URLs will re-generate on next load (one-time cost per lesson) and be replaced with permanent URLs.

**Files added/modified:**
- `server/services/image-storage.ts` — new; `archiveImageToPermanentStorage(url, filename)` helper
- `server/services/study-mode-service.ts` — imports helper, calls archive after generation, drops TTL check

**Config required:** `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (set automatically by object storage integration).

---

## DALL-E Key Priority Fix
**Shipped:** March 10, 2026
**Built by:** Replit Agent

`visual-content-service.ts` now checks `USER_OPENAI_API_KEY` before `OPENAI_API_KEY`. The old ordering was shadowing the valid key with an invalid one. Study Mode images now generate correctly.

**Files modified:** `server/services/visual-content-service.ts`

---

## Study Mode Image Caching
**Shipped:** March 10, 2026
**Built by:** Replit Agent

DALL-E images for Study Mode lessons are now cached in `lesson_visual_aids` (55-min TTL — just under DALL-E URL expiry). On cache miss, the image is generated and saved to `media_files` + `lesson_visual_aids`. Subsequent loads for the same lesson skip DALL-E entirely.

**Pending:** Full permanent storage (download bytes to file storage) not yet implemented — requires App Storage integration approval.

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
