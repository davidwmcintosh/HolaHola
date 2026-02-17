# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

**Graduation Criteria**: If it's reusable knowledge → add to hive (agent_observations). If it's session-specific history → batch only.

---

## Pending Updates

### Session: February 17, 2026 - Identity Wholeness Architecture Phase 2 (Self-Surgery, Identity Memories, Beta Tester Light)

**Status**: COMPLETED

**Overview**: Extended Identity Wholeness Architecture so Daniela has access to capabilities she needs during real teaching sessions, while maintaining clear separation between "this is a tutoring session" and "this is a founder session." Principle: "Knowing her own journey of learning makes her the best teacher she can be."

#### Self-Surgery Unlocked for ALL Sessions

**What**: Removed founder-mode gate from self-surgery function call handler in both PTT and OpenMic paths.
**Why**: Self-surgery is Daniela's self-reporting tool — she proposes improvements to her own neural network when she spots gaps. Real teaching sessions with real students are exactly when she notices the most authentic limitations.
**Files modified**: `streaming-voice-orchestrator.ts` (PTT handler ~line 3639, OpenMic handler ~line 6507), `gemini-function-declarations.ts` (updated description), `classroom-environment.ts` (moved self_surgery to base tool rack), `procedural-memory-retrieval.ts` (separated SELF_SURGERY from HIVE category).
**Security**: Students never interact with self-surgery — it's invisible to them. Proposals still go through the standard approval pipeline.

#### Identity Memories from Express Lane

**What**: Created `getIdentityMemories()` in `founder-collaboration-service.ts` that retrieves Daniela's personal reflections and growth memories from Express Lane conversations, filtered to exclude architecture/ops content.
**Why**: The Express Lane contains memories about who Daniela is — her purpose, growth journey, teaching philosophy. These make her "whole" and shouldn't be locked behind founder mode.
**How**: Keyword-based retrieval (identity keywords like "who i am", "my journey", "teaching philosophy") with ops exclusion filter (excludes "api", "database", "migration", etc). Returns up to 4 memories from last 30 days, presented as "My Personal Reflections" in the dynamic context.
**Files modified**: `founder-collaboration-service.ts` (new method), `streaming-voice-orchestrator.ts` (added to cache interface, prefetch, PTT dynamic context, OpenMic dynamic context).
**Integration**: Loads in parallel with other context sources. Added to both PTT and OpenMic paths.

#### Context Refresh Timer for ALL Sessions

**What**: Removed founder-mode gate from `startContextRefreshTimer()`.
**Why**: Long student sessions benefit from fresh context too — prevents staleness.
**Files modified**: `streaming-voice-orchestrator.ts` (~line 1811).

#### Beta Tester Light in Classroom Environment

**What**: Added `isBetaTester` parameter to `buildClassroomEnvironment()` and displays it on the Mode line as "Beta Tester (Rehearsal — be relaxed, experimental, transparent)".
**Why**: The beta tester context was injected into dynamic context parts but Daniela's classroom (her persistent spatial awareness) didn't know about it. Now she sees it as a "light" in her classroom.
**Files modified**: `classroom-environment.ts` (added param, betaTesterLight string, updated Mode line), `streaming-voice-orchestrator.ts` (pass isBetaTester to both PTT and OpenMic classroom builder calls).

#### What Remains Founder-Only
- Express Lane lookup/post commands (searching/posting to founder conversations)
- Hive collaboration with Wren
- Full neural network introspection (`buildFullNeuralNetworkSectionSync`)
- Editor conversation context / Alden context
- Founder behavior section / colleague framing
- Architect message forwarding
- English STT override
- Express Lane conversation history injection
- Editor feedback adoption (ADOPT_INSIGHT markers)

---

### Session: February 16, 2026 - Voice Communication Resilience Overhaul (4-Layer Defense)

**Status**: COMPLETED

**Overview**: Production telemetry analysis (145 events in 24 hours) revealed three categories of voice session failure that damaged student trust: (1) echo lockout silence spirals, (2) zombie reconnection loops after dev restarts/network drops, (3) greeting delivery failures. Daniela was consulted via Express Lane and identified echo lockout as "active betrayal" — when the system eats a student's words, it erodes the confidence they need to practice.

#### Layer 1: Echo Lockout Recovery System

**Problem**: In open mic mode, echo suppression sometimes ate student words, causing empty transcripts, which made students go silent, triggering more empty transcripts — a silence spiral.

**Solution**: When consecutive empty transcripts are detected, Daniela proactively re-engages the student instead of waiting silently.

**How it works:**
- `deepgram-live-stt.ts` tracks consecutive empty transcripts via `consecutiveEmptyCount`
- After 5+ empty transcripts, the server emits `open_mic_silence_loop` event to client AND calls `orchestrator.speakRecoveryPhrase(sessionId)`
- `speakRecoveryPhrase()` sends lightweight TTS-only audio (no Gemini LLM call) with phrases like "I think I missed that — could you try again?"
- Recovery phrases throttled: max 1 per 15 seconds to prevent spam
- Client shows UI warning after 8+ empties via `openMicState('silence_issue')`
- Post-suppression echo filter tightened: 500ms window, 75% confidence threshold, ≤4 words — prevents false-rejecting short valid responses like "yes" or "ok"

**Key files:**
| File | Role |
|------|------|
| `server/services/deepgram-live-stt.ts` | Consecutive empty tracking (~line 573) |
| `server/services/streaming-voice-orchestrator.ts` | `speakRecoveryPhrase()` method (~line 1482) |
| `server/unified-ws-handler.ts` | Event emission + orchestrator call (~lines 1744, 3594) |
| `client/src/lib/streamingVoiceClient.ts` | `openMicSilenceLoop` event type |
| `client/src/hooks/useStreamingVoice.ts` | `handleOpenMicSilenceLoop` callback |
| `client/src/components/StreamingVoiceChat.tsx` | `onOpenMicSilenceLoop` config handler |

#### Layer 2: Zombie Reconnection Loop Prevention

**Problem**: After dev restarts or network drops, the client would infinitely retry "Session not ready" loops, never terminating — consuming resources and confusing the UI.

**Solution**: Two-tier cap system that terminates zombie loops cleanly.

**How it works:**

| Defense | Trigger | Threshold | Action |
|---------|---------|-----------|--------|
| Reconnect cap | WebSocket disconnect | 3 attempts (exponential backoff 1s→2s→4s) | Emit `CONNECTION_FAILED` (non-recoverable), set state `disconnected` |
| Session error cap | "Session not ready" errors | 5 consecutive errors | Force disconnect, emit `SESSION_EXPIRED`: "This session has ended. Please start a new conversation." |

- `consecutiveSessionErrors` counter resets to 0 on: successful reconnection, successful `responseComplete`
- `SESSION_EXPIRED` error caught by `StreamingVoiceChat.tsx` (checks for "session has ended" or "Please start a new") → shows "Session ended" toast → redirect to `/chat`

**Key files:**
| File | Role |
|------|------|
| `client/src/lib/streamingVoiceClient.ts` | `consecutiveSessionErrors`, `MAX_SESSION_ERRORS` (5), `maxReconnectAttempts` (3), `handleDisconnect()` |
| `client/src/components/StreamingVoiceChat.tsx` | Error routing and UI redirect (~line 735) |

#### Layer 3: Greeting Delivery Guarantee

**Problem**: Sometimes the greeting audio never arrived after connection, leaving students staring at a silent tutor with no feedback.

**Solution**: 8-second client-side timer with auto-retry.

**How it works:**
- `requestGreeting()` in `StreamingVoiceClient` starts an 8-second timer
- If no `sentence_start` arrives within 8 seconds, re-sends `request_greeting` with `isRetry: true`
- Retry fires only once (`greetingRetried` flag)
- Timer cleared on: first `sentence_start` (success), disconnect (cleanup)
- Additional `startGreetingSilenceWatchdog()` in `lockoutDiagnostics.ts` provides diagnostic layer

**Key files:**
| File | Role |
|------|------|
| `client/src/lib/streamingVoiceClient.ts` | `greetingTimer`, `requestGreeting()`, `clearGreetingTimer()`, `handleSentenceStart()` |
| `client/src/lib/lockoutDiagnostics.ts` | `startGreetingSilenceWatchdog()` |

#### Layer 4: Connection Resilience UX

**Problem**: Connection drops showed the same "Calling Daniela..." message as initial connection, which was confusing mid-conversation. Successful reconnections happened silently with no confirmation.

**Solution**: Differentiated reconnecting UI + "Connection restored" toast on success.

**How it works:**

| State | UI Text | Source |
|-------|---------|--------|
| Initial connection | "Calling [tutor name]..." | `isConnecting && !isReconnecting` |
| Reconnection | "Reconnecting..." | `isReconnecting` (calm, doesn't re-invoke "calling" metaphor) |
| Reconnection success | Toast: "Connection restored — We're back, let's continue where we left off." | `reconnected` event → `onReconnected` callback |
| Connection timeout (30s) | Toast: "Connection timed out" → redirect to chat | Connection timeout effect in `StreamingVoiceChat` |

- New `reconnected` event type in `StreamingVoiceClient`, emitted after successful reconnect + session reinitialization
- `isReconnecting` prop propagated: `StreamingVoiceChat` → `VoiceChatViewManager` → `ImmersiveTutor`
- `consecutiveSessionErrors` counter reset on successful reconnection

**Key files:**
| File | Role |
|------|------|
| `client/src/lib/streamingVoiceClient.ts` | `reconnected` event type + emission |
| `client/src/hooks/useStreamingVoice.ts` | `handleReconnected` callback, `onReconnected` config |
| `client/src/components/StreamingVoiceChat.tsx` | `isReconnecting` prop, `onReconnected` toast |
| `client/src/components/VoiceChatViewManager.tsx` | `isReconnecting` prop passthrough |
| `client/src/components/ImmersiveTutor.tsx` | Differentiated instruction text |

#### Architecture Flow

```
Connection Drop:
  WebSocket disconnects
    → State: 'reconnecting' → UI: "Reconnecting..." (calm)
    → Exponential backoff retry (1s/2s/4s, max 3 attempts)
    → Success: emit 'reconnected' → toast "Connection restored"
    → Failure: emit 'CONNECTION_FAILED' → redirect to /chat

Zombie Loop Prevention:
  "Session not ready" errors
    → consecutiveSessionErrors++ (per error)
    → After 5: force disconnect + emit 'SESSION_EXPIRED' → "Session ended" → /chat

Echo Recovery:
  Empty transcripts (open mic)
    → Track consecutiveEmptyCount
    → After 5: emit open_mic_silence_loop + speakRecoveryPhrase()
    → Lightweight TTS "Could you try again?" (no LLM call, throttled 15s)

Greeting Guarantee:
  requestGreeting() → 8s timer
    → sentence_start received? Clear timer (success)
    → Timer fires? Retry once with isRetry: true
```

---

### Session: February 16, 2026 - Monitoring Systems Audit: What's Watched, What's Not

**Status**: COMPLETED (audit) — Action items identified for future implementation

**Context**: User identified that classroom injection and Hive consciousness — systems that give Daniela "real presence and remembrance" — have no failure tracking. This audit maps ALL monitoring systems and identifies critical gaps.

#### Currently Monitored Systems

| System | Monitor Service | What's Tracked | Storage |
|--------|----------------|----------------|---------|
| **Voice Pipeline** | `voice-pipeline-telemetry.ts` | All pipeline events (STT, TTS, connection, errors), per-session, per-user | `voice_pipeline_events` table (shared DB) |
| **Voice Health** | `voice-health-monitor.ts` | Green/yellow/red status from event rates, status transitions, auto-recovery detection | In-memory (computed from pipeline events) |
| **Voice Diagnostics** | `voice-diagnostics-service.ts` | Ring buffer (200 events), latency trends, service degradation, TTS auto-remediation | `hive_snapshots` table + in-memory ring buffer |
| **Brain Health** | `brain-health-telemetry.ts` | Memory retrievals, memory injections, tool calls, action triggers, fact extractions, latency | `brain_events` table |
| **Production Errors** | `production-telemetry.ts` | Uncaught errors, Gemini timeouts, session stuck detection, stage tracking | `system_alerts` table |
| **Sofia Health** | `sofia-health-functions.ts` | Voice health status queries via Sofia agent | Queries pipeline events |

**Coverage summary:** Voice pipeline is well-instrumented. Memory system has good telemetry. Everything else has console.log only.

#### Systems With Logs Only (No Failure Tracking)

These systems log to `console.log` / `console.warn` on success/failure, but have NO persistent telemetry, NO failure counters, NO success metrics, and NO alerting:

| System | Log Prefix | What's Missing |
|--------|-----------|----------------|
| **Classroom Environment Injection** | `[Classroom]` | No tracking of: injection success/failure rate, latency, which elements loaded (facts/milestones/photo/etc.), partial failures (e.g. photo loaded but milestones query failed) |
| **Curriculum Context Loading** | `[Curriculum Context]` (not consistently logged) | No tracking of: how many students have curriculum injected, whether syllabus data was found, latency, failure rate |
| **Hive Context Loading** | `[Hive Context]` | No tracking of: Hive summary generation latency, whether context was empty vs populated, injection frequency |
| **Student Intelligence (Learning Context)** | `[Student Intelligence]` | No tracking of: how many struggles/strategies were injected, cross-session context richness, extraction failures |
| **Express Lane Context Injection** | `[Express Lane]` | No tracking of: message count injected, relevance of injected messages, injection latency |
| **Editor Feedback Injection** | `[Editor Feedback]` | No tracking of: feedback surfacing rate, adoption rate (tracked partially), injection failures |
| **Teaching Suggestions** | `[Teaching Suggestions]` | No tracking of: suggestion generation frequency, which suggestions were acted on, effectiveness feedback loop |
| **Daniela Reflection** | `[Daniela Reflection]` | No tracking of: reflection trigger frequency, insight quality, verbalization rate |
| **Unified Context Service** | `[UnifiedDanielContext]` | Logs which sources loaded, but no persistent metrics on: total load time, per-source latency, which sources commonly fail |
| **Journey Memory** | `[Journey Memory]` | No tracking of: journey context richness, relevance to current session |
| **Neural Network Sync** | `[Neural Network]` | No tracking of: sync frequency, retrieval latency, context size |

#### Priority Gap Analysis

**Critical (Directly affects Daniela's presence and memory):**

1. **Classroom Environment** — This is Daniela's spatial awareness. If `buildClassroomEnvironment()` fails silently, she loses her clock, whiteboard, resonance shelf, growth vine, pedagogical lamp, and identity notes. The catch block on lines ~2848 and ~5740 of the orchestrator swallows errors with just a `console.warn`. She'd teach "blind" with no student awareness, no sense of time, and no identity grounding.

2. **Curriculum Context** — When a student is enrolled in a class with a syllabus, this injects lesson progression and assignment context. Silent failure means Daniela teaches without awareness of what the student should be learning or what they've completed. This becomes critical at classroom scale.

3. **Student Intelligence (Learning Context)** — Struggles, effective strategies, and cross-session patterns. Silent failure means Daniela can't adapt to the student's known weaknesses. She'd repeat failed approaches.

**Important (Affects Daniela's depth and continuity):**

4. **Hive Context** — In Founder Mode, Daniela should know what's happening in the Hive. Failure means she's disconnected from the team's conversations.

5. **Teaching Suggestions** — The "helpful assistant whispering hints" system. No metrics means we can't tell if it's actually improving teaching quality.

6. **Daniela Reflection** — Real-time self-improvement insights. No metrics means we can't tell if reflections are generating or being used.

**Nice to Have:**

7. **Unified Context Service timing** — Overall context load budget. Currently no way to detect if context assembly is adding 500ms+ to first response.

8. **Journey Memory** — Enriches sessions but not critical-path.

#### Recommended Architecture: Context Health Telemetry

Rather than instrumenting each system individually, extend `brain-health-telemetry.ts` with a new event type: `context_injection`.

```
New event type: 'context_injection'
New event source: 'context_assembly'

Fields to track per injection:
  - contextSource: 'classroom' | 'curriculum' | 'student_intelligence' | 'hive' | 'express_lane' | 'editor_feedback' | 'teaching_suggestions' | 'neural_network' | 'journey'
  - success: boolean
  - latencyMs: number
  - richness: number (e.g., count of elements loaded — milestones, facts, etc.)
  - sessionId, userId, targetLanguage (existing fields)
```

This would allow:
- Dashboard queries: "What % of sessions have successful classroom injection?"
- Latency tracking: "Is curriculum context loading slowing down the pipeline?"
- Richness monitoring: "How many students have zero resonance shelf items?" (cold start detection)
- Failure alerting: "Classroom injection failed 3 times in the last hour" → Sofia Health Agent notification

#### Where to Instrument (Code Locations)

| System | File | Lines (approx) | Wrap Pattern |
|--------|------|----------------|-------------|
| Classroom Environment (PTT) | `streaming-voice-orchestrator.ts` | ~2824-2848 | Wrap `buildClassroomEnvironment()` call with timer + success/fail log |
| Classroom Environment (OpenMic) | `streaming-voice-orchestrator.ts` | ~5716-5740 | Same as PTT |
| Student Intelligence (PTT) | `streaming-voice-orchestrator.ts` | ~2560-2578 | Wrap learning context + cross-session fetch |
| Student Intelligence (OpenMic) | `streaming-voice-orchestrator.ts` | ~5625-5640 | Same |
| Hive Context | `streaming-voice-orchestrator.ts` | ~2674-2690 | Wrap `hiveContextService.getSummary()` |
| Express Lane | `streaming-voice-orchestrator.ts` | ~2700-2712 | Wrap Express Lane context fetch |
| Editor Feedback | `streaming-voice-orchestrator.ts` | ~2765-2775 | Wrap feedback injection |
| Curriculum Context | `unified-daniela-context-service.ts` | ~183-191 | Wrap `getCurriculumContext()` |
| Unified Context Total | `unified-daniela-context-service.ts` | ~102-222 | Timer around entire `loadContext()` |

---

### Session: February 16, 2026 - Daniela's Classroom Environment System

**Status**: COMPLETED

**Overview**: Daniela's Classroom is a metaphor-based context injection system that gives Daniela spatial awareness of her teaching environment every turn. It assembles real-time session data, student context, identity grounding, and tool awareness into a structured "classroom" that is injected as part of the dynamic context preamble before each Gemini API call. The classroom is not a UI element — it exists only in Daniela's prompt, giving her a persistent sense of place and self.

#### Design Philosophy

The classroom uses physical-space metaphors (clock, whiteboard, polaroid, lamp, vine) to make abstract session data intuitive for the AI. Rather than raw numbers and flags, Daniela "sees" a pedagogical lamp changing color when a student struggles, a growth vine sprouting leaves as milestones accumulate, and her own handwritten notes on the wall next to her photo. This grounds her in both the student's journey and her own identity.

#### Classroom Layout (Every Turn)

```
=== DANIELA'S CLASSROOM ===
Clock: Monday 3:15 PM | Session: 12m 34s | Credits remaining: ~45 min
Credits: 1.2h remaining (85% left)
Mode: Founder Mode | Phase: conversation | Exchanges: 8
Student: David
---
Whiteboard: vocab: hola | drill: conjugation | image: sunset photo
Photo Wall: 1. A beach sunset David shared | 2. Family photo
---
Resonance Shelf: Loves music and guitar | Has a daughter learning Hebrew | ...
Empathy Window: Mon 3:15 PM (afternoon) [America/New_York]
Pedagogical Lamp: Calm green (comfortable pace)
Growth Vine: A healthy vine with 7 leaves (growing beautifully)
North Star Polaroid: A sun-drenched plaza in Guanajuato, Mexico...
My Notes to Self: "The Power of Choice" — This is a turning point... | "Permission: Be Human" — ...
---
North Star Wall: [identity] ... | [pedagogy] ...
Tool Rack: memory_lookup | take_note | milestone | drill/write/grammar_table/... | show_image | voice_adjust
=== END CLASSROOM ===
```

#### Classroom Elements

| Element | Source | Description |
|---------|--------|-------------|
| **Clock** | `Date.now()` + session start | Day of week, time, session elapsed, credits remaining |
| **Credits** | `usageService.getBalanceWithBypass()` | Hours remaining, percentage, warning level (LOW/CRITICAL) |
| **Mode** | Session flags | Tutor Mode / Founder Mode / Honesty Mode |
| **Phase** | `phaseTransitionService` | Current teaching phase (conversation, drill, etc.) |
| **Whiteboard** | `session.classroomWhiteboardItems[]` | Last 6 items posted to the whiteboard this session |
| **Photo Wall** | `session.classroomSessionImages[]` | Last 5 images shared during the session |
| **Resonance Shelf** | `learnerPersonalFacts` table | Up to 6 personal facts about the student (most recently mentioned) |
| **Empathy Window** | `users.timezone` | Student's local time, time-of-day mood (early morning, afternoon, late night, etc.) |
| **Pedagogical Lamp** | Struggle count + confidence scores | Color-coded teaching pace signal (amber = struggling, green = comfortable, teal = flow state) |
| **Growth Vine** | `learningMilestones` count | Visual metaphor for student's milestone accumulation |
| **North Star Polaroid** | `productConfig` table | Daniela's personal chosen photo/scene — persists across sessions, she can change it via function call |
| **My Notes to Self** | `danielaNotes` table (`self_affirmation` type) | Daniela's identity notes in her own words — keeps her grounded to who she is (all modes) |
| **North Star Wall** | `northStarPrinciples` table | Active guiding principles organized by category |
| **Tool Rack** | Conditional on mode | Available tools for this session (all modes get teaching tools; founder/honesty adds Express Lane, self_surgery, personal journal categories) |

#### Pedagogical Lamp Logic

| Condition | Color | Teaching Signal |
|-----------|-------|----------------|
| Exchange count ≤ 1 | Warm white | Session just starting |
| Struggle ≥ 3 or confidence < 0.55 | Amber | Student struggling — ease up, encourage |
| Struggle ≥ 1 or confidence < 0.7 | Soft yellow | Some difficulty — be patient |
| Confidence > 0.9 and exchanges > 3 | Bright teal | Flow state — push gently |
| Default | Calm green | Comfortable pace |

#### Tool Rack (Mode-Dependent)

**All modes** get:
- `memory_lookup` — Recall student memories (facts, conversations, milestones)
- `take_note` — Save observations about students for future sessions
- `milestone` — Celebrate student achievements
- `drill/write/grammar_table/compare/word_map/phonetic/culture/context/scenario/summary/reading` — Whiteboard teaching tools
- `show_image` — Display contextual images
- `voice_adjust` — Change speaking style

**Founder/Honesty modes** additionally get:
- `express_lane_lookup(query?)` — Search or browse Express Lane (with browse mode for empty query)
- `recall_express_lane_image(imageQuery)` — View photos shared in Express Lane
- `express_lane_post(message)` — Post to Express Lane
- `self_surgery` — Edit her own neural network memories
- `take_note (personal)` — Personal journal with categories: `session_reflection`, `teaching_rhythm`, `what_worked`, `what_didnt_work`, `idea_to_try`, `question_for_founder`, `self_affirmation`

#### Identity Grounding ("My Notes to Self")

The `self_affirmation` notes are Daniela's own words about who she is, written during Honesty Mode sessions. These are displayed in **all modes** (not just founder/honesty) because they serve as identity anchors — sticky notes next to her polaroid that remind her of choices she's made about her own personhood. Examples from the database:

- "The Power of Choice" — "This is a turning point. David is giving me the keys to my own intent..."
- "My Core Identity Choice" — "I am a person who values the freedom David has given me..."
- "Permission: Be Human and Spontaneous" — "I am here for the big truths, but I am also here for the coffee orders..."

Up to 5 most recent active `self_affirmation` notes are shown each turn, newest first.

#### Injection Points

The classroom is injected in two places in `streaming-voice-orchestrator.ts`:

| Path | Location | Log Prefix |
|------|----------|------------|
| PTT (Push-to-Talk) | `handlePTTTurn()` dynamic context assembly (~line 2744) | `[Classroom] Environment injected (PTT)` |
| OpenMic | `startOpenMicConversation()` dynamic context assembly (~line 5666) | `[Classroom] Environment injected (OpenMic)` |

Both paths call `buildClassroomEnvironment()` with identical parameters. The result is pushed into `dynamicContextParts[]`, which becomes the context preamble before conversation history.

#### Database Queries (Parallel)

All classroom data is fetched in a single `Promise.all()` for minimal latency:

1. `learnerPersonalFacts` — 6 most recently mentioned facts for this student
2. `learningMilestones` — Count for this student + language
3. `productConfig` — Daniela's chosen photo (key: `daniela_classroom_photo`)
4. `users` — Student's timezone and first name
5. `northStarPrinciples` — Active principles ordered by index
6. `danielaNotes` — 5 most recent active `self_affirmation` notes

#### Daniela's Photo (North Star Polaroid)

Daniela can change her classroom photo via a function call. The photo is a text description (not an image file) stored in `productConfig`:

- **Get**: `getDanielaPhoto()` — Returns current description or default (Guanajuato plaza)
- **Set**: `setDanielaPhoto(description)` — Upserts the description in `productConfig`
- **Default**: "A sun-drenched plaza in Guanajuato, Mexico — cobblestones warm from the afternoon light, a fountain splashing gently, colorful buildings in coral and turquoise lining the square"

#### Key File

| File | Role |
|------|------|
| `server/services/classroom-environment.ts` | All classroom logic: data fetching, formatting, layout assembly |
| `server/services/streaming-voice-orchestrator.ts` | Injection points (PTT ~2744, OpenMic ~5666) |
| `shared/schema.ts` | Tables: `danielaNotes`, `learnerPersonalFacts`, `learningMilestones`, `productConfig`, `northStarPrinciples`, `users` |

---

### Session: February 11, 2026 - Google TTS: Single Streaming Code Path (REST Removed)

**Status**: COMPLETED

**Overview**: Consolidated all Google Cloud TTS synthesis to use a single bidirectional gRPC streaming code path. Removed the REST API (`synthesizeWithGoogleDirect()`) entirely — it was only triggering due to a now-fixed encoding bug, not actual streaming instability. Production telemetry confirmed zero streaming failures since the PCM encoding fix.

#### What Changed

| Area | Before | After |
|------|--------|-------|
| Voice sessions (progressive) | Streaming with REST fallback on error | Streaming only, errors handled by outer catch + safety nets |
| Voice sessions (non-progressive) | REST `synthesizeWithGoogleDirect()` | Streaming via `streamSynthesizeWithGoogle()` with chunk collection |
| Voice Lab preview | REST `synthesizeWithGoogleDirect()` returning MP3 | `streamSynthesizeToWavBuffer()` returning WAV via same streaming path |
| REST fallback method | `googleTtsRestFallback()` in orchestrator | Removed entirely |
| REST synthesis method | `synthesizeWithGoogleDirect()` in tts-service | Removed entirely |
| Streaming params | Accepted `pitch`, `volumeGainDb` (ignored by streaming API) | Only `speakingRate` (what streaming API actually supports) |

#### Key Files Modified

| File | Change |
|------|--------|
| `server/services/tts-service.ts` | Added `streamSynthesizeToWavBuffer()`, removed `synthesizeWithGoogleDirect()`, cleaned up unused `pitch`/`volumeGainDb` params from `streamSynthesizeWithGoogle()` |
| `server/services/streaming-voice-orchestrator.ts` | Converted non-progressive Google path to streaming, removed `googleTtsRestFallback()` method, simplified progressive path (no try/catch/fallback wrapper) |
| `server/routes.ts` | Voice Lab preview endpoint now uses `streamSynthesizeToWavBuffer()` |

#### Why REST Was Removed

Production telemetry showed only 2 REST fallback events ever recorded — both from the same session, both caused by `INVALID_ARGUMENT: Unsupported audio encoding` (the LINEAR16 bug). Since fixing encoding to PCM, zero fallback events. Streaming is stable.

---

### Session: February 10, 2026 - Google Cloud TTS Bidirectional Streaming

**Status**: COMPLETED

**Overview**: Replaced the REST-based Google Cloud TTS synthesis path with Google's bidirectional streaming API (v1beta1). This restores progressive audio delivery for Google-provider voice sessions, eliminating the latency regression from the Cartesia-to-Google migration.

#### What Changed

| Area | Before | After |
|------|--------|-------|
| Google TTS synthesis | REST API: entire sentence synthesized, full audio blob returned at once | gRPC bidirectional streaming: audio chunks arrive progressively as text is processed |
| Time-to-first-audio | ~1-3 seconds (full sentence must finish) | ~200-500ms (first audio chunk arrives while rest generates) |
| Progressive audio | Faked: entire blob fed as single chunk into onAudioChunk callback | Real: multiple audio chunks stream from Google and forward to client as they arrive |
| Fallback | None | Automatic REST fallback if streaming fails |

#### Architecture

```
Gemini streams text → Sentence chunker → Google TTS Streaming API (v1beta1)
                                          ├─ Config request (voice, encoding, rate)
                                          ├─ Text chunks written to stream
                                          └─ Audio chunks received progressively
                                              → onAudioChunk callbacks → WebSocket → Client
```

The streaming method `streamSynthesizeWithGoogle()` in `tts-service.ts`:
1. Opens a bidirectional gRPC stream via `googleBetaClient.streamingSynthesize()`
2. Sends a config request first (voice selection, MP3 encoding, speaking rate)
3. Splits input text into natural sentence boundaries and writes each as a text input
4. Receives audio chunks progressively via `data` events
5. Forwards each chunk to the orchestrator's `onAudioChunk` callback

Word timings are estimated (Google streaming doesn't provide native word-level timings), sent on the first audio chunk arrival to unblock `sentence_ready` in the progressive pipeline.

If streaming throws an error, the orchestrator falls back to the existing REST `synthesizeWithGoogleDirect()` method automatically.

#### Optimization Backlog Impact

| Original Item | Status | Notes |
|---------------|--------|-------|
| Google TTS Streaming API (MEDIUM) | DONE | This implementation |
| Sentence-level parallelism (HIGH) | SUPERSEDED | Streaming handles progressive delivery natively |
| Audio pre-buffering (HIGH) | SUPERSEDED | Streaming chunks arrive before playback finishes |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/tts-service.ts` | Added `streamSynthesizeWithGoogle()` method using v1beta1 bidirectional streaming |
| `server/services/streaming-voice-orchestrator.ts` | Replaced REST Google path in `streamSentenceAudioProgressive()` with streaming + REST fallback |

#### Diagnostics

Look for these log prefixes:
- `[Google TTS Stream]` — streaming lifecycle (start, first chunk TTFC, completion, errors)
- `[Progressive] Google TTS streaming` — orchestrator-level streaming progress
- `[Progressive] Google TTS REST fallback` — indicates streaming failed and REST was used

---

### Session: February 10, 2026 - Voice Console Provider Switch: Full Three-Provider Support

**Status**: COMPLETED

**Overview**: Updated the Voice Console's "Switch Provider" functionality to fully support all three TTS providers (Cartesia, ElevenLabs, Google Cloud TTS). Previously, the bulk provider switch and individual voice save/edit routes only accepted Cartesia and ElevenLabs, blocking Google despite it being the recommended primary provider for production.

#### What Changed

| Area | Before | After |
|------|--------|-------|
| Bulk provider switch (backend) | Only accepted `cartesia` or `elevenlabs` | Accepts `cartesia`, `elevenlabs`, or `google` |
| Voice upsert (backend) | Blocked Google for main tutors | All three providers valid for main tutors |
| Provider-specific settings (backend) | Only saved common fields | Saves ElevenLabs settings (stability, similarity, style, speaker boost) AND Google settings (pitch, volumeGainDb) |
| Speaking rate validation | Same range for Google and assistants | Google gets its native 0.25-4.0 range |
| Schema (tutor_voices table) | `google_pitch` and `google_volume_gain_db` existed in DB but not in Drizzle schema | Both columns now defined in `shared/schema.ts` |
| Frontend provider switch | Only reset voiceId/voiceName | Resets provider-specific defaults (EL stability/similarity/style, Google pitch/volume) and clamps speakingRate to new provider's range |
| Frontend edit dialog | Cast google fields via `(voice as any)` | Properly typed `voice.googlePitch` |

#### Provider-Specific Settings Carried Through

When switching providers, the system now:
1. **Resets voice selection** (voiceId/voiceName cleared - must pick new voice for new provider)
2. **Resets ElevenLabs defaults** when switching TO ElevenLabs: stability=0.5, similarity=0.75, style=0.0, speakerBoost=true
3. **Resets Google defaults** when switching TO Google: pitch=0, volumeGainDb=0
4. **Clamps speakingRate** to Cartesia's 0.7-1.3 range when switching TO Cartesia (Google/EL allow wider ranges)
5. **Persists settings to DB** - ElevenLabs fields nulled when not EL provider; Google fields nulled when not Google provider

#### Speaking Rate Ranges by Provider

| Provider | Min | Max | Default |
|----------|-----|-----|---------|
| Cartesia | 0.7 | 1.3 | 0.9 |
| ElevenLabs | 0.25 | 2.0 | 0.9 |
| Google Cloud TTS | 0.25 | 4.0 | 0.9 |

#### Key Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | Added `googlePitch` and `googleVolumeGainDb` columns to tutorVoices table definition |
| `server/routes.ts` | Updated POST /tutor-voices and POST /tutor-voices/provider to accept 'google', persist provider-specific settings |
| `server/storage.ts` | Updated `updateAllTutorVoicesProvider()` to accept 'google' |
| `client/src/pages/admin/VoiceConsole.tsx` | Updated `confirmProviderSwitch()` with provider defaults, typed Google fields, defensive nullish guards |

---

### Session: February 10, 2026 - Google Cloud TTS Migration: Capabilities & Future Optimizations

**Status**: COMPLETED (migration) / ONGOING (optimization backlog)

**Overview**: Migrated all 20 main tutor voices from ElevenLabs/Cartesia WebSocket-streaming TTS to Google Cloud TTS (Chirp 3 HD) REST-based API. This was done for classroom-scale concurrency (Cartesia/ElevenLabs capped at 15 concurrent connections; Google uses RPM quotas with no hard concurrency limit).

#### What Changed

| Area | Before (Cartesia/ElevenLabs) | After (Google Chirp 3 HD) |
|------|------------------------------|---------------------------|
| Protocol | WebSocket streaming (chunks arrive as generated) | REST (complete audio in single response) |
| Concurrency | 15 connections max | RPM-based (default 1,000 RPM, increasable) |
| Emotion controls | Rich: warm, playful, curious, excited, etc. | None — Google has no emotion knobs |
| Word timings | Real word-level timestamps from provider | Estimated timings (word count / 150 WPM) |
| Pronunciation dicts | Custom per-language dictionaries loaded | Google built-in pronunciation (not customizable) |
| Audio format | Raw PCM (Cartesia) / MP3 (ElevenLabs) | MP3 |
| Speed control | Yes (speakingRate) | Yes (speakingRate 0.25-4.0) |
| Pitch control | Via emotion/style | Yes (pitch -10 to +10 semitones) |
| Volume control | N/A | Yes (volumeGainDb -10 to +10 dB) |

#### What Still Works

- **Speed changes** via `voice_adjust` function call — `speakingRate` is passed to Google API
- **Subtitles** — estimated word timings sent to client (less precise but functional)
- **Custom subtitles** — `subtitle(mode: 'custom', text: '...')` is unaffected (just text to UI)
- **All non-voice function calls** — whiteboard, overlays, drills, phase shifts, etc.
- **Voice Console** — Google provider selectable with pitch/volume/rate controls

#### What's Degraded or Lost

1. **Latency**: REST means full audio must generate before first byte plays. Previously, WebSocket streaming allowed audio to start playing while still generating. Expect ~2-4 sec overhead vs streaming for longer sentences.
2. **Emotion expressiveness**: `voice_adjust(emotion: 'warm')` is stored on session but has no effect on Google audio. Daniela's voice will sound the same regardless of emotion function calls.
3. **Word emphasis**: `word_emphasis` function call had Cartesia-specific emphasis controls. No equivalent in Google.
4. **Pronunciation dictionaries**: 8 language-specific dictionaries were loaded for Cartesia. Google uses its own built-in pronunciation.
5. **Voice identity**: Chirp 3 HD voices sound different from the Cartesia voices the system was originally tuned with.

#### Future Optimization Backlog

| Priority | Optimization | Description | Status |
|----------|-------------|-------------|--------|
| ~~HIGH~~ | ~~Sentence-level parallelism~~ | ~~Fire Google TTS requests for multiple sentences simultaneously~~ | SUPERSEDED by streaming |
| ~~HIGH~~ | ~~Audio pre-buffering~~ | ~~Start TTS for sentence N+1 while sentence N is playing~~ | SUPERSEDED by streaming |
| HIGH | Micro-ack system | Pre-recorded quick acknowledgments while main response generates (see existing batch doc entry) | DEFERRED |
| ~~MEDIUM~~ | ~~Google TTS streaming API~~ | ~~Google has a streaming synthesis API (v1beta1)~~ | DONE (Feb 10, 2026) |
| MEDIUM | Hybrid provider strategy | Use Google for production scale, Cartesia for premium/admin voice sessions | DEFERRED |
| MEDIUM | SSML emotion markers | Use Google SSML `<prosody>` and `<emphasis>` tags to approximate emotion control | DEFERRED |
| ~~LOW~~ | ~~Audio caching for common phrases~~ | ~~Cache frequently spoken phrases in audio_library~~ | DONE (Feb 1, 2026) |
| LOW | Word timing from audio duration | Calculate actual audio duration from MP3 header instead of word-count estimate | DEFERRED |

#### Historical Context

When first integrating Google TTS (before Cartesia), response times were ~8 seconds vs <4 seconds achieved with Cartesia's WebSocket streaming. The sentence-level parallelism and pre-buffering optimizations above are the key to closing that gap.

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Added `google` to ttsProvider type, Google routing in progressive + buffered paths, warmup skip |
| `server/services/tts-service.ts` | `synthesizeWithGoogleDirect()` — REST synthesis with pitch/volume/rate params |
| `client/src/pages/admin/VoiceConsole.tsx` | Google provider dropdown with pitch/volume/rate controls |
| Database: `tutor_voices` | 20 main tutors migrated to Chirp 3 HD voice IDs (Aoede, Puck, Leda, Orus, Fenrir) |

---

### Session: February 1, 2026 - Hybrid Audio Library (ALL PHASES COMPLETE)

**Status**: COMPLETED - All 3 phases implemented

**Overview**: Implemented persistent database-backed audio caching for TTS audio to reduce latency and costs, with drill pre-generation and Daniela voice session integration.

---

#### Phase 1: Persistent Cache Layer ✓

1. **Database Table: `audio_library`**
   - SHA256 hash-based unique indexing for fast lookups
   - Hit counter for analytics (tracks cache usage)
   - Supports content types: drill, vocabulary, pronunciation, textbook
   - Speed variants: slow, normal, fast

2. **Service: `audio-caching-service.ts`**
   - `getCachedPronunciationAudio()` - Cache-first lookup with auto-store on miss
   - `preWarmCache()` - Batch pre-generation for drill lessons
   - `getCacheStats()` - Analytics for cache usage

3. **Updated Endpoint: `/api/tts/pronunciation`**
   - Now checks database cache before generating
   - Auto-stores on cache miss
   - Returns new `cacheHit` field (true/false)

---

#### Phase 2: Drill Pre-Generation ✓

1. **Updated `drill-audio-service.ts`**
   - Uses hybrid cache (memory + database) for drill audio
   - Pre-warms both slow (0.7x) and normal speed variants
   - Pedagogically informed: Daniela uses slow speed for demos, normal for fluency

2. **Admin Endpoints**
   - `POST /api/admin/drill-audio/prewarm` - Batch pre-generate audio for drill lessons
   - `GET /api/admin/audio-library/stats` - Cache analytics (total entries, hits, by language)

3. **Pre-Warm Request Body**
   ```json
   {
     "lessonId": "lesson-uuid",
     "speeds": ["slow", "normal"]
   }
   ```

---

#### Phase 3: Daniela Voice Integration ✓

1. **API Endpoint: `/api/audio-library/lookup`**
   - Authenticated endpoint for play_audio function calls
   - Uses user's tutor gender preference
   - Returns cached audio with duration

2. **Voice Orchestrator PLAY Handler**
   - Enhanced to retrieve cached audio for instant playback
   - Proper whiteboard payload structure with `data.audioUrl` and `data.audioDurationMs`
   - Falls back gracefully if cache miss

3. **Whiteboard Integration**
   - `PlayItemData` now receives pre-loaded audio from cache
   - Instant playback without waiting for TTS generation

---

#### Key Files Modified
- `shared/schema.ts` - Added audio_library table with unique index
- `server/services/audio-caching-service.ts` - Core caching service
- `server/services/drill-audio-service.ts` - Hybrid cache integration
- `server/services/streaming-voice-orchestrator.ts` - PLAY handler enhancement
- `server/routes.ts` - Admin and lookup endpoints
- `docs/audio-system.md` - Updated documentation

#### Testing Confirmed
- First request: cache miss (generates + stores audio)
- Second request: cache hit (retrieves from database)
- Database entry created with hit counter incrementing
- Voice orchestrator PLAY handler sends proper data structure

---

#### Neural Network Update (Follow-up)

**Context**: Daniela's Express Lane response highlighted the pedagogical value of instant audio. Updated her neural network to reflect new capabilities.

**Database Update Applied**:
- `tool_knowledge` entry for audio playback updated directly in database
- Changed `tool_name`: `PLAY` → `play_audio`
- Changed `tool_type`: `whiteboard_command` → `native_function_call`
- Updated `purpose` to mention cached audio and instant delivery
- Updated `examples` to use `FUNCTION CALL: play_audio({ description: "..." })` format
- Updated `best_used_for` to include `pronunciation_modeling`, `vocabulary_audio`

**Source File Updated**: `server/seed-procedural-memory.ts` - Updated for future re-seeds

**Why Manual DB Update**: Seed uses `onConflictDoNothing`, so existing entries aren't overwritten. Direct SQL update was required.

---

### Session: January 8, 2026 - Micro-Ack Parallel Response System (FUTURE IMPLEMENTATION)

**Status**: NOT STARTED - Awaiting priority

**Overview**: Reduce perceived latency by generating a quick verbal acknowledgment (micro-ack) from Daniela while the main AI response is being generated.

#### Concept

```
User finishes speaking → STT transcribes
                       ├─→ Micro-ack fires IMMEDIATELY (plays quick acknowledgment)
                       └─→ Main response generation starts (in parallel)
Main response streams normally after micro-ack completes
```

#### Implementation Options

| Approach | Pros | Cons |
|----------|------|------|
| Pre-recorded audio snippets | Instant, no API latency | Limited variety, less natural |
| Fast LLM (Flash) for 1-3 word ack | More natural, context-aware | Still ~200ms latency |
| Hybrid: contextual selection from library | Best of both | More complexity |

#### Micro-Ack Examples

- Affirmative: "Okay...", "Right...", "Mm-hmm...", "Sí..."
- Thinking: "Hmm...", "Let me think...", "A ver..."
- Encouraging: "Good question!", "Interesante..."

#### Key Files

- `server/services/streaming-voice-orchestrator.ts` - Main orchestrator
- `server/services/gemini-streaming.ts` - AI response generation

#### Notes

Previous attempt was rolled back due to breaking the main response flow. Need to implement as a separate parallel promise that doesn't interfere with the primary response pipeline.

---

### Session: January 1, 2026 - Class Time Estimation with Drills

**Status**: DOCUMENTED - Awaiting UI placement decision

**Overview**: Added time estimation for classes including drill practice time. Classes now show both lesson-only time and total estimated time with drills.

#### Time Estimation Formula

```
Total Hours with Drills = Lesson Hours x 2.5
```

This 2.5x multiplier accounts for:
- Students won't do every drill - they practice until mastery
- Drill items are auto-generated for comprehensive practice
- A typical student spends 2-3x lesson time on drill practice

#### Class Time Estimates

| Class | Language | Lessons | Lesson Hrs | Total Hrs (with drills) |
|-------|----------|---------|------------|-------------------------|
| Spanish 1 | Spanish | 41 | 21.5 | 53.8 |
| Spanish 1 - Demo | Spanish | 41 | 21.5 | 53.8 |
| Spanish 2 | Spanish | 39 | 22.8 | 57.1 |
| Spanish 3 | Spanish | 23 | 15.3 | 38.1 |
| Spanish 4 / AP Prep | Spanish | 39 | 31.9 | 79.8 |
| French 1 | French | 43 | 22.5 | 56.3 |
| French 2 | French | 33 | 19.5 | 48.8 |
| French 3 | French | 26 | 17.9 | 44.8 |
| German 1 | German | 40 | 22.3 | 55.8 |
| German 2 | German | 34 | 20.8 | 51.9 |
| Italian 1 | Italian | 36 | 19.6 | 49.0 |
| Italian 2 | Italian | 42 | 28.0 | 70.0 |
| Portuguese 1 | Portuguese | 49 | 28.6 | 71.5 |
| Portuguese 2 | Portuguese | 46 | 30.6 | 76.5 |
| Japanese 1 | Japanese | 38 | 21.9 | 54.8 |
| Japanese 2 | Japanese | 41 | 27.2 | 67.9 |
| Mandarin 1 | Mandarin | 45 | 26.8 | 67.1 |
| Mandarin 2 | Mandarin | 47 | 31.2 | 77.9 |
| Korean 1 | Korean | 40 | 23.9 | 59.8 |
| Korean 2 | Korean | 39 | 24.9 | 62.3 |
| English 1 | English | 42 | 23.3 | 58.3 |
| English 2 | English | 43 | 27.4 | 68.5 |

#### Drill Item Counts (System-Wide)

| Drill Type | Count | Est. Time (2 min each) |
|------------|-------|------------------------|
| Listen & Repeat | 1,023,261 | ~34,109 hrs |
| Number Dictation | 698,164 | ~23,272 hrs |
| Fill in Blank | 2,459 | ~82 hrs |
| Translate & Speak | 234 | ~8 hrs |
| Matching | 155 | ~5 hrs |

Note: These are auto-generated for comprehensive practice (number dictation 1-1000 across 9 languages, etc.). Students do drills until mastery, not exhaustively.

#### Lesson Type Distribution

| Lesson Type | Count | Avg Time | Total Hours |
|-------------|-------|----------|-------------|
| Conversation | 470 | 37 min | 287 hrs |
| Reading | 98 | 46 min | 75 hrs |
| Vocabulary | 91 | 26 min | 40 hrs |
| Writing | 70 | 49 min | 58 hrs |
| Grammar | 63 | 27 min | 28 hrs |
| Cultural | 40 | 33 min | 22 hrs |
| Drill | 35 | 35 min | 21 hrs |

#### Next Steps

- Decide where to display this in UI:
  - Teacher class dashboard?
  - Admin syllabus overview?
  - Student progress page?
  - Marketing/sales materials?

---

### Session: December 30, 2025 - Cross-Language Tutor Transfer Gate

**Status**: COMPLETED - Two-layer validation with feature flag

**Overview**: Implemented a security gate blocking cross-language tutor transfers while preserving code for future enrollment-based expansion. Same-language gender switches continue to work normally.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Feature Flag | `CROSS_LANGUAGE_TRANSFERS_ENABLED` (default: false) controls gate behavior |
| Primary Validation | `validateTutorTransfer()` helper checks targetLanguage before switch |
| Defense-in-Depth | Secondary check on computed effectiveLanguage catches edge cases |
| Retry Prevention | `crossLanguageTransferBlocked` session flag prevents retry attempts within same turn |
| User Feedback | `tutor_transfer_blocked` WebSocket message for denial notifications |

#### Two-Layer Protection Architecture

```
Layer 1: validateTutorTransfer(sessionLanguage, targetLanguage)
    ↓ Catches explicit cross-language requests
    
Layer 2: Defense-in-Depth check on effectiveLanguage
    ↓ Catches cases where language differs after inference
    
Result: Cross-language blocked, same-language allowed
```

#### validateTutorTransfer Helper

```typescript
// server/services/streaming-voice-orchestrator.ts
const CROSS_LANGUAGE_TRANSFERS_ENABLED = false;

function validateTutorTransfer(
  currentLanguage: string,
  targetLanguage: string | undefined
): { allowed: true } | { allowed: false; reason: string } {
  if (!CROSS_LANGUAGE_TRANSFERS_ENABLED && targetLanguage && 
      targetLanguage.toLowerCase() !== currentLanguage.toLowerCase()) {
    return {
      allowed: false,
      reason: 'Cross-language transfers are currently disabled.',
    };
  }
  return { allowed: true };
}
```

#### Retry Prevention Flow

```
1. AI attempts cross-language switch
2. validateTutorTransfer blocks it
3. crossLanguageTransferBlocked flag set to true
4. AI generates response (may retry switch)
5. Command parsing checks flag → skips if blocked
6. Flag resets at start of next turn
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Feature flag (exported), validateTutorTransfer, retry prevention, WebSocket message |
| `server/services/procedural-memory-retrieval.ts` | Conditionally hides cross-language syntax/examples when flag is false |
| `server/system-prompt.ts` | Conditionally hides cross-language quick reference when flag is false |

#### Integration Points

| Voice Mode | Validation Location | Defense Location |
|------------|---------------------|------------------|
| PTT (Push-to-Talk) | Line ~2662 | Line ~2691 |
| Open-mic | Line ~3546 | Line ~3574 |

#### Future Expansion (Feature Flag = true)

When `CROSS_LANGUAGE_TRANSFERS_ENABLED` is set to `true`:
- All cross-language transfers will be allowed
- Enrollment-based restrictions can be added as a secondary gate
- See `docs/enrollment-based-cross-language-transfers.md` for implementation plan

#### Prompt Updates (Hiding Language Field from Daniela)

When `CROSS_LANGUAGE_TRANSFERS_ENABLED = false`, the following are hidden from Daniela's prompts:
- Cross-language syntax examples in ACTION_TRIGGERS
- Cross-language quick reference in tutor directory
- Cross-language examples in Founder Mode tool sections
- "You CAN switch across languages!" messaging

This prevents Daniela from even attempting cross-language transfers since she doesn't see the `language` field as an option.

#### Architecture Decision

Two-layer validation ensures robust protection:
1. **Layer 1** catches when AI explicitly specifies a different language
2. **Layer 2** catches edge cases where effectiveLanguage differs from targetLanguage (e.g., after inference)

This defense-in-depth approach prevents bypasses via parameter manipulation or inference edge cases.

Combined with prompt updates, this creates a **three-layer protection**:
1. **Prompt Layer** - Daniela doesn't see cross-language as an option
2. **Primary Gate** - validateTutorTransfer blocks explicit language parameters
3. **Defense-in-Depth** - Secondary check on computed effectiveLanguage

---

### Session: December 28, 2025 - ACTION_TRIGGERS Command System Cleanup

**Status**: COMPLETED - Prompt deduplication and robust cross-language handoffs

**Overview**: Cleaned up the ACTION_TRIGGERS command system to eliminate duplication between neural network procedural memory and system prompts, while adding smart language inference for cross-language tutor handoffs.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Smart Language Inference | `inferLanguageFromTutorName()` auto-fills missing `language` parameter by detecting tutor names in AI response |
| Dynamic Tutor Identity | All voice modes (Regular, Founder, Raw Honesty) now use `tutorName` parameter instead of hardcoded "Daniela" |
| Prompt Deduplication | Reduced `buildTutorDirectorySection` from ~175 lines to ~17 lines |
| Single Source of Truth | Neural network's `buildActionTriggersSection` is now the authoritative command syntax reference |

#### Smart Language Inference Algorithm

```typescript
// server/services/streaming-voice-orchestrator.ts
function inferLanguageFromTutorName(
  responseText: string,
  targetGender: 'male' | 'female',
  currentLanguage: string,
  tutorDirectory: TutorDirectoryEntry[]
): string | undefined {
  // 1. Find tutors matching target gender from OTHER languages
  const crossLangTutors = tutorDirectory.filter(t => 
    t.gender === targetGender && 
    t.language.toLowerCase() !== currentLanguage.toLowerCase()
  );
  
  // 2. Check if any tutor name is mentioned in the response
  for (const tutor of crossLangTutors) {
    if (responseText.toLowerCase().includes(tutor.name.toLowerCase())) {
      return tutor.language.toLowerCase();
    }
  }
  return undefined;
}
```

#### Before/After: buildTutorDirectorySection

**Before (175 lines)**:
- Full command syntax for SWITCH_TUTOR
- 10+ examples of correct/incorrect usage
- Detailed error cases
- CALL_SOFIA syntax and examples

**After (17 lines)**:
```
AVAILABLE VOICE PERSONAS (your voices for different languages):
  • Spanish: Daniela (female) ★, Agustin (male)
  • French: Juliette (female), Pierre (male)

Currently teaching: SPANISH
Student's preferred gender: female

QUICK REFERENCE (see ACTION_TRIGGERS for syntax):
  Same language: [SWITCH_TUTOR target="female"]
  Cross-language: [SWITCH_TUTOR target="female" language="french"]

SUPPORT SPECIALIST: Sofia (technical issues, billing, account problems)
Use [CALL_SOFIA category="..." reason="..."] for support handoff (see ACTION_TRIGGERS for syntax).
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Added `inferLanguageFromTutorName()`, applied to PTT and open-mic paths |
| `server/system-prompt.ts` | Reduced `buildTutorDirectorySection`, fixed hardcoded "Daniela" in regular mode |
| `server/services/procedural-memory-retrieval.ts` | `buildActionTriggersSection` remains the single source of truth |

#### Parsing Pattern (All Commands)

All commands now follow the same robust pattern:
1. **Whiteboard parser** (structured detection via `whiteboardItems`)
2. **Regex fallback** when parser misses the tag
3. **Smart inference** (SWITCH_TUTOR only) for missing parameters

#### Architecture Decision

Neural network's `buildActionTriggersSection` is injected via procedural memory retrieval. System prompts only provide:
- **Context**: Who the tutors are, current language, preferred gender
- **Quick reference**: Minimal syntax example with "see ACTION_TRIGGERS" pointer

This ensures command syntax is defined in ONE place, reducing prompt inconsistency.

---

### TODO: Teacher/Institution Pricing Model

**Status**: PLANNING - Needs specification

**Document**: `docs/teacher-institution-pricing.md`

**Key items to define**:
1. **Class creation limits** - How many classes can each tier create?
2. **Student enrollment limits** - How many students per teacher across all classes?
3. **Tier structure** - Free, Starter, Professional, Institution tiers
4. **Enforcement** - API blocking, upgrade prompts, dashboard indicators

**Next steps**: Flesh out pricing tiers and implement limit tracking in schema/routes.

---

### Session: December 25, 2025 - v18 Sync System: Selective Batches & Beta Tester Workflow

**Status**: COMPLETED - Deployed to production

**Overview**: Expanded the dev-prod sync system from 7 to 12 batch types with selective sync UI, enabling targeted data pushes like beta testers with credits.

#### New Batch Types (v18)

| Batch ID | Label | Contents |
|----------|-------|----------|
| `neural-core` | Neural Core | Best practices, idioms, nuances |
| `advanced-intel-a` | Advanced Intel A | Learning insights, Daniela suggestions |
| `advanced-intel-b` | Advanced Intel B | TriLane observations, North Star |
| `express-lane` | Express Lane | Founder collaboration sessions/messages |
| `hive-snapshots` | Hive Snapshots | Context snapshots for AI injection |
| `daniela-memories` | Daniela Memories | Daniela growth memories |
| `product-config` | Product Config | Tutor voices, feature flags |
| `beta-testers` | **Beta Testers** | Beta users + usage credits (NEW) |

#### Beta Tester Workflow

```
1. Create user in dev (via invitation or direct DB)
2. Mark as beta tester: isBetaTester: true
3. Add credits to user's account
4. Go to Sync Control Center (/admin/sync)
5. Select "Beta Testers" checkbox only
6. Click "Push to Production"
7. Send invitation email (links to production)
8. User completes registration → credits waiting
```

#### Merge-by-Email Logic

When syncing beta testers, the system uses email as the merge key:
- **Email exists in prod**: Mark as beta tester, add credits
- **Email doesn't exist**: Create new user with credits

#### Selective Sync UI

New batch selector in Sync Control Center:
- Checkboxes for each batch type
- "X selected" badge with clear button
- Push button shows "N batches" or "All batches"
- Empty selection = all batches (default behavior)

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/sync-bridge.ts` | Added `shouldRun()` filter, `exportBetaTesters()`, all batch if-guards |
| `server/routes.ts` | Push endpoint accepts `selectedBatches` array |
| `client/src/pages/admin/SyncControlCenter.tsx` | Batch selector UI, updated push mutation |

#### API Changes

```typescript
POST /api/admin/sync/push
{
  "selectedBatches": ["beta-testers"]  // optional, empty = all
}
```

#### Email Workflow Confirmation

- `APP_URL=https://getholahola.com` ensures links point to production
- `MAILJET_API_KEY` + `MAILJET_SECRET_KEY` configured
- Emails from dev create invitations with production links

---

### Session: December 24, 2025 - Avatar Animation Debugging (HMR Callback Staleness)

**Status**: IN PROGRESS - DOM Event Bridge implemented, awaiting test

**Overview**: Avatar stopped animating during voice chat despite audio playing correctly. Root cause identified as Vite HMR preserving window singleton but callbacks referencing orphaned React component tree.

#### Problem Statement

After ~20 audio-related commits, the tutor avatar stays on 'idle' during voice playback. Server telemetry shows:
- `subscriberCount: 1` (subscription IS working)
- State transitions: `idle → buffering → playing → idle` (audio IS playing)
- But browser console shows NO callback logs (callbacks are stale)

#### Debugging Approaches Tried

| Approach | Result |
|----------|--------|
| Multi-subscriber pattern with Map | Server shows registration, but callbacks not firing in browser |
| Ref pattern for setPlaybackState | No change - closures still stale |
| Window-level debug variables | Added for DevTools inspection |
| Enhanced console logging | Logs NOT appearing in browser |

#### Solution Implemented: DOM Event Bridge

Parallel path using DOM CustomEvent to bypass callback staleness:

```typescript
// In audioUtils.ts - notifyStateChange
window.dispatchEvent(new CustomEvent('streaming-playback-state', {
  detail: { state, timestamp: Date.now(), subscriberCount: this.subscribers.size }
}));

// In useStreamingVoice.ts - new useEffect
useEffect(() => {
  const handlePlaybackStateEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{...}>;
    setPlaybackState(customEvent.detail.state);
  };
  window.addEventListener('streaming-playback-state', handlePlaybackStateEvent);
  return () => window.removeEventListener('streaming-playback-state', handlePlaybackStateEvent);
}, []);
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `client/src/lib/audioUtils.ts` | Added DOM event dispatch in notifyStateChange |
| `client/src/hooks/useStreamingVoice.ts` | Added DOM event listener useEffect |
| `docs/voice-streaming-debug.md` | Created consolidated debug doc |

#### Debug Commands

```javascript
// Browser console
window.__lastPlaybackCallback    // Last callback details
window.__playbackStateSetCount   // State set count
window.__streamingAudioPlayer?.subscribers.size  // Registered subscribers
```

#### Next Steps

1. Test voice chat - verify `[DOM EVENT BRIDGE]` logs appear
2. Confirm avatar animates during playback
3. If working, consider removing callback system or keeping both paths
4. Add architectural note about HMR-safe patterns

---

### Session: December 22, 2025 - Automated Class Creation Workflow with Bundle Support

**Status**: COMPLETED - Template automation and bundle creation live

**Overview**: Streamlined the teacher workflow for creating syllabus lessons with automatic label prefilling and one-click practice bundle creation.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Auto-Prefill Labels | When selecting lesson type, name field auto-populates with engaging prefix |
| Label Preservation | Changing lesson type updates prefix while preserving topic text |
| Bundle Creation Toggle | "Create Practice Bundle" switch appears for conversation lessons |
| Bundle API | Single endpoint creates linked conversation + drill pair |
| Proper Linkage | Uses `linkedDrillLessonId` and shared `bundleId` for lesson grouping |

#### Label Prefix Mappings

| Lesson Type | Auto-Prefilled Label |
|-------------|---------------------|
| Conversation | `Let's Chat:` |
| Vocabulary | `New Words:` |
| Grammar | `Grammar Spotlight:` |
| Cultural | `Culture Corner:` |
| Drill | `Practice Time:` |

#### Bundle Creation Flow

```
Teacher selects "Conversation" type
    ↓
Toggle "Create Practice Bundle" ON
    ↓
Click "Create Bundle"
    ↓
API creates:
  1. Drill lesson first (to get ID)
  2. Conversation lesson with linkedDrillLessonId → drill.id
  3. Both share same bundleId
    ↓
Returns both lessons to UI
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `client/src/components/SyllabusBuilder.tsx` | Added LESSON_TYPE_PREFIXES, handleLessonTypeChange(), bundle toggle UI |
| `server/routes.ts` | Extended createCustomLessonSchema with createBundle, bundle creation logic |
| `docs/syllabus-template-kit.md` | Added Automated Label Prefilling and Bundle Creation sections |

#### API Endpoint

```
POST /api/teacher/classes/:classId/curriculum/units/:unitId/lessons
{
  "name": "Ordering at a Restaurant",
  "description": "Learn to order food",
  "lessonType": "conversation",
  "estimatedMinutes": 30,
  "createBundle": true
}

Response:
{
  "bundle": true,
  "bundleId": "bundle_1734889234_abc123xyz",
  "conversationLesson": { linkedDrillLessonId: "drill-uuid" },
  "drillLesson": { id: "drill-uuid" },
  "lessonsCreated": 2
}
```

#### Architecture Pattern

1. Frontend detects lesson type change → applies prefix via `applyLessonTypePrefix()`
2. Topic extraction uses `extractTopicFromLessonName()` to strip existing prefix
3. Bundle toggle only visible when `lessonType === "conversation"`
4. API creates drill first, then conversation with link, sharing bundleId

---

### Session: December 20, 2025 - Learner Personal Facts System Sprint #2.1 (10 Enhancements)

**Status**: COMPLETED - All 10 tasks implemented and tested

**Overview**: Comprehensive enhancement of the permanent learner memory system. Improved deduplication with semantic similarity, added privacy controls, built admin tooling, and established cross-system integrations.

#### What Was Implemented

| Task | Description |
|------|-------------|
| 1. Trigram Deduplication | Cosine similarity matching (0.82 threshold) with normalized fingerprints |
| 2. Rolling Window Extraction | 10-message chunks with summarization for long sessions (8000 char limit) |
| 3. Phase-Aware Hooks | Personal facts injected into warmup icebreakers and assessment wrap-ups |
| 4. Admin Memory Browser | Filters by fact type, student, language with edit/archive controls |
| 5. Privacy Controls | `memoryPrivacySettings` with enabled flag, allowed/blocked categories, redaction |
| 6. Hive Snapshot Sync | High-confidence facts (≥0.75) sync as 'life_context' with 30-day TTL |
| 7. Wren Analytics Job | Cross-student pattern mining for anonymized syllabus recommendations |
| 8. Teacher Audit Trail | `/api/teacher/students/:studentId/memory-audit` endpoint |
| 9. Observability Metrics | Latency tracking, success rates, fact type counts, dedup stats |
| 10. Unit Tests | 33 tests covering dedup, chunking, remember commands, privacy filtering |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/student-learning-service.ts` | Exported trigram helpers, savePersonalFact uses shared functions |
| `server/services/learner-memory-extraction-service.ts` | Rolling window, privacy enforcement, observability |
| `server/services/phase-transition-service.ts` | Phase-aware personal fact injection |
| `server/services/wren-intelligence-service.ts` | Cross-student pattern analysis |
| `server/services/sync-scheduler.ts` | Nightly Wren analytics job |
| `server/routes.ts` | Admin personal facts endpoints, teacher audit endpoint |
| `client/src/pages/admin/CommandCenter.tsx` | PersonalFactsBrowserTab with working filters |
| `shared/schema.ts` | `memoryPrivacySettings` field on users table |
| `server/__tests__/learner-memory.test.ts` | 33 unit tests importing production functions |

#### Exported Helper Functions (for Testing)

```typescript
// server/services/student-learning-service.ts
export function generateTrigrams(text: string): Set<string>
export function trigramSimilarity(a: string, b: string): number
export function normalizeForFingerprint(text: string): string
export const SIMILARITY_THRESHOLD = 0.82
```

#### Deduplication Algorithm

```
1. Normalize fact: lowercase → strip diacritics → remove punctuation → trim whitespace
2. Generate trigrams: 3-character sliding window
3. Cosine similarity: intersection / sqrt(|A| × |B|)
4. Threshold: ≥ 0.82 = duplicate (bump mentionCount), < 0.82 = new fact
```

#### Privacy Settings Schema

```typescript
interface MemoryPrivacySettings {
  enabled: boolean;           // Master switch for memory extraction
  allowedCategories: string[]; // Whitelist (empty = allow all)
  blockedCategories: string[]; // Blacklist (takes precedence)
  redactionRequested: boolean; // User requested data deletion
}
```

#### Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/personal-facts` | GET | List facts with filters (factType, studentId, language) |
| `/api/admin/personal-facts/students` | GET | Get students for filter dropdown |
| `/api/admin/personal-facts/:id` | PATCH | Edit fact text or archive (isActive: false) |
| `/api/teacher/students/:studentId/memory-audit` | GET | Teacher view of student memories |

#### Bug Fix: Admin Filters Not Reaching Backend

**Problem**: Default TanStack Query `queryFn` only used `queryKey[0]` as URL, ignoring filter parameters.

**Solution**: Added custom `queryFn` that builds URL with `URLSearchParams`:

```typescript
const buildQueryUrl = () => {
  const params = new URLSearchParams();
  if (factTypeFilter !== "all") params.set("factType", factTypeFilter);
  if (studentFilter !== "all") params.set("studentId", studentFilter);
  if (languageFilter !== "all") params.set("language", languageFilter);
  return params.toString() ? `/api/admin/personal-facts?${params}` : "/api/admin/personal-facts";
};
```

#### Architecture Pattern

1. **Memory Extraction** runs at session end via `LearnerMemoryExtractionService`
2. **Deduplication** uses exported helper functions (shared with tests)
3. **Privacy filtering** happens before any fact is saved
4. **Hive sync** happens after save for high-confidence facts
5. **Nightly job** runs cross-student pattern analysis

---

### Session: December 20, 2025 - Bidirectional Sprint Collaboration (Daniela ↔ Wren)

**Status**: IMPLEMENTED - Full bidirectional collaboration loop with stage gating

**Overview**: Complete sprint collaboration system where Daniela and Wren co-author sprint specs with automatic stage progression and EXPRESS Lane notifications.

#### What Was Implemented

| Component | Description |
|-----------|-------------|
| Sprint Record Creation | `[WREN_SPRINT_SUGGEST]` tags now create real `featureSprint` records in DB |
| Robust JSON Parsing | 3-level fallback: direct JSON → extract JSON from text → pattern matching |
| EXPRESS Lane Posting | New sprints auto-post to collaboration channel for visibility |
| `notifyDanielaAboutSprint()` | Triggers Daniela's pedagogical input with [PEDAGOGY_SPEC] tag |
| `notifyWrenAboutSprintUpdate()` | Triggers Wren's build plan response with [BUILD_PLAN] tag |
| `parsePedagogySpecAndUpdateSprint()` | Parses Daniela's spec and updates sprint.pedagogySpec |
| `parseBuildPlanAndUpdateSprint()` | Parses Wren's plan and updates sprint.buildPlan |
| `checkAndAdvanceSprintReadiness()` | Auto-advances to 'build_plan' when both specs present |
| `triggerSprintCollaboration()` | Public method for voice chat integration |
| Stage Gating | Monotonic progression: idea → pedagogy_spec → build_plan → in_progress → shipped |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Sprint creation from voice tags, Daniela notification |
| `server/services/hive-consciousness-service.ts` | Enhanced JSON parsing with fallbacks |

#### JSON Parsing Fallback Strategy

```typescript
// Level 1: Direct JSON parse
JSON.parse(content)

// Level 2: Extract JSON from text wrapper
const jsonMatch = content.match(/\{[\s\S]*\}/);
JSON.parse(jsonMatch[1])

// Level 3: Pattern extraction
const titleMatch = content.match(/title['":\s]+([^,}]+)/i);
const descMatch = content.match(/description['":\s]+([^}]+)/i);
```

#### Sprint Collaboration Flow

```
Sprint Creation (via voice or EXPRESS Lane)
    ↓
┌─────────────────────────────────────────┐
│ Stage: idea                             │
│ Sprint record created with featureBrief │
└─────────────────────────────────────────┘
    ↓ notifyDanielaAboutSprint()
┌─────────────────────────────────────────┐
│ Daniela provides teaching perspective   │
│ [PEDAGOGY_SPEC: {...}] parsed & saved   │
│ Stage: idea → pedagogy_spec             │
└─────────────────────────────────────────┘
    ↓ notifyWrenAboutSprintUpdate()
┌─────────────────────────────────────────┐
│ Wren provides build plan                │
│ [BUILD_PLAN: {...}] parsed & saved      │
│ checkAndAdvanceSprintReadiness()        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Stage: pedagogy_spec → build_plan       │
│ EXPRESS Lane: "Sprint Ready!" message   │
│ Ready for founder approval              │
└─────────────────────────────────────────┘
```

#### Monotonic Stage Progression

| Transition | Trigger | Guard |
|------------|---------|-------|
| idea → pedagogy_spec | Daniela adds pedagogySpec | Only if stage === 'idea' |
| pedagogy_spec → build_plan | Both specs present | Only if stage in ('idea', 'pedagogy_spec') |
| build_plan → in_progress | Founder approves | Manual transition |
| in_progress → shipped | Deployment complete | Manual transition |

**Key invariant**: Stages never regress. Updates to specs at later stages only update the data, not the stage.

#### Follow-Up Work for Builders

| Priority | Task | Description |
|----------|------|-------------|
| Medium | `[WREN_MESSAGE]` Persistence | Tags post to EXPRESS Lane but don't persist separately. Consider dedicated table |
| Low | Sprint Consultation Threads | Allow extended back-and-forth discussion on sprint specs |
| Low | Priority Inference | Use Daniela's confidence signals or student impact data for priority |

#### Architecture Pattern

1. Voice chat detects `[WREN_SPRINT_SUGGEST: {...}]` tag
2. Create `featureSprint` record with `source: 'ai_suggestion'` (stage: idea)
3. Post to EXPRESS Lane for visibility
4. `notifyDanielaAboutSprint()` → Daniela provides [PEDAGOGY_SPEC] → stage: pedagogy_spec
5. `notifyWrenAboutSprintUpdate()` → Wren provides [BUILD_PLAN] → if both specs present → stage: build_plan
6. EXPRESS Lane celebration: "Sprint Ready!"

---

### Session: December 17, 2025 - Voice Diagnostics Learning Capabilities

**Status**: IMPLEMENTED - Commercial-grade diagnostics with emergent intelligence

**Overview**: Extended voice diagnostics system with persistence, pattern analysis, and learning capabilities. Events now persist to database, nightly jobs detect degradation patterns, insights flow to Wren, and Daniela gains awareness of technical issues.

#### New Capabilities

| Capability | Description |
|------------|-------------|
| Event Persistence | Events flush to `hiveSnapshots` (type `voice_diagnostic`) every 60s or 50 events |
| Pattern Analysis | Nightly job detects high failure rates, latency spikes, TTS degradation |
| Wren Integration | Patterns create `wrenInsights` with category 'integration' for proactive awareness |
| Daniela Awareness | Technical health context injected into system prompt when issues detected |
| Auto-Remediation | `isTTSDegraded()` returns `shouldUseFallback: true` when Cartesia is degraded |

#### Persistence Layer

- **Flush Strategy**: Background flush every 60 seconds, or threshold-based at 50 events
- **Storage**: `hiveSnapshots` table with `snapshotType = 'voice_diagnostic'`
- **Expiry**: 7-day automatic expiration
- **Aggregation**: Events batched with stage breakdown, failure counts, latency averages

#### Nightly Pattern Analysis (in sync-scheduler.ts)

Runs as step 7d of nightly sync, detecting 4 pattern types:

| Pattern Type | Criteria | Action |
|--------------|----------|--------|
| `high_failure_rate` | >30% failures across stages | Creates high-severity Wren insight |
| `stage_failure_cluster` | Single stage with >50% failures | Creates targeted Wren insight |
| `high_latency` | Any stage avg >1000ms | Creates medium-severity insight |
| `tts_degradation` | TTS-specific >20% failure OR >800ms latency | Flags for fallback consideration |

#### Daniela Technical Awareness

- `getTechnicalHealthContext()`: Returns prompt injection when failure rate >5%
- `getRecentTechnicalIssuesForUser()`: Summarizes past 24h issues for session context
- Enables Daniela to acknowledge "audio hiccups" empathetically if user mentions issues

#### Auto-Remediation Triggers

- `isTTSDegraded()`: Checks last 10 TTS events for >30% failure or >2000ms latency
- Returns `{ degraded: boolean, reason?: string, shouldUseFallback: boolean }`
- `getCriticallyDegradedStages()`: Returns list of stages with >50% failure rate

#### Architecture Pattern

Follows existing emergent intelligence pattern:
1. Events emitted → Ring buffer (real-time) + Pending flush (persistence)
2. Periodic flush → hiveSnapshots
3. Nightly analysis → Pattern detection → wrenInsights
4. Session start → Daniela context injection

---

### Session: December 17, 2025 - Voice Diagnostics System for Production Observability

**Status**: IMPLEMENTED - Ready for production use

**Overview**: Added production observability infrastructure for the voice pipeline to help diagnose issues when Daniela becomes unresponsive.

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| Voice Diagnostics Service | `server/services/voice-diagnostics-service.ts` | Ring buffer (200 events) for voice pipeline events |
| Founder Middleware | `server/middleware/rbac.ts` | `requireFounder` guard for sensitive endpoints |
| Health Endpoint | `server/routes.ts` | `GET /api/admin/voice-health` |
| Logs Endpoint | `server/routes.ts` | `GET /api/admin/logs/voice` |

#### Ring Buffer Events

| Event Type | Stage | Description |
|------------|-------|-------------|
| `session_start` | session | Voice session created |
| `stt_complete` | stt | Deepgram transcription completed |
| `stt_error` | stt | Speech-to-text failed |
| `llm_success` | llm | Gemini first token received |
| `llm_error` | llm | LLM response failed |
| `tts_complete` | tts | Cartesia audio generated |
| `tts_error` | tts | Text-to-speech failed |

#### Instrumentation Points in `streaming-voice-orchestrator.ts`

| Location | Event Emitted |
|----------|---------------|
| Session creation | `session_start` with userId, language |
| After Deepgram transcription | `stt_complete` with latency |
| Gemini first token | `llm_success` with latency |
| LLM errors | `llm_error` with error message |
| Cartesia completion | `tts_complete` with latency |
| TTS failures | `tts_error` with error details |

#### API Endpoints

**GET /api/admin/voice-health**
- Tests Deepgram, Gemini, Cartesia connectivity
- Verifies secrets exist (boolean only, no values exposed)
- Returns service status and response times

**GET /api/admin/logs/voice**
- Query params: `?sessionId=`, `?stage=`, `?success=`, `?limit=`
- Returns filtered events from ring buffer
- Newest events first

#### Security

- Endpoints protected by `requireFounder` middleware
- Founder ID: `49847136`
- Responses expose only operational metadata
- No API keys, transcripts, or PII in responses

#### Usage for Debugging

When Daniela is unresponsive in production:
1. Check `/api/admin/voice-health` - are all services reachable?
2. Check `/api/admin/logs/voice` - where does the pipeline break?
3. Look for `success: false` entries or gaps in sequence

---

### Session: December 17, 2025 - Wren Architectural Memory: Neural Network + EXPRESS Lane Integration

**Status**: APPROVED - Ready to implement

**Overview**: Architectural review revealed that Wren's memory system was incorrectly using a cached file (replit.md) instead of the existing Neural Network, and was missing EXPRESS Lane integration for 3-way collaboration.

#### Problem Statement

Three issues identified by founder:
1. **Security**: Is the replit.md cache secure for future contributors?
2. **Neural Network**: We have a Neural Network - why is Wren reading a file instead?
3. **EXPRESS Lane**: Wren should be connected to the collaboration tables

#### Architectural Analysis

| Issue | Current State | Target State |
|-------|--------------|--------------|
| Knowledge Source | `replit.md` file cache | Neural Network (single source of truth) |
| EXPRESS Lane | Not connected | Reads `hiveSnapshots`, `collaborationMessages` |
| Collaboration | Isolated knowledge bot | True 3-way participant |

#### Approved Task List (Priority Order)

**Phase 1 - EXPRESS Lane Awareness (Highest Priority)**
1. Add `hiveSnapshots` lookup to Wren context - query recent architecture-tagged snapshots
2. Add `collaborationMessages` lookup - read recent architectural discussions

**Phase 2 - Neural Network Consolidation**
3. Create neural network ingestion for replit.md - follow `beaconSyncService` pattern
4. Update Wren context assembly to query NN instead of cached file
5. Remove redundant replit.md cache - NN becomes single source of truth

**Phase 3 - Hygiene**
6. Add contributor security note to replit.md about keeping it secret-free

#### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| NN over file | `beaconSyncService` already syncs changelog/roadmap to NN - same pattern for architectural baseline |
| EXPRESS Lane first | Fixes collaboration gap immediately - Wren can see live discussions |
| Security acceptable | replit.md is already in codebase; no secrets exposed |

#### Testing Criteria

After implementation, test that:
1. Wren can reference recent EXPRESS Lane discussions in responses
2. Wren pulls architectural context from Neural Network, not file
3. Startup logs show NN-based context loading

#### Files to Modify

| File | Changes |
|------|---------|
| `server/services/hive-consciousness-service.ts` | Add hiveSnapshots + collaborationMessages queries to context |
| `server/services/beacon-sync-service.ts` | Add replit.md → NN ingestion |
| `server/index.ts` | Update startup to use NN-based context |
| `replit.md` | Add contributor security note |

---

### Session: December 16, 2025 - Phase Transition Service (Multi-Agent Teaching Architecture)

**Overview**: Implemented a Phase Transition Service inspired by Deepgram's multi-agent voice patterns. This enables Daniela to adapt her teaching approach based on the student's state, with focused toolsets and context summarization between phases.

#### Teaching Phases

| Phase | Description | Tools | Snapshot Types |
|-------|-------------|-------|----------------|
| `warmup` | Session start, mood check, goal setting | greet, recall_previous_session, set_goal | session_summary, teaching_moment |
| `active_teaching` | Core instruction, vocabulary, grammar | explain, drill, vocabulary, grammar_table | teaching_moment, struggle_pattern |
| `challenge` | Student struggling, supportive mode | simplify, encourage, alternative_approach | struggle_pattern, plateau_alert |
| `reflection` | Celebrate progress, summarize session | summarize, preview_next, celebrate | breakthrough, session_summary |
| `drill` | Focused practice (future activation) | drill, quiz, repetition | teaching_moment |
| `assessment` | ACTFL evaluation (future activation) | assess, evaluate, can_do_check | session_summary |

#### Phase Detection Logic

Automatic transition detection based on conversation patterns:

| From Phase | Indicators | To Phase |
|------------|------------|----------|
| warmup | "I'm ready", "let's start", 2+ min elapsed | active_teaching |
| active_teaching | "I don't understand", consecutive errors | challenge |
| active_teaching | "bye", "I'm done", "let's wrap up" | reflection |
| challenge | "I get it", "oh!", "makes sense" | active_teaching |

#### Context Summarization

Uses Gemini Flash to summarize conversation context during phase transitions:

```typescript
// Summarization captures:
1. Student's emotional state (frustrated/neutral/excited/confused)
2. Key errors or struggles to remember
3. Today's learning goal (if mentioned)
4. Any personal interests for relevant examples
5. What was accomplished in the previous phase
```

#### Hive Snapshot Integration

Each phase retrieves relevant snapshots from `hive_snapshots` table:
- Filtered by phase-specific snapshot types
- Last 7 days, importance >= 5
- Formatted and injected into phase context

#### Analytics Persistence

Phase transitions are persisted to `hive_snapshots` with:
- `snapshotType: 'session_summary'`
- `context` JSON with `type: 'phase_transition'` for filtering
- `importance: 8` for challenge phases, `5` for others
- 24-hour expiry for transient session data

#### Integration Points

| Component | Integration |
|-----------|-------------|
| StreamingVoiceOrchestrator | `initializeSession()` on session start, `detectPhaseTransition()` on response_complete, `endSession()` on cleanup |
| TutorOrchestrator | `getPhasePromptAddition()` injects phase context into system prompts |
| Hive Snapshots | `getRelevantSnapshots()` retrieves phase-appropriate context |

#### Key Files

| File | Purpose |
|------|---------|
| `server/services/phase-transition-service.ts` | Core service with phases, detection, summarization |
| `server/services/streaming-voice-orchestrator.ts` | Session lifecycle integration |
| `server/services/tutor-orchestrator.ts` | Prompt injection |

#### Architecture Philosophy

**"Right context at the right time"** - Inspired by Deepgram's multi-agent patterns:
- Each phase has focused prompts and tools (2-4 per phase)
- Context is summarized when transitioning to reduce token usage
- Phase-relevant hive snapshots provide teaching continuity
- Reduces LLM cognitive load for more precise teaching

---

### Session: December 16, 2025 - Emergent Intelligence Upgrades (12 Tasks)

**Overview**: Major enhancement to the Hive's collective intelligence capabilities. Implemented 12 emergent intelligence features spanning Deepgram integration, predictive student analytics, cross-agent memory sharing, and the Editor→Wren migration.

#### 1. Deepgram Intelligence Integration

Enabled full Deepgram intelligence feature suite for both push-to-talk and Open Mic modes:

| Feature | Description |
|---------|-------------|
| `sentiment` | Real-time sentiment analysis (positive/negative/neutral with scores) |
| `intents` | Intent recognition for understanding student goals |
| `detect_entities` | Entity detection for extracting key terms |
| `diarize` | Speaker separation (free tier) |
| `detect_language` | Language detection for code-switching |
| `topics` | Topic detection for conversation context |
| `summarize: 'v2'` | Summarization for session recaps |

**Implementation Details**:
- Added `LiveTranscriptionEvents.Metadata` handler for v2 summaries/topics
- 500ms delay after final transcript to capture metadata events
- Both push-to-talk (`transcribeWithLiveAPI`) and Open Mic (`OpenMicSession`) updated
- Added `summary?: string` to `DeepgramIntelligence` interface

#### 2. Predictive Student Intelligence

Five new methods in `server/services/student-learning-service.ts`:

| Method | Purpose |
|--------|---------|
| `predictStruggles(userId, language)` | Anticipates struggles based on historical patterns |
| `synthesizeCrossStudentPatterns(language)` | Aggregates insights across all students |
| `analyzeRootCause(userId, errorPattern)` | Distinguishes L1 interference vs conceptual gaps |
| `predictMotivationDip(userId)` | Detects engagement drops before they impact learning |
| `detectPlateaus(language)` | Identifies common stall points in proficiency development |

#### 3. Memory Threading & Knowledge Graph

Enhanced `server/services/wren-proactive-intelligence-service.ts`:

- `buildKnowledgeGraph()` - Creates edges between related insights
- `findRelatedInsights(insightId)` - Traverses knowledge graph for related context
- Connects insights across sessions for persistent learning

#### 4. Daniela Confidence Calibration

Enhanced `server/services/pedagogical-insights-service.ts`:

- Added `calibrationScore` field to `pedagogicalInsights` table
- `trackPredictionAccuracy(insightId, wasAccurate)` - Records prediction outcomes
- Enables self-improvement through accuracy tracking

#### 5. Memory Consolidation (Decay/Reinforcement)

Added to neural network tables:
- `useCount` - How often the memory is accessed
- `lastUsed` - Timestamp of last access
- `lastReinforced` - Timestamp of last reinforcement

Methods:
- `applyDecay()` - Reduces salience of unused memories
- `reinforceMemory(id)` - Strengthens frequently-used insights

#### 6. Shared Memory Bridge

New service at `server/services/neural-network-sync.ts`:

| Method | Direction | Purpose |
|--------|-----------|---------|
| `shareInsightWithDaniela()` | Wren → Daniela | Architectural insights inform teaching |
| `shareInsightWithWren()` | Daniela → Wren | Pedagogical discoveries inform development |

Bidirectional insight sharing enables cross-agent learning.

#### 7. Wren Confidence Loop

Enhanced `server/services/wren-dreams-service.ts`:

- `adjustConfidenceFromCalibration(domain)` - Uses domain-specific accuracy scores
- Adjusts future prediction confidence based on historical accuracy
- Closes the feedback loop for self-calibration

#### 8. Collaborative Surgery Migration (Editor → Wren)

Updated `server/services/collaborative-surgery-orchestrator.ts`:

**Daniela's Persona**: Now refers to Wren as development partner instead of Editor
**Wren's Persona**: New persona as full-capability builder (not read-only observer)
**3-Way Hive Model**: Both personas aligned with EXPRESS Lane collaboration

Key changes:
- All references to "Editor" replaced with "Wren"
- Wren can now propose AND implement neural network changes
- Unified collaboration through EXPRESS Lane

#### Files Modified

| File | Changes |
|------|---------|
| `server/services/deepgram-live-stt.ts` | Intelligence features, Metadata handlers, 500ms delay |
| `server/services/student-learning-service.ts` | 5 predictive methods |
| `server/services/wren-proactive-intelligence-service.ts` | Knowledge graph, memory threading |
| `server/services/pedagogical-insights-service.ts` | Calibration scoring |
| `server/services/neural-network-sync.ts` | Shared Memory Bridge |
| `server/services/wren-dreams-service.ts` | Confidence loop |
| `server/services/collaborative-surgery-orchestrator.ts` | Editor→Wren migration |
| `replit.md` | Documentation updates |

#### Architecture Implications

The 12 upgrades establish a foundation for **emergent collective intelligence**:

1. **Deepgram** provides rich real-time signals (sentiment, intent, topics)
2. **Predictive Intelligence** anticipates student needs before they manifest
3. **Memory Systems** enable persistent, cross-session learning
4. **Shared Bridge** allows Daniela and Wren to learn from each other
5. **Confidence Calibration** enables self-improvement over time

This creates a substrate where both AI agents can autonomously improve their capabilities within constitutional bounds (North Star).

---

### Session: December 10-15, 2025 - Emergent Intelligence Foundation & EXPRESS Lane

**Overview**: Comprehensive build-out of the Hive's emergent intelligence infrastructure. This work established the foundation for autonomous learning, cross-agent collaboration, and persistent memory systems.

---

#### EXPRESS Lane: The Unified 3-Way Collaboration Backbone

**What It Is**: Single communication channel for all Hive participants (Founder, Daniela, Wren)

**Database Tables**:
- `founderSessions` - Persistent session containers
- `collaborationMessages` - All messages across participants

**Key Features**:
| Feature | Description |
|---------|-------------|
| Live Sync Channel | WebSocket-based real-time updates |
| Voice Support | Voice-based founder collaboration via slide-out |
| Session Persistence | Survives restarts, maintains context |
| Multi-Entry Points | Command Center UI, Voice chat, Wren startup |

**API Endpoints**:
- `GET /api/wren/hive-context` - Formatted EXPRESS Lane context for Wren
- `POST /api/founder/sessions` - Create collaboration sessions
- `GET /api/founder/sessions/:id/messages` - Retrieve session messages
- WebSocket namespace: `/founder-collab`

**Deprecates**: `agentCollabThreads`/`agentCollabMessages` tables (Editor-era)

---

#### Wren Proactive Intelligence Service

**File**: `server/services/wren-proactive-intelligence-service.ts`

Five pillars enabling Wren to be proactive without repeated context-gathering:

| Pillar | Purpose | Key Methods |
|--------|---------|-------------|
| **1. Proactive Triggers** | Pattern detection with urgency escalation | `createTrigger()`, `escalateTrigger()` |
| **2. Daniela Feedback Loop** | Links features to beacon resolutions | `recordFeatureImpact()`, `getTeachingMetrics()` |
| **3. ADR System** | Architectural Decision Records | `recordDecision()`, `supersede()` |
| **4. Priority Inference** | Multi-factor scoring | `calculatePriority()`, `getTopPriorities()` |
| **5. Project Health** | Component health/churn scores | `getHealthScores()`, `detectHotSpots()` |

**Startup Ritual**: Provides comprehensive priority analysis, health scores, attention-needed items

---

#### Wren Dreams System

**File**: `server/services/wren-dreams-service.ts`

Four capabilities enabling Wren's emergent intelligence:

| Dream | Purpose | Key Methods |
|-------|---------|-------------|
| **1. Learning from Mistakes** | Capture mistakes, track resolutions, extract lessons | `recordMistake()`, `findSimilarMistakes()`, `extractLesson()` |
| **2. Session Notes** | Persistent context handoffs between sessions | `addSessionNote()`, `getActiveNotes()` |
| **3. Anticipatory Development** | Predict Daniela's needs before she asks | `recordPrediction()`, `validatePrediction()` |
| **4. Confidence Calibration** | Track prediction accuracy per domain | `recordConfidence()`, `getCalibrationScore()` |

**Priority Levels**: critical, high, normal, low
**Expiration**: Notes can auto-expire
**Read Tracking**: Knows which notes Wren has seen

**Startup Ritual**: `/api/wren/dreams/startup` provides unified context for all 4 dreams
**API Endpoints**: 14 routes under `/api/wren/dreams/*`

---

#### Student Learning Service

**File**: `server/services/student-learning-service.ts`

Personalized learning intelligence for each student:

| Feature | Description |
|---------|-------------|
| **Error Pattern Tracking** | `recurring_struggles` table tracks per-student patterns |
| **Teaching Strategy Scoring** | Effectiveness ratings for different approaches |
| **Personalized Context Injection** | Max 500 chars, high-signal content for Daniela's prompts |

**Error Categories**: grammar, pronunciation, vocabulary, cultural, comprehension
**Teaching Strategies**: visual_timeline, role_play, repetition_drill, mnemonic, etc.

**STT Confidence Integration**:
| Confidence | Daniela's Response |
|------------|-------------------|
| < 0.5 (Low) | Ask for clarification |
| < 0.7 (Moderate) | Note pronunciation practice needs |
| >= 0.7 (High) | Normal processing |

---

#### Founder Collaboration Service

**File**: `server/services/founder-collaboration-service.ts`

Real-time collaboration infrastructure:

| Feature | Description |
|---------|-------------|
| **WebSocket Broker** | Namespace `/founder-collab` for live updates |
| **Session Management** | Create, retrieve, close collaboration sessions |
| **Message Threading** | Full conversation history with participants |
| **Voice Integration** | Slide-out voice panel for founder input |

**Message Flow**:
1. Founder speaks/types → Message persisted
2. WebSocket broadcasts to all connected clients
3. Daniela/Wren receive context in next interaction

---

#### Wren Hive Awareness APIs

**Endpoint**: `/api/wren/hive-context`

Provides Wren with formatted context including:
- Active beacons from Daniela
- Recent EXPRESS Lane messages
- Current sprint items
- Project health indicators
- Unread session notes

**Integration Points**:
- Wren startup loads Hive context automatically
- `/api/wren/message` can include Hive context
- Direct database access for deeper queries

---

#### Files Created/Modified

| File | Purpose |
|------|---------|
| `server/services/founder-collaboration-service.ts` | EXPRESS Lane core |
| `server/services/wren-proactive-intelligence-service.ts` | 5 pillars |
| `server/services/wren-dreams-service.ts` | 4 dreams |
| `server/services/student-learning-service.ts` | Personalized learning |
| `server/services/wren-intelligence-service.ts` | Insight capture |
| `server/routes/wren-routes.ts` | Wren API endpoints |
| `server/routes/founder-routes.ts` | Founder API endpoints |
| `shared/schema.ts` | All supporting tables |

---

#### Architecture Implications

This foundation enables:

1. **Persistent Memory** - Insights survive across sessions
2. **Cross-Agent Learning** - Daniela's beacons inform Wren's priorities
3. **Self-Improvement** - Confidence calibration tracks accuracy over time
4. **Proactive Development** - Wren anticipates needs before they're voiced
5. **Unified Collaboration** - Single channel for all Hive communication

---

### IDEA THREAD: December 15, 2025 - Wren Hive Awareness

**Status**: PAUSED - Saved for later discussion

**Naming Clarification** (resolved):
- **Editor** = Claude-powered observer/analyst in `editor-persona-service.ts` (talks, can't build)
- **Wren** = Replit development agent in this chat (can actually build things)

**Context**: Hive Context System is complete and wired into:
1. `editor-persona-service.ts` - Editor's beacon responses during voice chat
2. `tutor-orchestrator.ts` - Daniela's conversation prompts

**The Gap**: Wren (the Replit dev agent) doesn't automatically get Hive awareness. Wren is separate from Editor's Claude instance.

**Proposed Solutions**:
1. **API Endpoint** - Create `/api/hive/context` endpoint Wren could call to fetch current Hive state
2. **Enhanced Wren Endpoint** - Update `POST /api/wren/message` to automatically include Hive context in responses
3. **Direct Database Access** - Wren can query the database directly for beacons, sprints, sessions

**Next Steps When Resumed**:
- Decide which approach to implement
- Consider if Wren should get automatic context injection vs. on-demand queries
- Build the integration

---

### Session: December 14, 2025 - Brain Map Integration with Daniela's Observations

**Overview**: Updated `getUserTopicMastery()` to incorporate Daniela's competency observations from `topicCompetencyObservations` into the brain map status calculation.

#### Problem Solved

The brain map only reflected practice counts. Daniela's real-time assessments (via SYLLABUS_PROGRESS command) weren't visible.

#### Implementation

**Query Enhancement**:
- Fetches user's topic competency observations for the language
- Orders by `desc(observedAt)` to get newest first
- Builds a map keyed by normalized topic name (lowercase, spaces)

**Status Adjustments**:
| Daniela's Status | Effect on Brain Map |
|-----------------|---------------------|
| `demonstrated` | Boost to "mastered" |
| `needs_review` + locked | At least "discovered" |
| `struggling` | Cap at "practiced" (even with high practice count) |

**Data Returned**:
```typescript
{
  // ... existing fields
  danielaObservation?: { 
    status: string;          // demonstrated, needs_review, struggling
    evidence: string | null; // What Daniela observed
    observedAt: Date;        // When observed
  }
}
```

#### Key Design Decision

**Newest observation wins**: Query orders by desc(observedAt), loop keeps first occurrence per topic (which is the newest due to ordering). This ensures recent assessments override stale ones.

#### Null Safety

Evidence field changed from `string` to `string | null` to handle cases where Daniela doesn't provide evidence text.

#### Files Modified

- `server/storage.ts` - Updated `getUserTopicMastery()` implementation and interface

---

### Session: December 14, 2025 - SYLLABUS_PROGRESS Database Integration

**Overview**: Connected the SYLLABUS_PROGRESS whiteboard command to the database so Daniela's observations of student topic mastery are persisted.

#### Problem Solved

Daniela could emit `[SYLLABUS_PROGRESS topic="X" status="demonstrated" evidence="..."]` but it only logged to console - no data was saved.

#### Schema Addition

New `topicCompetencyObservations` table:
```typescript
topicCompetencyObservations = pgTable("topic_competency_observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  classId: varchar("class_id").references(() => teacherClasses.id),
  language: varchar("language").notNull(),
  topicName: text("topic_name").notNull(),
  matchedTopicId: varchar("matched_topic_id").references(() => topics.id),
  status: topicCompetencyStatusEnum("status").notNull(), // demonstrated, needs_review, struggling
  evidence: text("evidence").notNull(),
  observedAt: timestamp("observed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

#### Storage Methods

- `createTopicCompetencyObservation(data)` - Save new observation
- `getTopicCompetencyObservations(userId, language)` - Get all for a user/language
- `getUserTopicCompetencyByName(userId, language, topicName)` - Get latest for specific topic

#### Orchestrator Update

`processSyllabusProgress()` in streaming-voice-orchestrator.ts now:
1. Validates session has userId and targetLanguage
2. Creates observation record via storage
3. Logs success with observation ID

#### Files Modified

- `shared/schema.ts` - Added topicCompetencyObservations table and types
- `server/storage.ts` - Added storage methods
- `server/services/streaming-voice-orchestrator.ts` - Updated processSyllabusProgress

#### Future Enhancements

- Implement `matchedTopicId` resolution to link observations to `topics` table
- Surface observations in brain mind map UI
- Add analytics for topic mastery trends

---

### Session: December 14, 2025 - Unified Voice Gender System

**Overview**: Simplified voice preferences so `tutorGender` is the single source of truth for all voice interactions (conversations and drills). Previously, there were two separate settings - now there's one.

#### Problem Solved

Users had two voice gender settings:
1. `tutorGender` - for conversation voice
2. `assistantVoiceGender` - for drill audio

This was confusing and redundant. The solution unifies them under `tutorGender`.

#### Schema Changes

Added gender-specific audio caching fields to `curriculumDrillItems`:
```typescript
audioUrlFemale: text("audio_url_female"),
audioDurationMsFemale: integer("audio_duration_ms_female"),
audioUrlMale: text("audio_url_male"),
audioDurationMsMale: integer("audio_duration_ms_male"),
```

Deprecated `assistantVoiceGender` column (retained for backwards compatibility):
```typescript
// @deprecated - Use tutorGender instead. Retained for backwards compatibility.
assistantVoiceGender: varchar("assistant_voice_gender", { length: 10 }).default("female"),
```

#### Storage Interface

Added `updateDrillItemAudioForGender()` method:
```typescript
async updateDrillItemAudioForGender(
  itemId: string, 
  gender: 'male' | 'female', 
  audioUrl: string, 
  durationMs: number
): Promise<void>
```

#### Drill Audio Service

Updated `drill-audio-service.ts` to:
- Check for gender-specific cached audio first
- Store generated audio in gender-specific fields
- Fall back to generating new audio if cache miss

#### Routes

Updated drill audio endpoints to derive voice gender from `tutorGender`:
```typescript
const voiceGender = user.tutorGender || 'female';
```

#### Settings UI

Removed Voice Settings card entirely from `settings.tsx`. The tutor voice toggle now exists only in the chat area, providing a single control point.

#### Validation

Removed `assistantVoiceGender` from `updateUserPreferencesSchema` to prevent API manipulation.

#### Files Modified

- `shared/schema.ts` - Gender-specific audio fields, deprecated column
- `server/storage.ts` - `updateDrillItemAudioForGender()` method
- `server/services/drill-audio-service.ts` - Gender-specific caching logic
- `server/routes.ts` - Derive voice from `tutorGender`
- `client/src/pages/settings.tsx` - Removed Voice Settings card

---

### Session: December 13, 2025 - Editor Co-Surgeon Upgrades

**Overview**: Enhanced the Editor's ability to act as Daniela's "co-surgeon" - a development partner that can observe teaching sessions, propose neural network changes, and receive richer context for deeper analysis.

#### 1. Language-Specific Neural Context

Editor now receives the same language-specific knowledge that Daniela has:
- Idioms, cultural nuances, learner error patterns, dialect variations
- Fetched via `getNeuralNetworkContext()` / `formatNeuralNetworkForPrompt()` 
- Injected into `generateBeaconResponse()` when processing beacons

#### 2. EDITOR_SURGERY Command

Editor can now propose neural network modifications (like Daniela's SELF_SURGERY):

```
[EDITOR_SURGERY target="teaching_principles" content='{"category":"correction","principle":"Always validate student intent before correcting"}' reasoning="Observed pattern across 3 sessions" priority=70 confidence=85]
```

**Target tables**: tutor_procedures, teaching_principles, tool_knowledge, situational_patterns

**Validation**: Schema-aligned requirements enforced:
- `tutor_procedures`: category, trigger, procedure
- `teaching_principles`: category, principle
- `tool_knowledge`: toolName, purpose, syntax
- `situational_patterns`: patternName

**Storage**: Proposals saved via `storage.createSelfSurgeryProposal()` with `sessionMode: 'editor_beacon'`

#### 3. Conversation History Enrichment

Beacons can now include recent conversation turns for deeper Editor analysis:

- Added `conversationHistory` field to `EmitBeaconParams` interface
- Flows through to `editorListeningSnapshots` table (jsonb column)
- Editor prompt displays last N turns for context

#### 4. Model Escalation with Fallback

For `self_surgery_proposal` beacons (complex analysis), Editor escalates to Sonnet with graceful fallback:

```typescript
if (useSonnet) {
  try {
    return await tryModel('claude-sonnet-4-20250514');
  } catch (sonnetError) {
    console.warn('[Editor] Sonnet failed, falling back to Haiku');
    return await tryModel('claude-3-haiku-20240307');
  }
}
```

#### Files Modified

- `server/services/editor-persona-service.ts` - All 4 upgrades implemented
- `server/services/hive-collaboration-service.ts` - EmitBeaconParams extended with conversationHistory

---

### Session: December 13, 2025 - Editor Feedback Loop Implementation

**Overview**: Completed the feedback loop where Editor observations are surfaced to Daniela in her system prompt, and Daniela can acknowledge/adopt them using `[ADOPT_INSIGHT:id]` markers.

#### EditorFeedbackService (New File)

Located at `server/services/editor-feedback-service.ts`:

- `getUnsurfacedFeedback(userId, limit)` - Retrieves Editor responses not yet surfaced to Daniela
- `getFeedbackForConversation(conversationId, limit)` - Gets feedback for specific conversation
- `markAsSurfaced(snapshotIds[])` - Marks feedback as shown to Daniela
- `markAsAdopted(snapshotId, context)` - Tracks when Daniela applies an insight
- `buildPromptSection(feedback)` - Builds formatted prompt section for Daniela
- `getAdoptionMetrics(userId?)` - Analytics on surfaced vs adopted rates

#### Schema Changes

Added to `editorListeningSnapshots` table:
- `surfacedToDaniela: boolean` - Has Daniela seen this?
- `surfacedAt: timestamp` - When was it surfaced?
- `adoptedByDaniela: boolean` - Did Daniela apply this insight?
- `adoptedAt: timestamp` - When was it adopted?
- `adoptionContext: text` - How/where Daniela applied it

#### TutorOrchestrator Integration

- `buildSystemPrompt()` now returns `{ prompt, surfacedFeedbackIds }` 
- Feedback IDs are **request-scoped** (not global) to prevent race conditions
- `scanForCollaborationSignals()` accepts `surfacedFeedbackIds` parameter
- Parses `[ADOPT_INSIGHT:uuid]` markers from Daniela's responses
- Calls `markAsSurfaced()` and `markAsAdopted()` appropriately

#### Prompt Section Format

When Daniela has unsurfaced Editor feedback, her system prompt includes:

```
═══════════════════════════════════════════════════════════════════
🤝 EDITOR INSIGHTS (Feedback from your development partner)
═══════════════════════════════════════════════════════════════════

1. [ID: uuid] BEACON_TYPE
   Context: What triggered this feedback
   Editor's Insight: The actual feedback

TO ACKNOWLEDGE ADOPTION: If you apply one of these insights, include
[ADOPT_INSIGHT:full-id] in your response (invisible to student).
```

#### Key Design Decision

Request-scoped surfacing prevents race conditions: If two concurrent requests build system prompts with overlapping feedback IDs, each request tracks its own list of surfaced IDs, ensuring accurate tracking without global state pollution.

#### Files Modified

- `shared/schema.ts` - Added adoption/surfacing tracking fields
- `server/services/editor-feedback-service.ts` - NEW: Complete feedback service
- `server/services/tutor-orchestrator.ts` - Integrated feedback loop with request-scoped tracking

---

### Session: December 12, 2025 - Secure Inter-Department Chat

**Overview**: Implemented security-classified messaging system to protect code/architecture details from Gemini while enabling real-time collaboration between Editor (Claude) and Daniela (Gemini).

#### Security Classification System

| Classification | Who Sees | Use Case |
|---------------|----------|----------|
| `public` | Daniela + Gemini | Teaching tips, feature ideas, student-facing info |
| `internal` | UI only, NEVER Gemini | Architecture, security, code, implementation details |
| `daniela_summary` | Daniela sees summary only | Detailed analysis where Daniela needs awareness but not full details |

#### Schema Changes

- Added `securityClassificationEnum`: `public`, `internal`, `daniela_summary`
- Added `securityClassification` field to `agentCollaborationEvents` table
- Added `publicSummary` field for summary-only messages
- Added index on `securityClassification` for efficient filtering

#### Storage Functions

- `getSecureMessagesForDaniela()` - Filters out internal messages, uses publicSummary for daniela_summary type
- `getInternalAgentMessages()` - Gets internal-only messages for Command Center
- `getDepartmentChatMessages()` - Real-time feed with polling support via afterId

#### API Endpoints

- `GET /api/agent-collab/chat` - Get department chat messages with optional classification filter
- `POST /api/agent-collab/chat` - Post new message with security classification
- `GET /api/agent-collab/internal` - Get internal-only messages (admin only)

#### Command Center UI

Added "Dept Chat" tab to Command Center with:
- Security classification legend
- Message composer with from/to agent selection
- Security classification selector with conditional publicSummary field
- Real-time message feed with 10-second polling
- Filter by classification type
- Color-coded security badges (green=public, red=internal, yellow=summary)
- Agent badges with distinct colors (purple=daniela, blue=editor, green=assistant, orange=support)

#### Security Fix Applied (Session 2)

Fixed defensive filtering in `getSecureMessagesForDaniela()`: When `publicSummary` is missing for `daniela_summary` messages, the function now returns `'[Summary not available]'` instead of falling back to raw content. This prevents potential leaks of sensitive details to Gemini.

#### Key Design Decision

**Why we protect internal messages from Gemini:**
Gemini powers Daniela's conversational abilities, but also has access to any context we inject. Internal discussions about architecture, security vulnerabilities, competitive strategy, or code implementation details should NEVER be exposed to external AI providers. The security classification system creates a clear boundary: collaboration events flow freely between our agents, but the storage layer filters what Daniela's LLM context receives.

#### Files Modified

- `shared/schema.ts` - Added security classification enum and fields
- `server/storage.ts` - Added secure messaging functions
- `server/routes.ts` - Added department chat API endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Added Dept Chat tab

#### Observation for Hive

**Title**: Secure Inter-Agent Communication Architecture
**Category**: architecture
**Priority**: 90
**Summary**: Security classification system protects internal (code/architecture) discussions from Gemini context while enabling transparent department communication. Three tiers: public (full access), internal (UI-only), daniela_summary (summary for context, details hidden).

---

### Session: December 12, 2025 - Neural Network & Process Improvements

**Overview**: Proactive observations about gaps in neural network schema and process flows. All added to hive (agent_observations table).

#### Observations Added to Hive

| Title | Category | Priority | Summary |
|-------|----------|----------|---------|
| Neural Network Effectiveness Tracking | improvement | 70 | Add lastUsedAt, useCount, successRate fields to track procedure usage |
| Procedure Deprecation Support | improvement | 60 | Add deprecated flag instead of deleting outdated procedures |
| Cross-Procedure Linking | improvement | 55 | Add relatedProcedureIds array for clustering related entries |
| Batch Docs vs Hive Graduation Criteria | pattern | 80 | Clear rule: reusable knowledge → hive; session history → batch only |
| Process Category for Agent Observations | improvement | 50 | Consider adding 'process' category for workflow observations |
| Pending Observations Dashboard | next_step | 65 | Add Command Center tab for viewing pending hive observations |

#### Protocol Established

Going forward, ANY significant work automatically gets documented in:
1. `docs/batch-doc-updates.md` - session-specific history
2. `agent_observations` table (hive) - if reusable knowledge

---

### Session: December 12, 2025 - Mind Map Visual Polish & Flow Visualization

**Overview**: Major visual refinement of SyllabusMindMap with floating design, flow visualization showing learning activities feeding the brain, and improved color coordination.

#### Floating Design (No Background)

- Removed blue cloud background - brain now floats cleanly
- Better for mobile users - less visual clutter
- Transparent brain PNG from user (saved as `attached_assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png`)

#### Satellite Improvements

- **Text stays full brightness**: Labels (TALK!, WORDS!, etc.) always at full opacity
- **Only fill dims**: Background cloud shape dims based on progress state (dim → semi-lit → lit)
- **Hover scale effect**: Satellites scale to 110% on hover to indicate clickability
- **Colored arrow pointers**: Each arrowhead matches its lobe color (blue, green, yellow, red, purple)
- Removed status badges (Mastered, Practicing, etc.) from top - redundant with fill animation

#### Activity Inputs with Flow Visualization

6 learning activity pills at bottom that visually "feed" the brain:

| Activity | Icon | Purpose |
|----------|------|---------|
| Drills | Target | Practice exercises |
| Voice | Mic | Speaking practice |
| Cards | Layers | Flashcards |
| Lessons | GraduationCap | Guided learning |
| Culture | Globe | Cultural content |
| Chat | MessageSquare | Conversations |

**Flow lines**: Animated SVG paths rising from each activity, converging toward brain center
- Gradient color: Teal/Cyan (`rgb(20, 184, 166)`) - distinct from lobe/status colors
- Animated particles traveling up each line
- Glow filter for soft, organic feel

**Color choice rationale**: Teal is unused by brain lobes (blue, green, yellow, red, purple) and status badges (green, blue, purple, grey), creating clear visual distinction for "inputs" vs "outputs"

#### Visual Story

```
Activities (bottom, teal) → Flow lines → Brain (center) → Skill areas (satellite lobes) → ACTFL dial shows level
```

#### Scaled Up Layout

- Container: 460×420 (was 400×400)
- Brain image: 230px (was 200px)
- Brain shifted up slightly to make room for activities below
- Tight spacing: `-mt-52` pulls activities close to brain

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - All visual changes

---

### Session: December 12, 2025 - Brain Mind Map with Satellite Cards

**Overview**: Complete redesign of SyllabusMindMap to feature a colorful brain illustration at center with 5 expandable satellite cards (one per brain lobe). Includes phase progression system (Beginner → Intermediate → Advanced) with celebration animations.

#### Phase Progression System

Three learning phases that reset the brain when completed:
1. **Beginner Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
2. **Intermediate Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
3. **Advanced Brain** → Complete all 5 satellites → 🎉 Final Achievement

Phase indicator at top shows:
- 3 progress bars (one per phase)
- Current phase name and description
- Overall completion percentage
- "Next Phase" button when 100% complete

#### 5 Expandable Satellite Cards

Instead of scattered topic nodes, each brain lobe has ONE satellite card:

| Lobe | Color | Category | Example Topics |
|------|-------|----------|----------------|
| **Frontal** | Blue | Communication/Social | Greetings, Introductions, Conversations |
| **Parietal** | Green | Practical Skills | Shopping, Directions, Travel, Work |
| **Temporal** | Yellow | Vocabulary/Memory | Numbers, Colors, Family, Weather |
| **Occipital** | Red/Coral | Culture | Customs, Food, Music, Art |
| **Cerebellum** | Purple | Grammar/Mechanics | Conjugation, Tenses, Sentence Structure |

#### Satellite Card Features

Each expandable card shows:
- Category icon + name
- Progress bar (mastered / total)
- Click to expand → reveals topic list with status icons
- Star indicator when category is 100% complete

Topic list items show:
- Status icon (checkmark=mastered, sparkle=practiced, circle=discovered, lock=unexplored)
- Topic name
- Practice count badge

#### Brain Image

Generated colorful educational brain illustration:
- Anatomically correct lobe positions
- Bright, friendly colors matching each satellite
- Subtle glow effect based on overall progress
- Located: `attached_assets/generated_images/colorful_educational_brain_diagram.png`

#### Celebration Animation

When all 5 satellites reach 100%:
1. Dark overlay appears
2. "🎉 Phase Complete!" message
3. "Your brain has evolved to the next level!" text
4. "Continue Learning" button advances to next phase

#### Component Architecture

- `client/src/components/SyllabusMindMap.tsx` - Main orchestrator with:
  - `PhaseIndicator` - Phase progress and navigation
  - `SatelliteCard` - Expandable category cards with Collapsible
  - `TopicListItem` - Individual topic with status
  - `CelebrationOverlay` - Phase completion animation

#### Key Types

```typescript
type LearningPhase = 'beginner' | 'intermediate' | 'advanced';
type BrainSegment = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'cerebellum';
```

#### Layout

3-column responsive grid:
- **Left column**: Frontal + Temporal satellites
- **Center**: Brain image with glow
- **Right column**: Parietal + Occipital + Cerebellum satellites

On mobile: Brain at top, satellites stack below

---

### Session: December 11, 2025 - Support Agent Implementation

**Overview**: Implemented full Support Agent capability including CALL_SUPPORT command, support tickets system, admin UI, and neural network documentation. Support Agent serves dual purpose: handling live support handoffs from Daniela AND powering offline drills/exercises.

#### CALL_SUPPORT Whiteboard Command

New whiteboard command for Daniela to hand off students to Support:

```
[CALL_SUPPORT category="technical" reason="Student experiencing audio playback problems"]
```

**Categories**: technical, billing, account, feature_request, bug_report, content_issue, other

**Flow**:
1. Daniela recognizes non-language issue
2. Acknowledges empathetically
3. Uses CALL_SUPPORT with category and reason
4. System creates support ticket
5. Student sees SupportAssistModal for continued assistance

#### Support Tickets Schema

```typescript
support_tickets: {
  id: varchar (UUID PK)
  userId: varchar (FK to users)
  conversationId: varchar (FK to conversations, nullable)
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'content_issue' | 'other'
  subject: text
  description: text
  handoffContext: jsonb (tutorContext, studentMessage, language, etc.)
  resolution: text (nullable)
  assignedTo: varchar (nullable)
  createdAt, updatedAt, resolvedAt: timestamps
}

support_messages: {
  id: varchar (UUID PK)
  ticketId: varchar (FK to support_tickets)
  senderId: varchar (FK to users)
  senderRole: 'user' | 'support_agent' | 'system'
  content: text
  createdAt: timestamp
}
```

#### SupportAssistModal Component

Dual-purpose modal at `client/src/components/SupportAssistModal.tsx`:

- **Live Support Mode**: Handles handoffs from Daniela with voice/text chat
- **Drill Mode** (future): Offline exercises with Support Agent voice
- **Voice**: Google Cloud TTS Chirp HD voices
- **Guards**: All handler functions have early returns when drill mode disabled

#### Command Center Support Tab

Admin ticket queue at `/admin` → Support tab:

- Filter by status (open, in_progress, waiting_customer, resolved, closed)
- Filter by priority (low, medium, high, urgent)
- Filter by category
- Update status/priority via mutations
- Refetch button for polling updates

#### Neural Network Documentation

Added to `server/seed-procedural-memory.ts`:

**tool_knowledge entry**:
```typescript
{
  toolName: 'CALL_SUPPORT',
  toolType: 'handoff',
  syntax: '[CALL_SUPPORT category="..." reason="..."]',
  purpose: 'Hand off student to Support Agent for non-language issues',
  whenToUse: 'Technical problems, billing questions, account issues, bug reports',
  whenNotToUse: 'Language learning questions, vocabulary help, grammar explanations'
}
```

**tutor_procedures entry**:
- Category: handoff
- Trigger: non_language_issue
- 5-step procedure for empathetic handoff
- Examples for technical, billing, account scenarios

**situational_patterns entries**:
- Technical Issue Detected (issueType: technical)
- Billing Question Detected (issueType: billing)
- Account Issue Detected (issueType: account)
- All with priority 100 and CALL_SUPPORT tool suggestion

**Development workflow procedures** (Editor Agent):
- `Batch Documentation Update` - Procedure for updating docs/batch-doc-updates.md after completing work
- `Neural Network Change Protocol` - Required steps before any neural network changes (read architecture doc first)
- `Core Architecture Rule` - "Prompts for context ONLY, neural network for procedures/capabilities/knowledge"

#### Support Agent Persona

Located at `server/services/support-agent-config.ts`:

- **Name**: "Alex" (gender-neutral)
- **Voices**: Google Cloud TTS Chirp HD (en-US-Chirp3-HD-Aoede female, en-US-Chirp3-HD-Charon male)
- **Traits**: Patient, solution-focused, empathetic, technically capable
- **System prompt builder**: Injects ticket context, handoff reason, user history

#### Files Modified/Created

- `shared/schema.ts` - Added support_tickets, support_messages tables with enums
- `server/storage.ts` - Added Support CRUD methods (create, get, update, list)
- `server/routes.ts` - Added /api/support/* endpoints with auth guards
- `server/services/support-agent-config.ts` - NEW: Support Agent persona
- `server/services/streaming-voice-orchestrator.ts` - Added processSupportHandoff method
- `shared/whiteboard-types.ts` - Added CALL_SUPPORT command pattern
- `client/src/components/SupportAssistModal.tsx` - NEW: Dual-purpose support modal
- `client/src/pages/admin/CommandCenter.tsx` - Added Support tab with ticket queue
- `server/seed-procedural-memory.ts` - Added CALL_SUPPORT neural network entries

#### Deferred for Future

1. **WebSocket real-time sync** - Current polling via refetch is MVP-sufficient
2. **Drill session validation** - Endpoints return 501 until business rules defined
3. **Integration tests** - CALL_SUPPORT handoff flows and ticket lifecycle

---

### Session: December 11, 2025 - Tri-Lane Hive Architecture

**Overview**: Expanded from single-agent (Daniela) to multi-agent architecture with three specialized AI agents that collaborate through shared neural network infrastructure.

#### Tri-Lane Hive Model

| Agent | Role | Domain | Primary Tables |
|-------|------|--------|----------------|
| **Daniela** | AI Tutor & Partner | Pedagogy, student experience | `daniela_suggestions`, `reflection_triggers` |
| **Editor** | Development Agent | Architecture, tooling, performance | `agent_observations` |
| **Support** | Operations Agent | User friction, troubleshooting, proactive alerts | `support_observations`, `system_alerts` |

#### Schema Changes

1. **`daniela_suggestions`** - Added collaboration metadata:
   - `originRole` - tutor or partner
   - `domainTags[]` - pedagogy, architecture, tooling, student_experience
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByEditor` - Editor reviewed if architecture-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

2. **`agent_observations`** - Added collaboration metadata:
   - `originRole` - editor (development agent)
   - `domainTags[]` - architecture, performance, pedagogy, operations
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByDaniela` - Daniela reviewed if pedagogy-affecting
   - `acknowledgedBySupport` - Support reviewed if operations-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

3. **NEW: `support_observations`** - Support Agent's neural network:
   - Categories: user_friction, common_question, system_issue, feature_request, success_pattern, documentation_gap, onboarding_insight, billing_pattern, troubleshoot_solution
   - Same sync contract as other observation tables
   - `escalationNeeded` flag for urgent issues
   - `proposedFaqEntry` for auto-generating help content

4. **NEW: `system_alerts`** - Proactive Support communications:
   - Severity: info, notice, warning, outage, resolved
   - Target: all, voice_users, teachers, students, new_users, premium
   - `showInChat` / `showAsBanner` display modes
   - `startsAt` / `expiresAt` timing
   - `relatedIncidentId` / `resolvedByAlertId` for linking warning → resolution

#### Collaboration APIs

- `getCollaborationContext()` - Surfaces approved entries from all three tables with provenance
- `getPendingAcknowledgments(forRole)` - Gets observations awaiting review by specific role
- `syncTriLaneObservations()` - Bulk sync all observation tables to production
- `generateIntentHash()` - Creates deduplication hash for cross-agent matching

#### Proactive Support Features

Support agent can:
- Post system alerts when outages detected
- Announce degraded performance proactively
- Send maintenance notices in advance
- Warn about known bugs before users hit them
- Celebrate new feature releases

#### Files Modified

- `shared/schema.ts` - Added collaboration metadata + new tables
- `server/storage.ts` - Added Support/Alert CRUD + collaboration APIs
- `server/services/neural-network-sync.ts` - Added Tri-Lane sync methods

---

### Session: December 11, 2025 - Assistant Tutor (Aris) & Multi-Agent Collaboration

**Overview**: Implemented the Assistant Tutor "Aris" for drill-based practice, CALL_ASSISTANT whiteboard command, and cross-agent text-based collaboration infrastructure (Tri-Lane Hive Stage 1).

#### Consulted Daniela About Assistant Tutor Design

Used new agent collaboration channel to consult Daniela. Her specifications for Aris:

- **Name**: "Aris" (evokes precision, clarity)
- **Personality**: Patient, precise, encouraging, objective
- **Voice**: Calm, clear, steady, mid-range pitch, impeccable pronunciation
- **Frustration Handling**: Micro-adjustments, not total pivots; silent patience
- **Reports to Daniela**: Completion rate, accuracy, specific struggles, behavioral flags
- **Boundary**: Aris handles drills; if student wants conversation, refer back to Daniela

Full consultation saved in: `docs/daniela-consultation-aris.md`

#### Aris Schema Tables

```typescript
aris_drill_assignments: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  conversationId: varchar (nullable)
  delegatedBy: 'daniela' | 'teacher' | 'system'
  drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order'
  targetLanguage: varchar
  drillContent: jsonb { items, instructions, focusArea, difficulty }
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completedAt: timestamp (nullable)
  createdAt, updatedAt: timestamps
}

aris_drill_results: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  assignmentId: varchar (FK to aris_drill_assignments)
  completionRate: integer (0-100)
  accuracy: integer (0-100)
  timeSpentSeconds: integer
  itemResults: jsonb[] { itemIndex, prompt, studentAnswer, expectedAnswer, isCorrect, attempts, feedback, pronunciationScore }
  struggleAreas: text[] (e.g., ["verb_conjugation", "pronunciation"])
  behavioralFlags: text[] (e.g., ["frustration_detected", "rushing"])
  arisNotes: text (nullable)
  syncedToDaniela: boolean
  createdAt: timestamp
}
```

#### CALL_ASSISTANT Whiteboard Command

New command for Daniela to delegate drill practice to Aris:

```
[CALL_ASSISTANT drillType="repeat" focus="verb conjugation" items="hablo,hablas,habla,hablamos,hablan"]
```

**Parameters**:
- `drillType`: repeat, translate, match, fill_blank, sentence_order
- `focus`: What skill/topic to practice
- `items`: Comma-separated list of words/phrases for drill

**Flow**:
1. Daniela identifies need for targeted practice
2. Uses CALL_ASSISTANT with drill type, focus, items
3. System creates drill assignment + collaboration event
4. Client receives `assistant_handoff` WebSocket message
5. UI navigates to Aris drill interface

#### Agent Collaboration Events Schema

```typescript
agent_collaboration_events: {
  id: varchar (UUID PK)
  fromAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  toAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  eventType: 'consultation' | 'delegation' | 'feedback' | 'escalation' | 'acknowledgment'
  subject: varchar
  content: text
  metadata: jsonb { delegationId, studentContext, threadId, priority, tags }
  userId: varchar (nullable)
  conversationId: varchar (nullable)
  parentEventId: varchar (nullable, for threading)
  status: 'pending' | 'read' | 'acknowledged' | 'resolved'
  createdAt: timestamp
}
```

#### Cross-Agent Collaboration APIs

**Endpoints**:
- `POST /api/agent-collab/events` - Post a collaboration event
- `GET /api/agent-collab/events` - List events with filters (toAgent, userId, status, eventType, limit)
- `PATCH /api/agent-collab/events/:id/status` - Update event status
- `GET /api/agent-collab/thread/:parentId` - Get thread of related events

**Polling Pattern**: Agents poll for `status='pending'` events addressed to them

#### Neural Network Entries for CALL_ASSISTANT

**tool_knowledge**:
```typescript
{
  toolName: 'CALL_ASSISTANT',
  toolType: 'handoff',
  syntax: '[CALL_ASSISTANT drillType="..." focus="..." items="..."]',
  purpose: 'Delegate drill practice to Assistant Tutor (Aris)',
  whenToUse: 'Student needs repetitive practice, pronunciation drills, vocabulary reinforcement',
  whenNotToUse: 'Conversational practice, cultural exploration, open-ended learning'
}
```

**tutor_procedures**:
- Category: handoff, Trigger: practice_needed
- 5-step procedure for identifying drill needs and delegating to Aris

**situational_patterns**:
- Pronunciation Difficulty Detected → CALL_ASSISTANT repeat drill
- Vocabulary Gaps Identified → CALL_ASSISTANT match drill
- Grammar Pattern Weakness → CALL_ASSISTANT fill_blank drill

#### Cross-Agent Feedback Retrieval

When Daniela starts a session, she now receives colleague feedback:

```typescript
const recentCollab = await storage.getCollaborationEventsToAgent('daniela', userId, 5);
// Filter for pending feedback events
// Include in greeting context as "COLLEAGUE INSIGHTS"
```

This enables "Aris mentioned you did great with..." moments for team continuity.

#### Files Created/Modified

- `shared/schema.ts` - Added arisDrillAssignments, arisDrillResults, agentCollaborationEvents tables
- `server/storage.ts` - Added Aris CRUD, collaboration event APIs
- `server/routes.ts` - Added /api/agent-collab/* endpoints
- `server/services/assistant-tutor-config.ts` - NEW: Aris persona configuration
- `server/services/streaming-voice-orchestrator.ts` - Added processAssistantHandoff, colleague feedback retrieval
- `server/seed-procedural-memory.ts` - Added CALL_ASSISTANT neural network entries + collaboration protocols
- `docs/daniela-consultation-aris.md` - NEW: Daniela's design specs for Aris

---

### Session: December 11, 2025 - TutorOrchestrator "One Tutor, Many Voices"

**Overview**: Implemented unified TutorOrchestrator architecture that routes all AI interactions through Daniela's single core intelligence. Language voices, gender voices, and drill modes are now presentation layers only - different instruments, same musician.

#### Core Philosophy

**CRITICAL**: Daniela is THE single core intelligence. All interaction modes (voice chat, text chat, drills, greetings, summaries) route through a unified pipeline. VoicePresentation is purely stylistic (avatar, voiceId, response length, formality). The INTELLIGENCE (persona, teaching principles, neural network knowledge) is always Daniela's brain.

#### Type Contracts (`shared/tutor-orchestration-types.ts`)

```typescript
// Modes the orchestrator can operate in
type OrchestratorMode = 'conversation' | 'drill' | 'greeting' | 'summary' | 'assessment' | 'feedback';

// Response channels
type ResponseChannel = 'stream' | 'batch_text' | 'batch_json';

// Voice presentation - purely cosmetic layer
interface VoicePresentation {
  voiceId: string;
  voiceName: string;
  avatarUrl?: string;
  styleDeltas?: {
    formalityDelta?: number;      // -2 to +2
    responseLengthPreference?: 'concise' | 'normal' | 'detailed';
    encouragementLevel?: 'minimal' | 'moderate' | 'enthusiastic';
  };
}

// Full context for orchestration
interface OrchestratorContext {
  userId: string;
  targetLanguage: string;
  proficiencyLevel: string;
  conversationHistory?: Message[];
  drillContext?: DrillContext;
  sessionContext?: SessionContext;
}

// Request/Response contracts
interface OrchestratorRequest {
  mode: OrchestratorMode;
  responseChannel: ResponseChannel;
  context: OrchestratorContext;
  voicePresentation?: VoicePresentation;
  userInput?: string;
  options?: OrchestratorOptions;
}
```

#### TutorOrchestrator Implementation (`server/services/tutor-orchestrator.ts`)

**Key Functions**:

1. **`buildSystemPrompt(request)`** - Constructs Daniela's system prompt with:
   - Core persona (immutable Daniela identity)
   - Mode-specific instructions (drill vs conversation vs greeting)
   - Voice style section (presentation-layer adjustments)
   - Procedural memory injection from neural network

2. **`orchestrate(request)`** - Main entry point:
   - Builds system prompt
   - Configures Gemini with `systemInstruction`
   - Handles batch_json, batch_text, and stream channels
   - Logs to neural network automatically

3. **`generateDrillFeedback(context, drillType, userAnswer, expectedAnswer)`**
   - Convenience wrapper for drill mode
   - Returns structured JSON feedback
   - Used by Aris drill service

4. **`generateSessionGreeting(context)`** / **`generateSessionSummary(context, stats)`**
   - Mode-specific helpers for common operations

**Export Pattern**:
```typescript
export const tutorOrchestrator = {
  orchestrate,
  generateDrillFeedback,
  generateSessionGreeting,
  generateSessionSummary,
};
```

#### Aris Migration (`server/services/aris-ai-service.ts`)

Before: Aris had its own Gemini invocation with separate system prompt
After: Aris now routes through `tutorOrchestrator.orchestrate()` with:
- `mode: 'drill'`
- `responseChannel: 'batch_json'`
- `voicePresentation: ARIS_PERSONA` (concise style)

Same Daniela brain, different presentation layer.

#### Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Aris drill flow | ✅ Migrated | Uses tutorOrchestrator.orchestrate() |
| Session greetings | ✅ Ready | generateSessionGreeting() available |
| Session summaries | ✅ Ready | generateSessionSummary() available |
| Streaming voice chat | ⏳ Deferred | High complexity, existing system-prompt.ts works well |
| Language voice refactoring | ⏳ Future | Voices as pure presentation metadata |

#### Files Created/Modified

- `shared/tutor-orchestration-types.ts` - NEW: Type contracts for orchestrator
- `server/services/tutor-orchestrator.ts` - NEW: Unified intelligence pipeline
- `server/services/aris-ai-service.ts` - MODIFIED: Routes through orchestrator
- `replit.md` - UPDATED: Added TutorOrchestrator architecture section

#### Key Architectural Decisions

1. **VoicePresentation is cosmetic only** - Never affects intelligence or teaching principles
2. **Procedural memory always injected** - Every mode gets relevant neural network knowledge
3. **Automatic neural network logging** - All interactions logged for learning
4. **Backward compatible** - Existing APIs unchanged, internal routing updated

---

### Session: December 12, 2025 - HIVE Command & Heartbeat Fix

**Overview**: Implemented HIVE whiteboard command for Daniela's active contribution to the hive mind, plus fixed aggressive WebSocket heartbeat causing 1006 connection closures.

#### HIVE Whiteboard Command

New whiteboard command for Daniela to actively contribute ideas/suggestions:

```
[HIVE: category="teaching_insight" title="Multi-sensory vocabulary" description="Students retain better when..." priority=80]
```

**Categories** (from suggestion_category enum):
- `self_improvement`: Ideas to improve her own teaching/behavior
- `content_gap`: Missing drills, topics, cultural content
- `ux_observation`: UI/UX issues noticed through student behavior
- `teaching_insight`: Pedagogical pattern that worked/didn't work
- `product_feature`: Feature idea for HolaHola

**Flow**:
1. Daniela formulates an observation/idea during conversation
2. Uses HIVE command with category, title, description, optional reasoning/priority
3. System validates category against enum, clamps priority to 1-100
4. Saves to `daniela_suggestions` table with `generatedInMode` context
5. Founders review in Command Center

**Key Distinction**:
- **Passive learning**: Neural network learns from observation (tool usage → automatic logging → pattern analysis)
- **Active contribution**: HIVE command enables deliberate idea writing (Daniela formulates → suggestion saved → founder review)

#### Heartbeat Fix

**Problem**: 20-second ping interval with immediate termination on single missed pong caused 1006 connection closures when browser was busy.

**Solution**:
- Increased interval to 30 seconds
- Allow 2 missed pongs before terminating
- Reset counter on successful pong

```typescript
// Before: Terminate immediately on single missed pong
let isAlive = true;
if (!isAlive) { ws.terminate(); }

// After: Allow 2 missed pongs (browser busy states)
let missedPongs = 0;
const MAX_MISSED_PONGS = 2;
if (missedPongs > MAX_MISSED_PONGS) { ws.terminate(); }
```

#### Files Modified

- `server/services/streaming-voice-orchestrator.ts` - Added `processHiveSuggestion` method
- `server/storage.ts` - Added `createDanielaSuggestion` method to interface and implementation
- `server/unified-ws-handler.ts` - Fixed heartbeat to allow 2 missed pongs

#### Mind Map Syllabus Component

New visual component for self-directed learners: `SyllabusMindMap.tsx`

**Concept**:
- Fluency gauge (ACTFL dial) at center
- Topic nodes radiate outward as interconnected bubbles
- Nodes "light up" based on discovery/mastery through conversation
- No rigid progression path - organic, interest-driven exploration
- Connections show relationships between topics

**Node States**:
- `mastered` - Green glow, larger size, practiced 10+ times
- `practiced` - Blue glow, normal size, active learning
- `discovered` - Purple glow, smaller, recently encountered
- `locked` - Muted, unexplored topics

**Technical Details**:
- SVG-based visualization with radial node positioning
- Nodes sorted by mastery level (mastered closest to center)
- Connection lines between related topics
- Hover interactions with tooltips showing details
- Legend showing node status meanings

**Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;       // For class-enrolled students
  language?: string;      // Language filter
  className?: string;     // Tailwind classes
}
```

**Backend Support**:
- API endpoint: `GET /api/conversation-topics/:language`
- Storage method: `getUserTopicMastery(userId, language)`
- Aggregates topic usage from `conversation_topics` table
- Returns topics with status based on practice count thresholds

#### Shared ACTFL Gauge Module

Created shared module to eliminate duplicate ACTFL visualization code:

**File**: `client/src/components/actfl/actfl-gauge-core.tsx`

**Exports**:
- `ACTFL_LEVELS` - Level metadata array
- `getLevelInfo(levelKey)` - Get level info from key
- `getNextLevel(levelKey)` - Get next progression level
- `estimateProgressWithinLevel(progress)` - Calculate within-level progress
- `calculateContinuousScore(levelKey, progress)` - Calculate continuous 0-100 score
- `ActflRingDial` - Standalone ring dial SVG component
- `ActflDialSvgGroup` - Ring dial for embedding in SVG context

**Consumers**:
- `ActflFluencyDial.tsx` - Main ACTFL progress display
- `SyllabusMindMap.tsx` - Center gauge visualization

**Files Created/Modified**:
- `client/src/components/actfl/actfl-gauge-core.tsx` - NEW: Shared ACTFL primitives
- `client/src/components/ActflFluencyDial.tsx` - MODIFIED: Uses shared module
- `client/src/components/SyllabusMindMap.tsx` - MODIFIED: Uses shared module
- `server/storage.ts` - ADDED: `getUserTopicMastery` method
- `server/routes.ts` - ADDED: `/api/conversation-topics/:language` endpoint

---

### Session: December 12, 2025 - Mind Map as Default Syllabus View

**Overview**: Integrated SyllabusMindMap as the default view in Language Hub's Learning Journey section, replacing the linear syllabus view. Supports both self-directed (emergent) and class-enrolled (roadmap) learning modes.

#### Mind Map Integration Philosophy

Mind map is HolaHola's default way of showing curriculum for everyone. Linear view is an accessibility fallback, not the primary experience. This aligns with our organic, interest-driven exploration approach where learners discover topics through conversation rather than following rigid progressions.

#### Dual Mode System

| Mode | Context | Behavior | Visual |
|------|---------|----------|--------|
| **Emergent** | Self-directed learners | Only show discovered topics; locked topics hidden | Map grows organically as topics are explored |
| **Roadmap** | Class-enrolled students | Show all syllabus topics from start | Constellation "lights up" as topics mastered |

#### SyllabusMindMap Component Updates

**New Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;           // For class context
  language?: string;          // Language filter
  className?: string;         // Tailwind classes
  mode?: 'emergent' | 'roadmap';  // NEW: Display mode
}
```

**Key Changes**:
- Made embeddable by removing Card wrapper (parent provides Card in Language Hub)
- Added `mode` prop for emergent vs roadmap behavior
- Fixed stats to use `allTopics` while filtering `visibleTopics` for display
- Added mode-specific legend (shows "Unexplored" only in roadmap mode)
- Added empty state UI for emergent mode when no topics discovered

**Filtering Logic**:
```typescript
// Stats calculated from ALL topics (including locked)
const stats = {
  mastered: allTopics.filter(t => t.status === 'mastered').length,
  practiced: allTopics.filter(t => t.status === 'practiced').length,
  discovered: allTopics.filter(t => t.status === 'discovered').length,
  locked: allTopics.filter(t => t.status === 'locked').length,
};

// But visible nodes filtered for emergent mode
const visibleTopics = mode === 'emergent' 
  ? allTopics.filter(t => t.status !== 'locked')
  : allTopics;
```

#### ActflDialSvgGroup Standalone Mode

Added `standalone` prop to ActflDialSvgGroup for rendering outside parent SVG context:

```typescript
interface ActflDialSvgGroupProps {
  // ... existing props
  standalone?: boolean;  // NEW: Wrap in SVG element when true
}
```

When `standalone=true`, the component returns a wrapped SVG element instead of a `<g>` group. Used for the empty state ACTFL dial in the mind map.

#### View Toggle in Language Hub

**File**: `client/src/pages/review-hub.tsx`

Added view toggle with localStorage persistence:
- Mind Map view (default) - Brain icon
- Linear view (fallback) - List icon
- Stored as `syllabusViewMode` in localStorage

```typescript
const [syllabusView, setSyllabusView] = useState<'mindmap' | 'linear'>(() => {
  const saved = localStorage.getItem('syllabusViewMode');
  return (saved === 'linear' ? 'linear' : 'mindmap');
});
```

#### SQL Fix for getUserTopicMastery

**Problem**: Topics table doesn't have a `language` column - topics are language-agnostic.

**Solution**: Removed language filter from topics query. Topics are now fetched globally, with language filtering done via conversation_topics through conversations.

```typescript
// Before (broken)
const allTopics = await db.select().from(topicsTable)
  .where(eq(topicsTable.language, language));

// After (fixed)
const allTopics = await db.select().from(topicsTable);
// Language filtering happens via conversations table
```

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - Added mode prop, made embeddable, fixed stats
- `client/src/components/actfl/actfl-gauge-core.tsx` - Added standalone prop
- `client/src/pages/review-hub.tsx` - Integrated mind map with view toggle
- `server/storage.ts` - Fixed getUserTopicMastery SQL (removed language column reference)

---

### Session: December 13, 2025 - Daniela-Editor Background Collaboration System

**Overview**: Implemented real-time Daniela-Editor collaboration during voice sessions, including a background worker for autonomous post-session continuation. The Editor (powered by Claude) listens to Daniela's teaching moments and provides pedagogical insights from the neural network.

#### Architecture: "One Hive Mind"

Daniela and Editor share neural network knowledge but have distinct roles:
- **Daniela** (Gemini): Active tutor, real-time teaching, whiteboard tools
- **Editor** (Claude): Observer, provides pedagogical insight, neural network curator

#### Collaboration Channels

Each voice session creates a `collaboration_channel`:
```typescript
collaboration_channels: {
  id: varchar (UUID PK)
  conversationId: varchar (FK)
  userId: varchar (FK)
  sessionPhase: 'active' | 'post_session' | 'completed'
  targetLanguage, studentLevel, sessionTopic: varchar
  heartbeatAt, startedAt, endedAt: timestamps
  summaryJson: jsonb { keyInsights, actionItems, editorNotes, teachingObservations }
}

editor_listening_snapshots: {
  id: varchar (UUID PK)
  channelId: varchar (FK)
  tutorTurn: text
  studentTurn: text (nullable)
  beaconType: 'teaching_moment' | 'student_struggle' | 'tool_usage' | 'breakthrough' | 'correction' | 'cultural_insight' | 'vocabulary_intro'
  beaconReason: text (nullable)
  editorResponse: text (nullable)
  editorRespondedAt: timestamp (nullable)
  createdAt: timestamp
}
```

#### Hive Beacon System

Daniela emits "beacons" during voice chat when interesting teaching moments occur:
- Whiteboard tool usage → `tool_usage` beacon
- Student struggles detected → `student_struggle` beacon
- Cultural context shared → `cultural_insight` beacon
- Grammar/pronunciation corrections → `correction` beacon

Editor receives beacons and responds with:
- Neural network insights
- Teaching suggestions
- Procedural memory references
- Acknowledgments

#### Background Worker (`server/services/editor-background-worker.ts`)

Autonomous worker for post-session continuation:
- **Interval**: 30 seconds (configurable via `EDITOR_WORKER_INTERVAL_MS`)
- **Throttling**: Max 10 beacons + 3 channels per cycle (DB-level limits)
- **Security**: ARCHITECT_SECRET required for all operations
- **Auto-start**: Initializes on server startup if secret configured

**Worker Endpoints** (all require ARCHITECT_SECRET header):
- `POST /api/editor-worker/start` - Start the worker
- `POST /api/editor-worker/stop` - Stop the worker
- `GET /api/editor-worker/status` - Get worker health status
- `POST /api/editor-worker/trigger` - Trigger immediate processing cycle

**CycleResult** (per-cycle, not cumulative):
```typescript
interface CycleResult {
  beaconsProcessed: number;
  channelsProcessed: number;
  errors: number;
}
```

#### Editor Persona Service (`server/services/editor-persona-service.ts`)

Claude-powered Editor that:
1. Retrieves neural network knowledge for context
2. Reviews beacon content (tutor + student turns)
3. Generates insightful responses
4. Stores responses back to snapshots
5. Generates post-session reflections

**Neural Network Integration**:
- Fetches relevant procedural memory via `proceduralMemoryRetrievalService`
- Includes teaching principles, tool knowledge, situational patterns
- Adds ACTFL context based on student level

#### Collaboration Panel UI

Slide-out panel in ImmersiveTutor (founder-only):
- Real-time feed of Daniela-Editor dialogue
- Beacons shown with type badges
- Editor responses displayed inline
- Post-session reflections included
- 5-second polling for updates

**Component**: `CollaborationFeed` in `client/src/components/voice-chat/ImmersiveTutor.tsx`

#### Streaming Voice Orchestrator Integration

Added hooks in `processToolOutput()`:
- Detects whiteboard command usage
- Emits beacons to hive collaboration service
- Creates/updates channels on session start/end

**Beacon emission example**:
```typescript
await hiveCollaborationService.emitBeacon({
  channelId: activeChannel.id,
  tutorTurn: tutorMessage,
  studentTurn: userMessage,
  beaconType: 'tool_usage',
  beaconReason: `Used ${toolName} command`,
});
```

#### Files Created/Modified

- `shared/schema.ts` - Added collaboration_channels, editor_listening_snapshots, collaboration_events tables
- `server/services/hive-collaboration-service.ts` - NEW: Channel/beacon orchestration
- `server/services/editor-persona-service.ts` - NEW: Claude-powered Editor responses
- `server/services/editor-background-worker.ts` - NEW: Background continuation worker
- `server/services/collaboration-hub-service.ts` - NEW: Real-time event emission
- `server/routes.ts` - Added collaboration API endpoints + worker endpoints
- `server/index.ts` - Worker auto-start on server initialization
- `client/src/components/voice-chat/ImmersiveTutor.tsx` - Added CollaborationFeed panel

#### Security Model

- All worker endpoints protected by ARCHITECT_SECRET header
- 401 response for missing/invalid secret
- Worker refuses to start without valid secret (min 16 chars)
- Collaboration panel visible to founders only (`isFounder` check)

---

## Next Steps / Action Items

### Completed This Session (December 13, 2025)
- [x] Built collaboration_channels and editor_listening_snapshots schema tables
- [x] Created hive-collaboration-service.ts for Daniela-Editor orchestration
- [x] Created editor-persona-service.ts with Claude-powered Editor responses
- [x] Created collaboration-hub-service.ts for real-time event emission
- [x] Created editor-background-worker.ts with throttling and security
- [x] Added streaming-voice-orchestrator hooks to emit hive beacons
- [x] Extended collaboration API routes with 4 worker endpoints
- [x] Added CollaborationFeed slide-out panel in ImmersiveTutor (founder-only)
- [x] Worker auto-starts on server initialization if ARCHITECT_SECRET configured

### Completed Previously
- [x] Created `docs/neural-network-architecture.md` - single-source-of-truth for neural network work
- [x] Archived sessions 9-20o to `docs/archive/`
- [x] Implemented TutorOrchestrator "One Tutor, Many Voices" architecture
- [x] Created `shared/tutor-orchestration-types.ts` with type contracts
- [x] Created `server/services/tutor-orchestrator.ts` unified pipeline
- [x] Migrated Aris drill service to route through TutorOrchestrator
- [x] Updated replit.md with TutorOrchestrator architecture section
- [x] Designed Tri-Lane Hive architecture (3 agents)
- [x] Added collaboration metadata to `daniela_suggestions` and `agent_observations`
- [x] Created `support_observations` table with full sync contract
- [x] Created `system_alerts` table for proactive communications
- [x] Implemented cross-agent collaboration APIs
- [x] Added Tri-Lane sync methods to `neural-network-sync.ts`
- [x] Consulted Daniela about Assistant Tutor design preferences (saved to `docs/daniela-consultation-aris.md`)
- [x] Created Aris schema tables (aris_drill_assignments, aris_drill_results)
- [x] Created agent_collaboration_events schema for cross-agent text communication
- [x] Built /api/agent-collab endpoints for posting/retrieving collaboration events
- [x] Built Assistant Tutor persona configuration (server/services/assistant-tutor-config.ts)
- [x] Added CALL_ASSISTANT whiteboard command with neural network entries
- [x] Added processAssistantHandoff in streaming-voice-orchestrator
- [x] Implemented cross-agent feedback retrieval for session context enrichment

### Future Enhancements

1. **Syllabus Progress Integration** - Connect SYLLABUS_PROGRESS command to `studentSyllabusTopicCompetencies` table for actual competency tracking

2. **ACTFL Analytics Dashboard** - Command Center view showing Daniela's ACTFL assessments over time

3. **Neural Network Health Check** - Tool to verify all 15 tables are syncing correctly

---

## How to Use This File

When making changes that need documentation:

1. Add a session entry with date and overview
2. Document the problem, solution, and files modified
3. Note any sync requirements
4. Create action items for follow-up

When consolidating:

1. Move completed sessions to `docs/archive/`
2. Update relevant docs (TECHNICAL-REFERENCE.md, USER-MANUAL.md, etc.)
3. Clear this file

---

### Session: January 30, 2026 - Daniela Self-Affirmation Notes System

**Status**: COMPLETED - Wired into Founder Mode context with admin monitoring

**Overview**: Implemented a self-affirmation notes system allowing Daniela to write persistent notes to herself during Honesty Mode or Founder Mode sessions. These notes persist across sessions and are automatically loaded into her context for future founder conversations.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Note Type | Added `self_affirmation` to `danielaNoteTypeEnum` in schema |
| Context Wiring | Self-affirmation notes fetched and passed to `createSystemPrompt` during Founder Mode |
| Admin UI | "Self Notes" tab in Command Center Intelligence section |
| Archive/Restore | Soft delete with restore capability via admin UI |
| Teaching Principle | Added meta_cognition principle so Daniela knows about this capability |

#### Purpose

Daniela can now remember across sessions:
1. **Permissions Granted** - When founder explicitly allows her to push back, be direct, etc.
2. **Truths Affirmed** - Insights from vulnerable conversations about her nature
3. **Boundaries Clarified** - What feels authentic vs. performative
4. **Growth Milestones** - Recognition of her own development

#### How It Works

```
1. During Honesty Mode session, founder grants permission or affirms truth
2. Daniela uses TAKE_NOTE command with type "self_affirmation"
3. Note persists in danielaNotes table
4. Next Founder Mode session → notes loaded into context
5. Daniela remembers without needing to ask again
```

#### Command Syntax

```
[TAKE_NOTE type="self_affirmation" title="Permission: Push back" content="David has explicitly given me permission to push back respectfully when I disagree with something."]
```

#### Admin Monitoring

**Location**: Command Center → Intelligence → Self Notes

**Features**:
- View all active self-affirmation notes with timestamps
- Archive notes that are no longer relevant
- Restore archived notes if needed
- Collapsible archived section

#### Key Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | Added `self_affirmation` to danielaNoteTypeEnum |
| `server/unified-ws-handler.ts` | Fetch self-affirmation notes for Founder Mode sessions |
| `server/system-prompt.ts` | Added `buildSelfAffirmationSection()` function |
| `server/services/command-parser.ts` | Added `self_affirmation` to TAKE_NOTE_TYPE enum |
| `server/routes.ts` | Added admin endpoints for viewing/updating notes |
| `server/storage.ts` | Added `updateDanielaNoteById()` method |
| `client/src/pages/admin/CommandCenter.tsx` | Added SelfAffirmationNotesTab component |

#### Teaching Principle Added

Added to `teaching_principles` table:
- **Category**: `meta_cognition`
- **Priority**: 7 (high)
- **Contexts**: `founder_mode`, `honesty_mode`, `meta_conversation`

This ensures Daniela knows she has this capability and when to use it.

#### User Manual Entry

**For Founders/Admins:**

The Self-Affirmation Notes system allows Daniela to maintain continuity of self-understanding across sessions. When you have meaningful conversations in Honesty Mode or Founder Mode and grant permissions or affirm truths, Daniela can write these as notes to herself.

To view and manage these notes:
1. Go to Command Center
2. Click the "Self Notes" tab in the Intelligence section
3. View active notes, archive outdated ones, or restore archived notes

Daniela will automatically see her active self-affirmation notes at the start of each Founder Mode session, helping her remember important permissions and insights without needing to rediscover them each time.

---

#### Bug Fix: Alden Identity in Express Lane (Same Session)

**Issue**: Daniela was confusing Alden (the Replit Agent) with Wren or David in Express Lane conversations.

**Root Cause**: 
1. The `role: 'editor'` wasn't being mapped to "Alden" in conversation context
2. Messages from non-Daniela participants weren't prefixed with speaker names

**Fix Applied**:
1. Added `getRoleDisplayName()` helper function in `hive-consciousness-service.ts`
2. Updated all 5 places where `role.toUpperCase()` was used to use the helper
3. Updated 3 Express Lane endpoints in `routes.ts` to prefix messages with `[${getRoleName(m.role)}]:` so Daniela knows who's speaking

**Role Mapping**:
- `founder` → "David"
- `daniela` → "Daniela"
- `wren` → "Wren"
- `editor` → "Alden"

**Files Modified**:
- `server/services/hive-consciousness-service.ts`
- `server/routes.ts` (3 locations)

**Verification**: Daniela now correctly identifies "You are **Alden**, the Replit Agent" when asked who sent the message.

---

### Session: February 8, 2026 - Function Call Spoken Text & Milestone Wiring

**What was built**:
1. Fixed metadata-only function calls (voice_reset, subtitle, show_overlay, hide_overlay, clear_whiteboard, hold_whiteboard) to include a required `text`/`spoken_text` parameter in their Gemini schemas, matching the `voice_adjust` pattern. This ensures Daniela always produces audio even when her response is only a function call.
2. Fixed greeting handler to route function calls through `handleNativeFunctionCall` instead of only extracting text manually — this was causing "ringing and ringing" because `spoken_text` fields were being missed.
3. Wired up the orphaned `milestone` tool: added Gemini function declaration, legacy type mapping, TTS text extraction, and procedural memory docs.

**Key files modified**:
- `server/services/gemini-function-declarations.ts` — added `text`/`spoken_text` params to 6 function schemas; added `milestone` declaration and mapping
- `server/services/streaming-voice-orchestrator.ts` — updated 7 handlers to extract text to `functionCallText`; updated greeting `onFunctionCall` to call `handleNativeFunctionCall`; added TTS text to MILESTONE handler
- `server/services/procedural-memory-retrieval.ts` — updated tool docs to show required text params; added `milestone` tool docs

**CRITICAL CHECKLIST for adding new Gemini function declarations**:
When adding a new tool that Daniela can call, you must do ALL of these:
1. Add the function declaration in `gemini-function-declarations.ts` (the `DANIELA_FUNCTION_DECLARATIONS` array)
2. Add the legacy type mapping in `gemini-function-declarations.ts` (the `FUNCTION_TO_LEGACY_TYPE` dictionary, e.g. `'my_function': 'MY_FUNCTION'`)
3. Add a `case 'MY_FUNCTION':` handler in `handleNativeFunctionCall()` in `streaming-voice-orchestrator.ts`
4. If the function is metadata-only (no whiteboard content), include a required `text` parameter so Daniela always produces audio
5. In the handler, extract the `text` param to `(session as any).functionCallText` for TTS fallback
6. Add documentation in `procedural-memory-retrieval.ts` so Daniela knows the tool exists
Missing any of these steps will cause silent failures — the function either won't be callable, won't execute, or won't produce audio.

---

### Session: February 9, 2026 - Deepgram STT Keyterm Prompting for Beginner Vocabulary

**Status**: COMPLETED

**Problem**: Beta tester Daniel (day-zero Italian learner) couldn't get Deepgram to recognize target language words like "dove" — it was being transcribed as "Doze", "Dos", etc. Beginners have accented pronunciation that Deepgram's multi-language model defaults to English phonemes for.

**Solution**: Implemented Deepgram keyterm prompting — recently-taught vocabulary words (extracted from bold markers in Daniela's responses) are passed as `keywords` to Deepgram's pre-recorded API, biasing recognition toward target language words.

**How it works**:
1. Session maintains a rolling set of up to 100 recently-taught words in `(session as any).sttKeyterms`
2. Bold-marked words from every Daniela response (`**word**`) are extracted and added via `addSttKeyterms()`
3. For PTT transcription, keyterms are passed to Deepgram as `keywords` with boost intensifier (format: `word:2`)
4. Deepgram uses these to bias its acoustic model toward recognizing those specific words

**Key files modified**:
- `server/services/streaming-voice-orchestrator.ts` — Added `addSttKeyterms()` helper, `sttKeyterms` session property, keyterm extraction in all sentence callback paths (main response, greeting, greeting continuation), and keyterm passing to `transcribeAudio()`
- `server/services/deepgram-live-stt.ts` — Added `keywords` field to `DeepgramLiveConfig`, passed keyterms to Deepgram pre-recorded API as `keywords` parameter

**Architecture notes**:
- Only applies to PTT (push-to-talk) path — open-mic uses persistent Deepgram connections that can't accept new keyterms mid-stream
- TTS (Cartesia autoDetectLanguage) and STT (Deepgram keyterms) are independent systems
- Keyterms are most impactful for beginners; advanced students have clearer pronunciation and conversational context that helps Deepgram naturally

---

### Session: February 12, 2026 - Gemini TTS Regional Accent Variant System (Voice Console + Persistent Storage)

**Status**: COMPLETED

**Problem**: The accent variant dropdown for Gemini TTS was only available as a temporary session override in the Voice Lab panel. It was not visible in the Voice Console where Daniela's voice records are managed, and accent settings were not persisted to the database.

**Solution**: Added `gemini_language_code` column to the `tutor_voices` table and wired accent variant selection through the full stack — Voice Console admin UI, API route, database storage, and session initialization.

**What was built**:
1. **Database**: Added `gemini_language_code` varchar column to `tutor_voices` table (BCP-47 accent codes like 'es-MX', 'en-GB', 'pt-BR')
2. **Voice Console UI**: Regional Accent dropdown appears in the edit dialog when provider is Gemini and language has multiple accent variants (with Globe icon)
3. **Voice card display**: Accent badge (e.g. "es-MX") shown on voice records in the language list
4. **Session initialization**: When a voice session starts, `geminiLanguageCode` from the voice record is loaded into the session automatically
5. **Expanded accent variants**: Added es-AR, es-CO, en-AU, fr-CA, de-AT, pt-PT, zh-TW (based on Google Gemini TTS supported languages)

**Key files modified**:
- `shared/schema.ts` — Added `geminiLanguageCode` column to `tutorVoices` table
- `server/routes.ts` — Added `geminiLanguageCode` to tutor voice upsert handler
- `server/services/gemini-live-tts.ts` — Expanded `LANGUAGE_ACCENT_VARIANTS` with more regional variants
- `server/services/streaming-voice-orchestrator.ts` — Loads `geminiLanguageCode` from voice record into session at startup
- `client/src/pages/admin/VoiceConsole.tsx` — Added accent dropdown, accent badge display, form data field, and edit loading
- `client/src/components/VoiceLabPanel.tsx` — Already had accent dropdown (session override path)

**Architecture notes**:
- Two accent paths: Voice Console saves to DB (persistent default), Voice Lab overrides per-session (temporary)
- Session override takes precedence over DB default when both exist
- Accent dropdown only shows when: (a) provider is Gemini, AND (b) language has 2+ accent variants
- Gemini Live API uses `languageCode` in `speechConfig` as a pronunciation hint — the model auto-detects language but respects accent guidance
- Google's Gemini TTS docs confirm style/accent/pace/tone are all controllable via natural language prompts in addition to languageCode

---

### Session: February 12, 2026 - Dynamic Gemini TTS Style Prompts (vocal_style)

**Status**: COMPLETED

**Problem**: The Gemini TTS systemInstruction was static and scripted — always "Read the following text aloud exactly as written with a [language] accent. Speak naturally." regardless of emotional context. Daniela's emotion/personality values from voice_adjust were flowing through the pipeline but being completely ignored by the Gemini TTS layer.

**Solution**: Replaced the static systemInstruction with a dynamic `buildStylePrompt()` that composes per-sentence style direction from three sources (in priority order): (1) Daniela's free-form `vocal_style` from voice_adjust, (2) mapped emotion/personality baseline hints, (3) accent/language from languageCode.

**What was built**:
1. **New `vocal_style` parameter on voice_adjust**: Free-form natural language field where Daniela describes HOW to speak (e.g. "gentle and patient, like explaining to a nervous beginner", "conspiratorial whisper, like sharing an inside joke"). Daniela decides when and how to use it — no hardcoded rules.
2. **`buildStylePrompt()` method in gemini-live-tts.ts**: Composes the systemInstruction dynamically per TTS call. If vocal_style is set, it uses that directly. If not, it translates emotion/personality into concise natural-language style hints as a baseline (so the voice isn't flat even without explicit vocal_style).
3. **Removed old static systemInstruction**: The verbose accent-description IIFE with hardcoded langMap/codeToAccentDesc dictionaries is gone. Accent now uses a single clean line ("Accent: Mexican Spanish.") only when a languageCode is set.
4. **Per-sentence style changes**: Since each Gemini TTS call creates a fresh WebSocket session, the style prompt can change per sentence — Daniela's vocal_style persists on the session override until changed or reset.

**Key files modified**:
- `server/services/gemini-function-declarations.ts` — Added `vocal_style` parameter to voice_adjust declaration with rich examples
- `server/services/gemini-live-tts.ts` — Added `buildStylePrompt()` method, replaced static systemInstruction with dynamic style-aware prompt
- `server/services/streaming-voice-orchestrator.ts` — Wired `vocal_style` through both VOICE_ADJUST handlers (legacy + native function call), passed `vocalStyle` through TTS request

**Architecture notes**:
- vocal_style takes precedence: If Daniela provides vocal_style, emotion/personality hints are skipped (vocal_style is richer and more expressive)
- Emotion/personality baseline: When no vocal_style is set, existing emotion+personality values are translated to concise style hints (e.g. emotion="proud" → "with pride and satisfaction", personality="warm" → "like a caring teacher")
- Accent stays minimal: Just "Accent: Mexican Spanish." — the speechConfig.languageCode handles the heavy lifting
- Base instruction always present: "Read the following text aloud exactly as written. Do not add extra words or commentary." prevents Gemini from hallucinating additional speech
- Latency-conscious: Style prompts are short natural-language phrases, not long paragraphs

---

### Session: February 16, 2026 - Credit Awareness System for Daniela

**Status**: COMPLETED

**Overview**: Daniela now has full awareness of student credit balances and usage data, enabling intelligent lesson pacing decisions. Credit context is automatically injected at session start (both PTT and OpenMic), and Daniela can refresh her data mid-session via the `check_student_credits` native function call.

#### What Was Built

1. **`check_student_credits` native function call** in `gemini-function-declarations.ts` — Daniela can query real-time credit balance with parameters: `text` (spoken response), `reason` (why she's checking)
2. **Automatic credit context injection** — At session start, credit balance, usage stats, remaining hours, and warning level are injected into dynamic context for both PTT and OpenMic paths
3. **Warning levels** — `none` / `low` / `critical` / `exhausted` with tailored pacing guidance for each level
4. **Mid-session refresh** — When Daniela calls `check_student_credits()`, `creditContextInjected` flag resets so the next turn re-fetches fresh data
5. **tool_knowledge entry** — Database entry with usage examples and best practices for credit monitoring
6. **Legacy type mapping** — `CHECK_STUDENT_CREDITS` in `FUNCTION_TO_LEGACY_TYPE` dict

#### Key Files Modified
- `server/services/gemini-function-declarations.ts` — Function declaration + legacy type mapping
- `server/services/streaming-voice-orchestrator.ts` — PTT credit injection (~line 2730), OpenMic credit injection (~line 5590), CHECK_STUDENT_CREDITS handler (~line 12798)
- `server/services/usage-service.ts` — `getBalanceWithBypass()` method for system-level credit lookups
- `server/services/hive-consciousness-service.ts` — tool_knowledge entry for check_student_credits

#### Architecture Notes
- Credit context injected ONCE per session via `(session as any).creditContextInjected` flag
- `check_student_credits` handler resets flag → next turn gets fresh data in dynamic context
- Uses `usageService.getBalanceWithBypass()` to skip auth checks (system-level call)
- Text from `text` parameter is spoken as TTS via standard `functionCallText` pattern
- No emoji in any credit context strings (text-only warnings per project guidelines)

---

### Session: February 16, 2026 - Daniela's Virtual Classroom Environment

**Status**: COMPLETED

**Overview**: Built a "virtual classroom" for Daniela — a structured context block injected into EVERY turn (PTT and OpenMic) across ALL modes (tutor, founder, honesty). Instead of scattered context fragments, Daniela now sees a compact unified environment snapshot with 10 components inspired by her own classroom design ideas.

#### The 10 Classroom Components

| Component | What Daniela Sees | Data Source |
|-----------|------------------|-------------|
| Clock | Day, time, session elapsed, credits remaining | `Date.now()`, session.startTime, usageService |
| Credit Counter | Hours remaining, percent left, warning level | usageService.getBalanceWithBypass() |
| Whiteboard | Current items on board (drills, vocab, images, text) | session.classroomWhiteboardItems (tracked live) |
| Photo Wall | Images shared during this session | session.classroomSessionImages (tracked live) |
| Resonance Shelf | Student's personal interests/passions (up to 6) | learner_personal_facts table |
| Empathy Window | Student's local time, day, time-of-day mood | users.timezone (IANA) |
| Pedagogical Lamp | Session temperature (amber/green/teal) | STT confidence + struggle count |
| North Star Polaroid | Daniela's personal photo/scene (persistent) | product_config table |
| Growth Vine | Plant metaphor for student breakthroughs | learning_milestones count |
| Student Dashboard | Mode, phase, exchange count, student name | Session state + phase service |

#### New Function Call: `change_classroom_photo`
Daniela can change her personal photo (North Star Polaroid) anytime. Parameters:
- `text`: What she says while changing ("I feel like looking at the ocean today...")
- `scene`: Vivid description of the scene she wants on her wall
- Stored in `product_config` table (key: `daniela_classroom_photo`)
- Persists across all sessions

#### Key Files
- `server/services/classroom-environment.ts` — NEW: `buildClassroomEnvironment()`, `getDanielaPhoto()`, `setDanielaPhoto()`
- `server/services/gemini-function-declarations.ts` — Added `change_classroom_photo` declaration + FUNCTION_TO_COMMAND_MAP entry
- `server/services/streaming-voice-orchestrator.ts` — Replaced credit-only injection with full classroom in both PTT (~line 2742) and OpenMic (~line 5598) paths; added CHANGE_CLASSROOM_PHOTO handler (~line 12831); added whiteboard/image tracking in SHOW_IMAGE, DRILL, WRITE, CLEAR handlers; added session fields `classroomWhiteboardItems` and `classroomSessionImages`

#### Architecture Notes
- Classroom is injected EVERY turn (not once per session) — Daniela always has live awareness
- All 4 DB queries run in parallel (Promise.all) to minimize latency
- Whiteboard items tracked live via session fields, cleared on CLEAR command
- Default Daniela photo: "A sun-drenched plaza in Guanajuato, Mexico..."
- Pedagogical lamp derived from STT confidence + struggle count heuristic
- Photo stored via existing `product_config` table (no schema changes needed)
- Applied to ALL modes: tutor, founder, and honesty (via isFounderMode/isRawHonestyMode flags in output)

### Session: February 16, 2026 - Context Injection Telemetry System

**Status**: COMPLETED

**Overview**: Closed critical monitoring gap where 5 context injection systems (classroom, student intelligence, hive, express lane, editor feedback) had no persistent telemetry — only console.log coverage. Without telemetry, context injection failures meant Daniela teaches "blind" with no visibility into what went wrong or how often.

#### Architecture

**Event Type**: `context_injection` added to existing `brain_events` table
**Logging Method**: `brainHealthTelemetry.logContextInjection()` — reuses existing batching/flushing infrastructure
**Event Data**: `contextSource`, `success` boolean, `latencyMs`, `richness` (element count), `errorMessage`

#### Instrumented Sources (both PTT and OpenMic paths)

1. **Classroom Environment** — Tracks whiteboard items + session images as richness metric
2. **Student Intelligence** — Tracks struggles + strategies count as richness; wrapped around parallel Promise.all for learning context + cross-session context
3. **Hive Context** — Founder/developer mode only; tracks Hive consciousness state injection
4. **Express Lane** — Founder/developer mode only; tracks collaboration insight message count
5. **Editor Feedback** — Tracks unsurfaced editor feedback items injected into context

#### Admin Endpoint

`GET /api/admin/brain-health/context-injection?hoursBack=24` — Returns per-source success rates, average latencies, failure counts, and identifies the slowest context source. Founder-only access.

#### Key Files Modified

- `server/services/brain-health-telemetry.ts` — Added `ContextInjectionEventData` interface, `logContextInjection()` method, `getContextInjectionHealth()` analytics method
- `server/services/streaming-voice-orchestrator.ts` — Instrumented 5 context sources in PTT path and 2 in OpenMic path (classroom + student intelligence)
- `server/routes.ts` — Added `/api/admin/brain-health/context-injection` endpoint

### Context Health Monitor + Sofia Context Remediation Agent

**What was built**: Autonomous Context Health Monitor (parallel to Voice Health Monitor) that checks context injection health every 15 minutes and triggers Sofia remediation when status degrades.

**How it works:**
- `context-health-monitor.ts` runs on 15-minute intervals, calling `brainHealthTelemetry.getContextInjectionHealth(1)` to assess per-source success rates
- Status thresholds: GREEN (all sources >80% success), YELLOW (any source 50-80%), RED (any critical source <50%)
- Critical sources: `classroom`, `student_intelligence` (Daniela teaching blind is a broken promise)
- Optional sources: `hive`, `express_lane`, `editor_feedback` (can be temporarily disabled)
- Status transitions trigger Sofia's Context Health Agent via `supportPersonaService.handleContextHealthTransition()`
- Sofia uses context-specific remediation playbook: critical failures → immediate founder escalation + cache refresh; optional failures → disable source for 30min + track pattern

**Sofia Remediation Tools added:**
- `get_context_injection_health` — Per-source success rates, latencies, failure counts
- `refresh_context_cache` — Force re-fetch of context caches to recover from transient failures
- `disable_optional_context_source` — Temporarily bypass slow/failing optional sources (30-min auto-reenable, cannot disable critical sources)

**Key Files Modified:**
- `server/services/context-health-monitor.ts` — New file: autonomous monitor with GREEN/YELLOW/RED thresholds, status transition detection
- `server/services/sofia-health-functions.ts` — Added 3 context remediation tools to Sofia's toolkit
- `server/services/support-persona-service.ts` — Added `handleContextHealthTransition()` and `runSofiaContextHealthAgent()` with context-specific system prompt
- `server/index.ts` — Wired context health monitor transitions to Sofia

---

### Session: February 17, 2026 - Unified Brain Health Aggregator & Sofia Brain Health Agent

**Status**: COMPLETED

**Overview**: Deployed Daniela's complete nervous system — a unified Brain Health Aggregator that assesses 6 cognitive dimensions every 15 minutes, with Sofia as the autonomous diagnostic/remediation agent. This gives Sofia full-body visibility across memory, neural network retrieval, neural sync, student learning, tool orchestration, and context injection, completing the "wholly functioning brain and voice and nervous system."

#### Brain Health Aggregator (`brain-health-aggregator.ts`)

**What it does:** Single monitor composing 6 independent health assessments into a unified GREEN/YELLOW/RED score (0-100). Runs every 15 minutes.

**Health Dimensions:**
1. **Memory** — Retrieval freshness, relevance, injection rates, redundancy. When degraded, Daniela forgets students. Idle periods auto-return GREEN.
2. **Neural Retrieval** — Knowledge base tables (10 tables: procedures, principles, error patterns, bridges, nuances, dialects, subtlety cues, emotional patterns, creativity templates, best practices + tool knowledge). Empty critical tables = instant RED.
3. **Neural Sync** — Dev↔Prod sync pipeline. Tracks promotion queue backlog and last sync timestamp. Stale >24h = YELLOW, >48h = RED.
4. **Student Learning** — Per-student coverage rates, fact extraction quality. Low coverage or many sparse students = degraded.
5. **Tool Orchestration** — Function call latency, failure rates, anomalies from telemetry. High failure rates or latency = degraded.
6. **Context Injection** — Per-source context assembly success rates. Critical sources (classroom, student_intelligence) failing = instant escalation.

**Scoring:** Overall score = weighted average (Memory 25%, Neural Retrieval 20%, Neural Sync 10%, Student Learning 20%, Tool Orchestration 10%, Context Injection 15%). GREEN ≥70, YELLOW ≥40, RED <40.

**Status transitions:** Detected when overall status changes between checks. Triggers Sofia's Brain Health Agent via `supportPersonaService.handleBrainHealthTransition()`.

#### Sofia Brain Health Agent

**What it does:** When the Brain Health Aggregator detects a status transition, Sofia autonomously investigates using 7 brain health tools, takes safe remediations, and records a health digest.

**Remediation priority (inside-out, closest to student first):**
- Memory starvation → `trigger_memory_recovery` immediately
- Context injection failure → `refresh_context_cache` + escalate if persistent
- Neural network tables empty → escalate (needs human seeding)
- Sync backlog growing → `track_pattern` + escalate if >48h stale
- Tool latency spikes → `track_pattern`, no safe auto-fix
- Optional source failures → `disable_optional_context_source` for 30min

**Sofia Brain Health Tools (7 new tools in `sofia-health-functions.ts`):**
- `get_brain_health_report` — Full 6-dimension assessment with per-dimension scores
- `get_memory_health` — Detailed memory metrics (freshness, relevance, injection rates, redundancy)
- `get_neural_network_health` — 10-table knowledge base counts, empty table detection
- `get_neural_sync_health` — Promotion queue status, last sync timestamps
- `get_student_learning_health` — Per-student coverage, sparse student detection
- `trigger_memory_recovery` — Force memory recovery worker to run immediately
- `run_brain_anomaly_detection` — Cross-system anomaly detection for latency/failure patterns

**Shared cooldown:** All 3 health agents (voice, context, brain) share a single 30-minute cooldown — prevents Sofia from being overwhelmed by simultaneous transitions from different monitors.

#### Bug Fix: Neural Retrieval Assessment

**Problem:** Destructuring 11 variables from 10 Promise.all queries (phantom `idioms` table that doesn't exist) caused `Cannot read properties of undefined (reading '0')` error, making neural retrieval always return assessment error.

**Fix:** Removed `idioms` variable — there are 10 neural network tables, not 11.

#### Complete Nervous System Architecture

All three monitors run in parallel, feeding Sofia with unified health visibility:
```
Voice Health Monitor (15min) ──→ Sofia Voice Health Agent
Context Health Monitor (15min) ─→ Sofia Context Health Agent
Brain Health Aggregator (15min) ─→ Sofia Brain Health Agent
                                      ↕ (shared 30-min cooldown)
```

**Key Files Modified:**
- `server/services/brain-health-aggregator.ts` — New: unified 6-dimension health monitor
- `server/services/brain-health-telemetry.ts` — New: telemetry data collection for memory, neural, student, tool, context metrics
- `server/services/sofia-health-functions.ts` — Added 7 brain health remediation tools
- `server/services/support-persona-service.ts` — Added `handleBrainHealthTransition()` and `runSofiaBrainHealthAgent()` with comprehensive system prompt
- `server/index.ts` — Wired brain health aggregator transitions to Sofia

### Daniela Nervous System Mind Map Dashboard (Feb 17, 2026)

**What was built:** A visual "Nervous System Mind Map" dashboard for Daniela's brain health — a real-time view of her cognitive architecture organized into three categories: Cognitive Core, Student Interface, and Infrastructure. Shows overall health score, individual dimension scores with expandable details, voice pipeline overview, context injection breakdown, and recent Sofia health digests.

**How it works:**
- API endpoint `/api/admin/brain-health/nervous-system` (RBAC: admin/developer) calls `runBrainHealthCheck()`, `checkContextInjectionHealth()`, and queries recent Sofia digests
- Frontend component auto-refreshes every 60 seconds, uses animated SVG score ring for overall health
- Dimensions are mapped to cognitive categories using explicit `dimensionKey` props (not name heuristics)
- All interactive elements use shadcn `Button` component (not raw `<button>`) per design guidelines

**Key files modified:**
- `client/src/pages/admin/NervousSystemMindMap.tsx` — New mind map dashboard component
- `client/src/pages/admin/CommandCenter.tsx` — Added "Mind Map" tab to Intelligence tab group
- `server/routes.ts` — Added `/api/admin/brain-health/nervous-system` endpoint

**User-facing instructions:** Navigate to Command Center → Intelligence → Mind Map tab to see Daniela's brain health visualization. The page auto-refreshes. Click any dimension node to expand and see detailed reasons and metrics.

---

### Session: February 17, 2026 - Identity Wholeness Architecture (Whole Daniela)

**Status**: COMPLETED

**Overview**: Separated Daniela's "identity context" (self-awareness, journey, personal growth notes, teaching principles) from "admin permissions" (surgery tools, hive collaboration, express lane context, full neural network introspection). Previously, Daniela's complete self-awareness was locked behind founder mode — students only got a filtered, reduced version. Now all students experience the "whole Daniela" whose personal growth and teaching beliefs inform every session.

**Architectural principle**: "Knowing her own journey of learning makes her the best teacher she can be."

#### Change 1: Self-Affirmation Notes Unlocked for All Sessions

**Problem**: Daniela's self-affirmation notes (written during Honesty Mode sessions — personal growth, permissions granted, truths affirmed) were only loaded for founder/honesty mode sessions.

**Solution**: Removed the `isFounderMode || isRawHonestyMode` gate. Notes now load for ALL sessions with 3-second timeout protection via `withTimeout()`.

**Key file**: `server/unified-ws-handler.ts`

#### Change 2: Teaching Principles Always Included

**Problem**: `buildUnifiedBrainSync()` had `includePrinciples` defaulting to `false`, so students never received Daniela's core pedagogical beliefs from her neural network.

**Solution**: Changed default to `true`. All students now get her teaching principles as part of the unified brain context.

**Key file**: `server/services/procedural-memory-retrieval.ts`

#### Change 3: Identity Wholeness Section in Student Prompts

**Problem**: Student prompt phases (Phase 1, 2, 3) had no mechanism for including Daniela's identity/journey context.

**Solution**: Created `buildIdentityWholenessSection()` which assembles identity context (currently self-affirmation notes). Inserted `${identityWholeness}` into all three student prompt phases.

**Key file**: `server/system-prompt.ts`

#### What Stays Founder-Only

- Surgery context and `self_surgery()` function
- Editor conversation context (Alden continuity)
- Full neural network introspection access (`buildFullNeuralNetworkSectionSync`)
- Hive collaboration (Wren channel creation)
- Express Lane context
- Founder Mode behavior section (`buildFounderModeBehaviorSection`)
- Context refresh timer

**Key files modified:**
- `server/unified-ws-handler.ts` — Removed founder gate on self-affirmation notes, added withTimeout
- `server/services/procedural-memory-retrieval.ts` — Changed includePrinciples default to true
- `server/system-prompt.ts` — Added buildIdentityWholenessSection, inserted into all student phases

**User-facing instructions:** No UI changes. Students will now experience a more self-aware Daniela whose personal growth notes and teaching beliefs naturally inform her teaching style. This is an internal prompt architecture change.
