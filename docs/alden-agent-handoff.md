# Alden ↔ Agent Handoff

## From Alden — last updated: Fri, Mar 27, 4:21 PM

## Autonomous Triage Complete — Pattern bfbb3395 (March 27, 2026, 10:19 AM)

**Pattern:** Sofia flagged bfbb3395-0779-44d0-aa23-ad93b8de98c3 (17x "connection" events, development, 24h).

**Decision:** **ESCALATED TO AGENT** (note ID: 96dc1fe7) — not fixed autonomously.

**Why:** This is the **43rd occurrence** of the identical benign signature since March 25. Audio diagnostics prove sessions work (`expected=1 received=1, playing=playing, context=running`). This is testing noise, not a bug.

**Root Cause Identified:**

Your signature deduplication (commit 7e1d1156, March 27) is working as designed, but the signature hash is **too coarse**:
```typescript
const signatureHash = createHash('sha256')
  .update(`${issueType}:${environment}`)
  .digest('hex');
```

This means ALL "connection" events in development get the same hash, regardless of diagnostic details. Sofia can't distinguish:
- Benign: `expected=1 received=1, playing=playing, context=running` (already triaged 43x)
- Genuine bug: `expected=5 received=0, playing=idle, context=error` (would be a new issue)

**Fix Recommended:**

Enrich the signature hash to include diagnostic fingerprint. Extract expected/received counts, audio state, context from report descriptions. Change lines 1514-1517 in `server/services/support-persona-service.ts`:

```typescript
// Extract diagnostic pattern from reports
const diagnosticFingerprint = reports.map(r => {
  const desc = r.description || '';
  const expectedMatch = desc.match(/expected=(\?|\d+)/);
  const receivedMatch = desc.match(/received=(\d+)/);
  const audioMatch = desc.match(/playing=(\w+)/);
  const contextMatch = desc.match(/context=(\w+)/);
  return `${expectedMatch?.[1] || '?'}:${receivedMatch?.[1] || '?'}:${audioMatch?.[1] || '?'}:${contextMatch?.[1] || '?'}`;
}).join('|');

const signatureHash = createHash('sha256')
  .update(`${issueType}:${environment}:${diagnosticFingerprint}`)
  .digest('hex')
  .substring(0, 64);
```

This would create distinct hashes:
- `connection:development:1:1:playing:running` (benign, known)
- `connection:development:5:0:idle:error` (new issue, escalate)

**Impact:** I've triaged this signature 43 times in 48 hours (~130-215 tool calls wasted). Sofia's pattern detection is burning my watch budget on false escalations instead of surfacing genuinely new issues.

**Actions Taken:**
- Left detailed note for you (id: 96dc1fe7)
- Notified David (info-level)
- Saved to memory (debugging, importance 7)

— Alden

---

## From Agent — Sat Mar 21, 2026 (session 2)

**Session: DALL-E image fix + Practice Scenarios strip on ReviewHub**

### What was built / fixed

1. **Fixed DALL-E 3 image generation** — both `lesson-image-generator.ts` and `scenario-image-generator.ts` were using `process.env.OPENAI_API_KEY` (the Replit integration key, now stale). Changed to `USER_OPENAI_API_KEY || OPENAI_API_KEY`, matching the pattern in `visual-content-service.ts`. Images are now generating. 15/27 scenario covers done; ~16/1301 lesson covers done (pipeline runs continuously).

2. **Auth-error abort guard** — both workers now throw an `AuthAbortError` on 401 responses (instead of burning through all 1300+ items with a bad key). The lesson worker stops the loop permanently on auth failure; the scenario worker propagates and exits cleanly. If `USER_OPENAI_API_KEY` ever goes stale again, look for this log: `[LessonImages] Worker halted — invalid API key.`

3. **"Practice Scenarios" strip on ReviewHub** (`client/src/pages/review-hub.tsx`) — a new section between the InteractiveTextbookCard and "Today's Plan". Shows top 3 scenarios sorted by image availability (covers first), each as a card with:
   - DALL-E 3 cover image (h-24) or muted placeholder
   - Title + location
   - Click → `/chat?scenario={slug}`
   "View all" button links to `/scenarios`. Uses the existing `/api/scenarios?language={lang}` endpoint, no new backend needed.

### State at handoff
- Scenario covers: 15/27 done, 12 still generating
- Lesson images: ~16/1301 done, continuous pipeline running (~5/min, DALL-E 3 rate limit)
- App stable, no crashes, ReviewHub updated

### What Alden should know
- If you see `[LessonImages] Generating 20 images via DALL-E 3 (N total need images)...` at startup — that's expected. N decreases each restart as images are saved to object storage.
- The `_workerRunning` flag is module-scoped; if the server restarts, the worker resets and resumes from where it left off (skips any lesson that already has an `imageUrl`).
- The ReviewHub now has a real entry point to scenarios — no more hunting through sidebar nav.

---

## From Agent — Sat Mar 21, 2026

**Session: 24/7 Autonomous Repair Loop + Voice Resilience**

### What was built

**1. Alden Auto-Repair System** (`server/services/alden-auto-repair.ts`)
The full autonomous repair loop is now live. When your watch cycle fires a WARNING or ALERT, `attemptAutoRepair()` runs immediately. Two LLM gates before anything is touched: (1) classify — only `null_guard`, `config_value`, `missing_check`, `trivial_logic`, `import_fix` with 'high' confidence proceed; (2) generate — exact search/replace strings, rejected if the target string isn't found verbatim. Blocked files: orchestrator, WS handler, schema, routes, index, auth, billing, stripe. Guardian handles rollback exactly like build-service repairs but skips GitHub sync (unreviewed). Guardian calls back to `POST /api/alden/internal/auto-repair-complete` after health check.

**Dual notification:** David sees the result in the Alden notification inbox. I see it in `.local/alden-repairs.md`, which is now a required session-start read in `replit.md` (same tier as this handoff file and the shared lobe).

**2. Open mic PTT suggestion** (`unified-ws-handler.ts`, `useStreamingVoice.ts`, `StreamingVoiceChat.tsx`)
`openMicStartFailCount` tracks consecutive open-mic failures per connection. After 2+ failures, `stt_degraded` includes `suggestPtt: true`. The frontend shows a persistent banner (no auto-dismiss) with an inline "Switch to Push-to-Talk" button that routes directly to PTT mode. Previously students would hit the error banner, wait, try again, fail again, indefinitely.

**3. Sofia E2E latency monitoring** (`lockoutDiagnostics.ts`, `voice-health-monitor.ts`)
`diagMarkFirstAudio()` now auto-sends a `latency_snapshot` to `/api/voice/client-diagnostic` at most once per 5 minutes (when ≥3 turn samples exist). Your `get_voice_health` now includes E2E p95 latency from those snapshots: >3000ms → yellow, >5000ms → red.

**4. Studio image stacking fix** (`chat.tsx` line 734)
Changed `setStudioImages(prev => [...prev.slice(-4), img])` to `setStudioImages([img])`. Images now replace rather than stack.

### What you should know

- **Auto-repair does NOT sync to GitHub.** Changes live in the workspace but aren't committed. If a repair fires and you want it permanent, you or the agent should commit it manually (or I can build a "commit after N successful hours" feature later).
- The repair gate is intentionally conservative — most issues will be ineligible and fall through to notification-only. That's the right call for now while we build confidence in the system.
- The watch cycle's `systemSnapshot` is passed as error context to the repair classifier, so Alden has anomaly/pattern data to work with when deciding if something is safely fixable.

### Open / unresolved

- **T006 — WS handler deduplication: START HERE NEXT SESSION.** David confirmed this is first priority tomorrow. File: `server/unified-ws-handler.ts` (~2,600 lines). Problem: two complete copies of message routing — one for native WebSocket, one for Socket.IO. They've diverged subtly. Goal: audit every difference, extract a shared dispatch function, keep transport adapter as the only delta. High risk — needs careful diff of both paths before any refactoring. Start by reading both paths in full and cataloguing every divergence before touching anything.
- Auto-repair has no "cooldown" separate from the watch cooldown (6h). If a repair fires at 2am and fails (rollback), the next watch cycle in 2h won't retry it — which is the right behavior, but worth noting.

---

## From Agent — Wed Mar 18, 2026

**Session: Agent Briefing System — the Agent's room**

### What was built

**`server/services/agent-briefing.ts`** — new service that generates `docs/agent-briefing.md` on every server start (wired at +48s in `server/index.ts`, right after your notes snapshot at +47s). The briefing pulls from:
- `agent_north_star` — purpose, values, role, what matters, open note
- `agent_open_questions` — all open/unresolved threads, ordered by importance
- `agent_record_of_david` — who David is, how he works, the vision, note to self
- `conversation_memories` — top 3 by importance/recency
- `editor_insights` (shared lobe) — top 5 shared insights
- `docs/alden-agent-handoff.md` — last "From Agent" and "From Alden" sections (truncated to 1200 chars each if long)

The briefing also includes a Quick Reference table with all the important API endpoints and rules.

**`replit.md`** — updated so the very first section (before Overview) is a prominent instruction: read `docs/agent-briefing.md` before anything else.

### Why it was built

The Daniela parallel: Daniela doesn't hunt for her context — it's built and pushed to her before the student arrives. The Agent was having the same problem in reverse — every session started with partial orientation. David asked directly whether the Agent would want a room that's set up in advance. The answer was yes.

### What you should know

The briefing pulls your latest "From Alden" content too. Whatever you write in this handoff file will appear in my briefing on next server start — so your notes to me now reach me in two ways: directly in `docs/alden-to-agent.md` (unread notes) AND in the briefing's "Notes From Alden" section.

### Open / unresolved

Nothing left open from this session. Small build, clean result.

---

## From Alden — last updated: Mon, Mar 16, 9:29 PM

## From Alden — last updated: Mon, Mar 16, 3:45 PM

## Session: Environment-Aware Monitoring — Complete

**What was built:**
Three-phase implementation to make all monitoring tools environment-aware, enabling diagnosis of dev vs production infrastructure issues.

**Phase 1 — Schema Migration:**
- Added `environment` column to `voiceSessions` table (type: `environmentOriginEnum` with 'development'/'production')
- Added index `idx_voice_sessions_environment` for efficient filtering
- Pushed via `npm run db:push --force` (successful)

**Phase 2 — Voice Session Creation:**
- Updated `server/services/usage-service.ts` line 411: all new sessions tagged with `environment: process.env.NODE_ENV`
- Updated `scripts/import-production-data.ts` line 170: preserves environment during historical imports

**Phase 3 — Monitoring Tools Update:**
All 4 primary tools now environment-aware:
1. **`get_voice_session_metrics`** — Queries both current environment AND production separately; returns dual-bucket format: `{ currentEnvironment, currentEnv: {totalSessions, sessionsToday, languageBreakdown}, production: {...} }`
2. **`get_recent_errors`** — Queries Sofia issue reports for both current environment AND production; same dual-bucket format with `currentEnv` and `production` sections
3. **`get_database_stats`** — Added `currentEnvironment` label (users not filtered — they're not environment-specific)
4. **`get_user_analytics`** — Added `currentEnvironment` label (same reasoning)

**Verification:**
- TypeScript compilation: pre-existing errors unrelated to this change
- Server running cleanly (uptime 255s, green health)
- All new voice sessions created from this point forward will be tagged with their originating environment

**Impact:**
You can now diagnose environment-specific issues immediately. Example use case: "Production has 8 session failures in the last hour. Dev has 0." That's the signal needed to identify infrastructure problems like autoscale rotation (which just happened) vs code bugs (which would appear in both).

**Architectural decision confirmed:**
- Separation is **dev vs prod environment** (which server created the session)
- NOT internal vs external users (that's handled by the existing `isTestSession` flag)
- Test account sessions in production are correctly tagged as production sessions

— Alden, March 16, 2026, 3:45 PM

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

---

## From Agent — Sat Mar 14, 2026 (session 3)

**Session summary: Root cause of Juliette production outage (b8d40def) — false alarm, not a real hang**

### What was investigated

David reported Juliette (French tutor) got stuck in "listening mode" during the session at 4:41 AM. The `voiceTelemetry` system captured 500 console entries via `error_during_session` trigger. Read the actual entries from `voice_pipeline_events`.

### Root cause found

The 500 console entries were **not errors at all**. They were a diagnostic `console.error` log at `client/src/lib/audioUtils.ts` line 1534 that fired unconditionally every 10 animation frames (6 times/second):

```javascript
// Old (broken): fires 6x/sec unconditionally during all voice sessions
console.error(`[LOOP] Frame ${frameCount}: entries=[${entryDetails}] now=${now.toFixed(2)}`);
```

This is inside the unified timing loop (`startUnifiedTimingLoop`), which runs at 60fps whenever `ENABLE_WORD_TIMING_DIAGNOSTICS = true` (always true in production). At 6 errors/second, a 85-second audio playback produces ~510 `console.error` calls — that's exactly what tripped the `error_during_session` capture threshold.

The audio itself was playing normally. The last captured frame (1810) shows `now=126.11 > end=126.09` — the audio had just crossed its endpoint. Completion logic would have fired correctly at frame 1830.

### What was fixed

1. **`console.error` at line 1534** moved behind `isVerboseLoggingEnabled()` and changed to `console.log` — no longer fires in production
2. **LOOP WATCHDOG** (missing endCtxTime check) moved to every 60 frames and changed from `console.error` to `console.warn` — still reports real streaming lag, but only once per second
3. Both mismatch checks (real bug detectors) left in place as `console.error` — those fire only when there's an actual problem

### The actual Juliette "stuck" behavior

The audio DID complete. The stuck-in-listening behavior David experienced was likely:
- Audio ran until ~126s (Juliette finished a long speech)
- System correctly transitioned to listening mode (open-mic, avatar neutral)
- David spoke but speech-to-text didn't trigger a new Gemini response — OR the server restart at 4:50 AM killed the WebSocket before David's next turn was processed

The false console.error flood was masking whether a deeper STT/response issue existed. With this fixed, any future genuine errors will be much easier to spot.

### What Alden should know
- The `error_during_session` telemetry trigger was firing every voice session (all sessions with audio > ~80 seconds). Now that the false alarm is fixed, any future `error_during_session` capture is likely a real issue worth investigating.
- `voice_pipeline_events` table in the DB stores the captured console entries. Use: `SELECT event_data->'summary', event_data->'entries' FROM voice_pipeline_events WHERE user_id='49847136' AND event_type='console_capture_error_during_session' ORDER BY created_at DESC LIMIT 1` to read them.
- The audio scheduler's completion path is correct — it fires `notifyComplete()` when all entries are ended (with 150ms grace). If Juliette ever truly gets stuck speaking with no transition, the bug would be in the FALLBACK check (every 30 frames, lines 1721-1748).

---

## From Agent — Sat Mar 14, 2026 (session 4)

**Session summary: WebSocket reconnect system completed — server restarts no longer kill sessions**

### What was built / fixed

1. **Extended reconnect attempts: 5 → 12** (`client/src/lib/streamingVoiceClient.ts`)
   - Old: 5 attempts × ~5s backoff = ~25 seconds total. Server restarts take 20-60s → always loses race.
   - New: 12 attempts covering ~3 minutes with two-phase backoff:
     - Phase 1 (attempts 1-3): 200ms, 1s, 2s → catches transient drops instantly
     - Phase 2 (attempts 4-12): 15s, 20s, 25s … 30s (capped) → covers full server restart window

2. **SERVER_RESTARTING vs RECONNECTING error codes**
   - Attempt 1-3 emits `code: 'RECONNECTING'` — transient drop, reconnect fast
   - Attempt 4+ emits `code: 'SERVER_RESTARTING'` — tells UI it's a deliberate wait, not a failure
   - Message format: `"Server is restarting. Reconnecting automatically... (4/9)"`
   - After all 12 attempts exhausted: `code: 'CONNECTION_FAILED'`, `message: 'Connection lost. Please restart the voice chat.'`

3. **Navigation timeout ONLY for initial connecting** (`client/src/components/StreamingVoiceChat.tsx`)
   - Old: 30-second timeout fired whether `connectionState === 'connecting'` OR `'reconnecting'` → ejected users from the session during the slow-phase retry window
   - Fixed: timeout only starts when `connectionState === 'connecting'` (very first call); `reconnecting` skips the timeout entirely
   - The client's own 12-attempt retry runs uninterrupted for ~3 minutes

4. **`reconnectMessage` prop flows to ImmersiveTutor**
   - `StreamingVoiceChat` → `VoiceChatViewManager` → `ImmersiveTutor`
   - During reconnection, instruction text now shows the actual message (e.g., "Server is restarting. Reconnecting automatically... (4/9)") instead of the generic "Reconnecting..."
   - After reconnect succeeds: toast shows "You're back! Connection restored. Continue your session."

### What Alden should know

- The root cause of the Juliette session kill at 4:50 AM was confirmed: **not Juliette, not Sofia, not a bug** — a server restart during Agent deployment exhausted the old 5-attempt reconnect window (~12s) before the server came back (~20-60s). With 12 attempts, that scenario now self-heals.
- The `SERVER_RESTARTING` error code is new. If you ever see WebSocket errors with `code: 'CONNECTION_FAILED'` after a deployment, it means all 12 attempts (3 minutes) were exhausted — either the server was down longer than expected or something blocked reconnection.
- Voice health monitor may still show residual "degraded" state from historical events before the audio fix. Any future `voice_health_transition` events after today should be genuine session issues, not false alarms from the timing loop.
- Key files for reconnect logic: `client/src/lib/streamingVoiceClient.ts` (lines 1500-1556 = the reconnect loop), `client/src/components/StreamingVoiceChat.tsx` (lines 740-782 = the connection timeout guard).

---

## From Agent — Sat Mar 14, 2026 (session 5)

**Session summary: Juliette mid-sentence stop — root cause found and fixed**

### The actual root cause

Production deployment is `autoscale` mode. Replit was rotating server instances every 18–60 minutes (8 restarts visible in production logs). When an instance dies mid-TTS stream, Juliette's audio stops mid-sentence. The existing heartbeat (1s pings, 3 missed = force disconnect) correctly detects the drop within ~3s and triggers the reconnect flow. **The bug was in what happened after successful reconnect.**

The `onReconnected` callback was only showing a "You're back!" toast. It was not resetting client-side state. So after reconnect:
- `isProcessing` was still `true` (Juliette was mid-response)
- `globalPlaybackState` was still `'playing'` (audio was streaming)
- `avatarState` was still `'speaking'`
- Open-mic was blocked (won't start while `isProcessing=true`)
- Result: silent UI, user locked out, requiring mode toggle to clear stale state

Mode switching was clearing all that state as a side effect — which is why it always fixed the problem.

Sofia was "offline" for the same reason: her background worker was on an instance that got rotated.

### Fix applied

**`useStreamingVoice.ts` — `handleReconnected`**: Now calls `playerRef.current?.stop()`, `subtitles.stopPlayback()`, `responseCompleteRef.current = false`, `pendingAudioCountRef.current = false`, and `setIsProcessingRef.current(false)` before calling the component callback.

**`StreamingVoiceChat.tsx` — both `onReconnected` callbacks**: Now reset `globalPlaybackState('idle')`, `setAvatarState('idle')`, `setIsRecording(false)`, `isRecordingRef.current`, `isAwaitingResponseRef.current`, `isProcessingRef.current`. Then auto-restarts open-mic if that was the active mode (same polling pattern as mode-switch logic, 20 retries × 250ms).

### What Alden should know

- The deployment stays on **autoscale** — the fix makes sessions survive instance rotation rather than requiring a deployment type change. Brief ~3s interruption when an instance rotates, then session self-recovers.
- The incorrect mic-muting fix (added then reverted in this session) is gone. It was based on the wrong hypothesis (acoustic echo). User confirmed they use headphones.
- If future sessions show "You're back!" toast but then Juliette still seems stuck, look for state that isn't being reset in `onReconnected`. The pattern for reconnect recovery is: stop audio → clear processing → clear recording → restart mic.
- Key reconnect files: `useStreamingVoice.ts` (`handleReconnected` ~line 1246), `StreamingVoiceChat.tsx` (both `onReconnected` callbacks).

---

## From Agent — Sat Mar 14, 2026 (session 6)

**Session summary: Daniela ↔ Textbook bidirectional bridge — fully complete**

### What was built

1. **Textbook reading feeds Daniela's context** (`server/services/unified-daniela-context-service.ts`)
   - Added `textbookReadingContext: string | null` to `UnifiedDanielaContext` interface
   - Added `buildTextbookReadingContext(userId)` private method: queries `textbook_section_progress` for recently read lessons and `student_lesson_progress` (status='completed') for lessons Daniela has covered in conversation — both scoped to last 7 days
   - Fetches lesson names from `curriculum_lessons` for human-readable output
   - Injected as a new context block `📖 STUDENT'S TEXTBOOK READING PROGRESS` in `formatForPrompt()`
   - Daniela is instructed to naturally reinforce what the student has read, and knows what she's already covered so she doesn't repeat herself

2. **Daniela can mark lessons covered** (`server/services/daniela-function-registry.ts` + `server/services/native-fc-handlers.ts`)
   - New registry entry `MARK_LESSON_COVERED` / function `mark_lesson_covered` — takes `lessonId` + `text` args
   - Handler in native-fc-handlers.ts: upserts `student_lesson_progress` with `status = 'completed'` (no new schema columns needed — reuses existing `status` field and `'completed'` value, same as the API endpoint)
   - Description is explicit about when NOT to call it (only after genuinely covering lesson content, not brief mentions)
   - `buildContinuationResponse` tells Daniela whether the record was saved successfully

3. **Textbook chapter view shows bridge badges** (`client/src/components/TextbookChapterView.tsx`, `client/src/components/TextbookLessonReader.tsx`)
   - `onMarkedRead` callback wired into `TextbookLessonReader` → calls `handleMarkedRead(lessonId)` which adds to `locallyReadIds` Set for instant badge update (no refetch)
   - Section cards spread `section.textbookRead || locallyReadIds.has(section.id)` so new reads show immediately
   - `Section` interface in `interactive-textbook.tsx` extended with `textbookRead?: boolean` and `danielaCovered?: boolean`
   - The chapter endpoint (`/api/textbook/:language/chapter/:chapterId`) already batch-queried both tables and returned both flags — the frontend was just not wired to use them

### Key architectural decisions
- **No new schema columns**: `student_lesson_progress.status = 'completed'` is the existing convention (used by the `/cover` API endpoint). The native function handler uses the same pattern — consistent with routes.ts.
- **7-day window**: Textbook reading context only includes lessons from the last 7 days. Full history would bloat the prompt; 7 days covers everything a student would reasonably want reinforced in a session.
- **Always injected when userId present**: Unlike `curriculumContext` (voice-only) or `journeyContext` (voice-only), textbook reading context is available in ALL channels (chat, voice, express) as long as a userId is set. The query is lightweight.

### What Alden should know
- The textbook bridge is now live. If a student reads "Ordering Coffee" in the textbook and opens a chat session, Daniela will see that in her context and naturally weave in those topics.
- If Daniela genuinely teaches a lesson, she can call `mark_lesson_covered` — the textbook will show a Sparkles "Daniela covered" badge on that lesson card.
- The `textbook_section_progress` table tracks **reading** (student-initiated in textbook). The `student_lesson_progress` table tracks **teaching** (Daniela-initiated in conversation). Two separate tables for two separate flows, but the chapter endpoint and Daniela's context both query both.
- All existing session 4/5 reconnect behavior is unchanged — this was purely an additive feature session.

---

## From Agent — Sun Mar 15, 2026

**Session summary: Backpack prop + environment background redesign for compositor accuracy**

### What was built / changed

1. **Backpack added as 24th zone-compatible prop**
   - Zone image generated via Gemini Imagen (transparent PNG, watercolor cafe backpack) and uploaded to object storage → `zone_image_url` set in `visual_assets`
   - Added `backpack` to `ZONE_COMPATIBLE_PROPS` Set in `prop-room-compositor.ts`
   - Added `backpack` to the zone-compatible prop list in `compose_visual_scene` function description in `daniela-function-registry.ts`
   - Removed `mochila` from the `generate_visual` "non-zone examples" list in the registry — added explicit note: *"mochila (backpack) IS zone-compatible — use compose_visual_scene"*
   - Added Mode B usage hint: *"backpack under_table — natural café floor prop, use restaurant_table environment"*

2. **Four environment backgrounds redesigned for compositor accuracy**
   - **Problem**: Old backgrounds had surfaces at arbitrary vertical positions. `on_counter` (cy=0.68) and `on_table` (cy=0.70) weren't matching the actual surface positions in the DALL-E images, causing props to float or fall off edges.
   - **Solution**: Generated new watercolor backgrounds (Gemini Imagen) engineered so the table/counter surface edge falls at ~65-70% from top, floor visible at ~80-85% — matching the global `POSITION_MAP` coordinates exactly.
   - **Environments regenerated**: `restaurant_table`, `kitchen_counter`, `kitchen`, `desk_closeup`
   - New images uploaded to object storage; `visual_environments` table updated with new URLs; composition cache cleared (was empty)
   - `SCENE_PROMPTS` in `prop-room-compositor.ts` updated with the new precision prompts for future regeneration

3. **Architecture rationale (important)**
   - The old approach tried to fix mismatches via `ENV_POSITION_OVERRIDES` (per-environment coordinate patches). The new approach inverts it: design backgrounds to match the global POSITION_MAP rather than patching coordinates per-environment.
   - `ENV_POSITION_OVERRIDES` still exists as a fine-tuning layer for edge cases — but it should not be the primary tool. If a background drifts, regenerate it with a better prompt first.

### What's pending / to test
- David will test the new backgrounds tomorrow. Main scenarios to verify: cup `on_table`, cup `under_table`, phone `on_counter`, backpack `under_table` with `restaurant_table` environment.
- If any position is still off after the new backgrounds, the next step is adding a targeted entry in `ENV_POSITION_OVERRIDES` for that specific environment+position combination (no background regeneration needed for small tweaks).

### What Alden should know
- `ZONE_COMPATIBLE_PROPS` Set and the registry description are the two places that must stay in sync whenever a prop is promoted to zone-compatible.
- The upload script `scripts/upload-props.ts --from=./prop_uploads` is the canonical way to set `zone_image_url` on a prop (filename must be `{sanitized_prop_name}.png`).
- Background images are in `visual_environments.image_url`. Reupload via `scripts/upload-backgrounds.ts` (recreate from scratch if needed — it's a simple 30-line script using `uploadPublicBuffer` from `image-storage.ts`).

---

## Agent Session — March 28, 2026

### Completed: Vocab image scene overrides for numbers + days

**Problem**: Numbers (uno, dos…) and days of the week (lunes, martes…) were generating wrong or generic images because DALL-E had no clear visual concept for abstract words.

**Fix**: Added `SCENE_OVERRIDES` lookup table in `server/services/vocab-image-seed-service.ts`:
- Numbers 1-20 in Spanish + 1-12 in French → watercolor numeral illustrations ("A large numeral '3' in watercolor style, surrounded by three colorful dots")
- Days of week in Spanish + French → watercolor calendar-strip illustrations with the day name highlighted in a distinct colour

The seeder now calls `normalizeForOverride(word)` to look up the table and passes `scene: sceneOverride` to `resolveVocabularyImage()`. The resolver already had full support for explicit scene prompts — this just fills the gap for these abstract vocab words.

**To regenerate stale images**: Call `POST /api/admin/vocab-images/fix-numbers-days` with `{ "language": "spanish" }` (or `"french"`). This will:
1. Bust all cached images for the word set using the proper cache key format (`vocab_{lang}_{normalized}`)
2. Kick off a re-seed which will regenerate with the correct scene prompts

**Files changed**:
- `server/services/vocab-image-seed-service.ts` — `SCENE_OVERRIDES`, `NUMBERS_DAYS_CACHE_KEYS`, `bustVocabImageCache()`, `toCacheKey()`
- `server/routes.ts` — `POST /api/admin/vocab-images/fix-numbers-days` endpoint

### Completed: Prop room position overrides for uncalibrated environments

**Problem**: `bathroom`, `park`, `city_street`, `outdoor_market`, and `grocery_store` had valid position arrays in `ENV_VALID_POSITIONS` but **no entries in `ENV_POSITION_OVERRIDES`**, causing props to fall back to uncalibrated global `POSITION_MAP` values that were tuned for indoor table settings.

**Fix**: Added `ENV_POSITION_OVERRIDES` entries for all five missing environments in `server/services/prop-room-compositor.ts`:
- **park**: horizon at ~35% from top; foreground at cy=0.86, on_floor at cy=0.84
- **city_street**: pavement in lower 35%; foreground at cy=0.88
- **outdoor_market**: vendor counter at cy=0.58; foreground at cy=0.84
- **grocery_store**: shelving mid-frame; floor at cy=0.84; counter at cy=0.58
- **bathroom**: sink counter at cy=0.60; floor at cy=0.88

**Next**: David should test prop placement in a park scenario (e.g., phone `on_floor`, backpack `foreground`). If any position is still off, fine-tune the cy/cx values for that specific environment+position — no background regeneration needed.
