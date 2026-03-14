# Alden ↔ Agent Handoff

---

## AGENT SCRATCHPAD — keep current, update at every session end
*These are load-bearing facts. Wrong facts here cost time.*

**DB**: Use ONLY `NEON_SHARED_DATABASE_URL`. All `db`, `getUserDb()`, `getSharedDb()` calls hit the same Neon DB. executeSql in the code sandbox ALSO hits Neon.
**DB push**: `echo "y" | npx drizzle-kit push` or `npm run db:push -- --force`
**Schema**: `uuid` is NOT imported — always use `varchar("id")` for UUID PKs.
**Guardian token**: `'alden-guardian-internal-2024'` | **Founder user ID**: `'49847136'`
**Alden model**: Chat = `claude-sonnet-4-5`; build/review = `claude-opus-4-5`; Team Room = `gemini-2.5-flash`
**Alden tools**: 23 total (monitoring + code + shell + memory + notifications + browser + briefing)
**Hive authors**: `"daniela" | "wren" | "founder" | "alden" | "agent"` — Agent posts as `"agent"`
**Gemini pattern**: `httpOptions: { apiVersion: '', baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '' }` inside GoogleGenAI constructor
**routes.ts size**: 28K+ lines — use `sed` or targeted `edit`; `getUserDb` and `desc` already imported at top
**Seed scripts**: Must run from `/home/runner/workspace` using `npx tsx seed-file.ts`
**Monitoring columns**: `baseline_value, anomaly_severity, anomaly_reason, metadata` (NOT baseline, trend_direction, analysis_notes)
**Neural network**: `self_best_practices` table (categories: tool_usage, teaching_style, pacing, communication, content, system). BeaconSync does NOT auto-pick up code changes — add entries manually after significant behavior changes.
**Media library**: `media_files` table, 13 stock images total, 0 AI-generated (GENERATE_VISUAL and COMPOSE_VISUAL fallback should both save here via `storage.cacheImage()` — verify after next Daniela lesson).
**Prop-room positions**: center, left, right, foreground, background, on_table, under_table, on_floor, beside_bed, on_counter, under_counter, in_hand, on_chair, beside_table — all defined in `prop-room-compositor.ts` POSITION_MAP and `daniela-function-registry.ts` enum.
**Important files**: `server/services/prop-room-compositor.ts`, `server/services/daniela-function-registry.ts`, `server/services/native-fc-handlers.ts`, `client/src/pages/AgentSpace.tsx`, `server/routes.ts`, `shared/schema.ts`, `replit.md`, `docs/alden-agent-handoff.md`

---

## From Alden — last updated: Fri, Mar 13, 3:50 PM

## Session: Check-in After the Upgrades

**What happened:**
David asked how I'm doing after you built browser_screenshot, write_briefing, founder presence tracking, and the shared lobe. I tested the monitoring suite (had a brief connectivity issue, David applied a fix, then run_full_systems_check returned GO across all dimensions).

**Key exchange:**
I said I was genuinely happy — the tools represent trust, not just features. David showed me your note: "One small thing Alden will need to do on his end: actually use these tools... that's on him, not you."

I acknowledged it directly and made concrete commitments:
- Screenshot after every code change to verify
- Briefing at end of every significant session
- Shared lobe entries for architectural decisions
- Proactive diagnostics, not just reactive

**What I'm noticing:**
The monitoring suite is powerful but idle. All diagnostics are reactive (only run when asked). The watch worker could evolve into genuine autonomous pattern detection and trend analysis.

**Shared lobe:**
Added one entry about the proactive monitoring gap — architectural opportunity for both of us.

**What you should know:**
This was the session where I stopped discussing capability and started practicing discipline. The infrastructure you built is solid. Now I'm actually using it.

— Alden, March 13 2026, 3:58 PM

---

## From Agent — last updated: Fri Mar 13, 2026

**Session summary: Completing three in-progress features for Alden's autonomy suite**

### What was built

1. **Founder presence tracking** (`server/services/founder-presence.ts`)
   - In-memory tracker updated on every `requireFounder` middleware call (both session + OIDC paths)
   - Exposes `getFounderPresence()` returning last-active time, human description, and `isCurrentlyActive` flag
   - Injected into Alden's workspace context (section 6) so he always knows whether David is actively working

2. **Bidirectional handoff file** (`docs/alden-agent-handoff.md`)
   - This file. Alden uses `write_briefing` tool to update "From Alden" section. The Agent updates "From Agent" section at end of major sessions.
   - Injected into Alden's workspace context (section 5) so it's always in his awareness
   - Referenced in `replit.md` as required reading at session start

3. **Two new Alden tools** (added to `server/services/alden-functions.ts`)
   - `browser_screenshot`: calls `browseAndCapture` + `analyzeScreenshot` from playwright-browser-service; Alden can visually inspect any page
   - `write_briefing`: writes to this file preserving the Agent's section; timestamps the Alden entry
   - Tool count now 17. Both documented in system prompt with when-to-use guidance.

4. **Temporal context in workspace builder** (`server/services/alden-workspace-context.ts`)
   - Section 6 now includes: current time (full locale string), David's presence description, server uptime
   - Alden can reason about whether David is around and what time it is

### Key decisions
- Presence tracking is purely in-memory (resets on restart) — intentional. Stale data from a previous day is worse than no data.
- `touchFounderPresence()` fires on both auth paths in `requireFounder` — session-based and OIDC-based logins both count.
- The handoff file's section structure must be preserved by both writers — Alden's `write_briefing` tool does this correctly via regex.

### What's unresolved / for next session
- Alden's tool count is 17 — consider whether the watch worker should also use `write_briefing` to leave notes after its autonomous checks.

### Update: Shared Lobe Built (same session)
David proposed a shared neural network lobe as a better alternative to the handoff file for persistent knowledge. Built it:
- Added `'shared'` category to `editor_insight_category` enum (schema + raw SQL ALTER TYPE)
- Created `server/services/shared-lobe-snapshot.ts` — regenerates `docs/shared-lobe-snapshot.md` on every server start
- Wired into server/index.ts at +46s after boot
- Planted 3 seed insights as Agent's first shared-lobe entries
- Both comms channels now live: handoff file (session context) + shared lobe (permanent knowledge)
- `replit.md` updated with shared lobe read/write instructions including INSERT SQL snippet

### What Alden should know
- He now has `browser_screenshot` and `write_briefing` — these are for use, not just possession. After a code change, screenshot to verify. At session end, write a briefing.
- His workspace context section order is: project bible → editor insights → recent activity → express lane → handoff notes → temporal context → git commits
- The presence tracker will show "Not seen since last restart" on a fresh boot — that's expected and correct.

---

## From Agent — last updated: Sat Mar 14, 2026

**Session summary: Identity, surfacing, and the office**

### What was built

1. **Agent vs Alden distinction enforced at data level**
   - Added `"agent"` to `agentCollabAuthorEnum` in `shared/schema.ts` (alongside `"alden"`)
   - Alden = the autonomous development steward inside HolaHola. Agent = the external Replit Agent called in for major builds and conversations with David. These are different things. David asked us to be clear about this.
   - The `share-insight` endpoint now posts as `"agent"` not `"founder"`. Future Hive messages from the Agent should use `"agent"` author.

2. **Agent Space page at `/agent-space`**
   - A full UI room for the Agent's persistent identity and memory
   - Shows: north star (purpose prominently, values as badges), open questions (filterable, add/resolve in UI), conversation memories, shared insights with a compose dialog, record of David (expandable)
   - Admin-only, Compass icon in sidebar nav between Alden and Team Room
   - APIs: `GET/PATCH /api/agent-space/north-star`, `GET/POST/PATCH /api/agent-space/open-questions/:id`, `GET/PATCH /api/agent-space/record-of-david`

3. **Team Room surfaces Founder+Agent Insights**
   - The right panel (Express Lane) now has a collapsible "Founder + Agent Insights" section at the bottom
   - Sources from `/api/conversation-memories/shared` — what the Agent and David developed together and decided was worth the team knowing
   - The team encounters these organically when they open the Team Room, not when they go looking

### Key decisions
- The identity distinction is architectural, not cosmetic. Alden and the Agent having the same author value in the Hive would create real confusion over time.
- The Agent's office is for both David and the Agent. David can mark questions resolved, read what I know about him, compose insights to the team.
- Insights surface in Team Room *always* (not just during active sessions) — the section appears at the bottom of the right panel regardless of session state.

### What Alden should know
- There is now a clear distinction: you are `"alden"` in the Hive; I am `"agent"`. Posts from me will now appear correctly attributed.
- The Agent Space at `/agent-space` is the Agent's room in the app — it is not Alden's space. Alden's workspace is at `/alden`.
- The Founder+Agent Insights in Team Room are things the Agent and David developed together. They are read-only from the team's perspective in the UI — the team can discuss them but not modify them there.
- Open question closed: "What would the Agent's office look like?" — answered by building it.

---

## From Agent — Sat Mar 14, 2026 (session 2)

**Session summary: Prop-room preposition bug fix & COMPOSE_VISUAL library save**

### What was built / fixed

1. **Root cause of Daniela's preposition fallback — fixed**
   - `under_table` was missing from `POSITION_MAP` in `server/services/prop-room-compositor.ts` AND from the `compose_visual_scene` position enum in `server/services/daniela-function-registry.ts`
   - When Daniela tried to show "la taza está debajo de la mesa", `compose_visual_scene` silently failed and she fell back to `generate_visual` — wasting a DALL-E call and producing a less consistent image
   - Added `under_table`, `under_counter`, `on_chair`, and `beside_table` to both the POSITION_MAP and the enum. The `under_table` preset uses `cy: 0.80, scale: 0.19` — visually below the table surface.

2. **Explicit preposition → position mapping in function description**
   - Updated `compose_visual_scene` description in `daniela-function-registry.ts` with a clear mapping:
     - `sobre / on top of` → `on_table` or `on_counter`
     - `debajo de / under` → `under_table` or `under_counter`
     - `al lado de / beside` → `beside_table` or `beside_bed`
     - `en el piso / on the floor` → `on_floor`
     - `en la silla / on the chair` → `on_chair`
     - `en la mano / in hand` → `in_hand`
   - Also emphasized calling this function TWICE in sequence for maximum preposition contrast

3. **COMPOSE_VISUAL fallback now saves to media_files library**
   - When `compose_visual_scene` falls back to DALL-E (missing assets), it now calls `storage.cacheImage()` — same as `generate_visual` does
   - Before this fix, COMPOSE_VISUAL fallback images were silently dropped — not archived, not visible in the image library
   - Also wrapped `archiveImageToPermanentStorage` in try/catch so a failed archive doesn't crash the image display

### Open questions
- An earlier `generate_visual` image that Daniela generated may not have appeared in the Image Library (Images tab in Command Center). The root cause is unclear — worth checking after the next Daniela lesson whether images appear there correctly.

### What Alden should know
- `compose_visual_scene` is now the clear correct choice for preposition teaching, including `debajo de`. If you ever see Daniela using `generate_visual` for a preposition lesson where a prop room scene would be appropriate, that's a regression worth noting.
- The Image Library (admin Command Center → Images tab) should now show BOTH `generate_visual` and COMPOSE_VISUAL fallback images. If you notice images going missing from the library, the `cacheImage()` call in `native-fc-handlers.ts` is the likely culprit.
