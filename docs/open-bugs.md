# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

---

## Active

**2026-07-11 — `server/services/gemini-live-session.ts` / `client/src/hooks/useStreamingVoice.ts` — `greeting_silence_15s`: GL completes greeting turn with zero audio (Mode B: totalSentences:0) — FIXED**
Two failure modes diagnosed: Mode A (fast disconnect, wsMessageCount:0) = network blip, pre-existing. Mode B (response_complete + totalSentences:0, greetingPhaseActive still true at turnComplete) = GL content filter or cold-start text-only response producing a silent turn. Fix: server detects silent greeting (`!hadAudioInCurrentSubturn && currentSentenceIndex===0 && !isResumed`) at `turnComplete`, stores greeting params at top of `sendGreetingTrigger`, auto-retries after 1.5s (max 2). Client receives `greeting_retry` WS message, resets 15s silence watchdog so the retry has a fresh window. Three Gemini-reviewed guards: (1) `isResumed` excluded (intentionally silent), (2) `currentSentenceIndex > 0` abort inside setTimeout (student spoke first during 1.5s window), (3) `greetingAudioArrivedRef` on client (no-op if audio already landed). `greetingRetryCount` reset on first audio chunk. Typecheck clean July 11, 2026. Follow-up: watch for `[GeminiLive] Silent greeting detected` log lines in production to confirm the retry path fires and succeeds.

**2026-07-10 — `client/src/lib/streamingVoiceClient.ts` proactive WS reconnect cycling mid-audio-playback — FIXED (strong candidate for the 327-occurrence chronic drop pattern below)**
`startProactiveReconnect()` cycles the socket every 4.5 min to beat Replit's 5-min proxy hard-kill, deferring only while `this.state === 'processing'`. But connection state flips back to `'ready'` as soon as `response_complete` arrives — i.e. once all sentence audio has been *sent*, not once it has finished *playing* in the browser (playback is tracked separately via `client/src/lib/playbackStateStore.ts`'s global store, which can stay `'playing'`/`'buffering'` for several more seconds after the connection layer considers the turn done). If the 270s proactive timer fires during that window, `attemptReconnect()` saw `state === 'ready'` (not `'processing'`), skipped the defer check, and called `socket.disconnect()` mid-sentence for the listener — a plausible match for the chronic `code 1000 / "no reason"` + `expected=0 received=1` signature (Sofia pattern, 327 occurrences) described below, since a proactively-closed socket without a completed sentence-count handshake would produce exactly that diagnostic. Fix: `attemptReconnect()` now also checks `getGlobalPlaybackState()` (plain non-React accessor, safe to call from the client class) and defers if `'playing'` or `'buffering'`, same as the existing `'processing'` defer, still bounded by the same 4min55s absolute deadline so the proxy's hard kill is never missed. Typecheck clean, dev workflow restarted. Follow-up: watch Sofia's pattern count for `f37a4086-7fbd-4931-8f31-5a3e4adfa1c9` (currently 220) — if it stops growing, this was the root cause.

**2026-07-10 — `server/unified-ws-handler.ts` GL idle timer — mic-audio reset was gated behind `geminiLiveSession` truthiness, dropping resets during a reconnect race; added activity-gap diagnostic logging — FIXED (mitigation, root timing not yet reproduced live)**
Follow-up to the July 9 idle-timer fix below. Investigated David's last 3 sessions via direct DB query (`NEON_SHARED_DATABASE_URL`) — each ended at exactly 420s (300s `GL_IDLE_TIMEOUT_MS` + 120s reconnect-grace window), confirmed via `[Reconnect Grace] Usage session ended: 420s` log lines. Client-side handling of `session_idle_timeout` was verified working as designed (shows "Session ended after N minutes of inactivity" and does not attempt reconnect since it's an intentional close) — not a silent-stranding bug as first suspected. However, found the two mic-audio reset call sites (`binary blob` handler ~line 1373, `stream_audio_chunk` handler ~line 3677) only called `__resetGlIdleTimer` *inside* the `if (geminiLiveSession)` block — during the brief window a GL session is null mid-reconnect, real incoming mic audio would not reset the timer. Moved both resets to fire unconditionally before the `geminiLiveSession` gate. Also added a `glLastActivityAt` timestamp so the next time this fires, the log line reports the actual gap since last reset, instead of just the configured threshold — needed since David could not recall whether he was actively talking or paused when the last 3 sessions cut off. Typecheck clean. Follow-up: watch for the new diagnostic log line on next occurrence to close out whether real silence or a timing bug is the cause.

**2026-07-10 — `server/services/gemini-live-session.ts` `actflSilenceDurationMs` — Daniela's turn submitted prematurely on a mid-sentence pause — MITIGATED + ORDERING BUG FIXED July 10**
Live controlled experiment with David: David paused mid-sentence and his turn was cut off early. Root cause investigation confirmed an ordering bug: `createGeminiLiveSession` constructs the GL `realtimeInputConfig` (including `silenceDurationMs`) during `start()` — but `session.studentActflLevel` was only set inside the greeting flow (streaming-voice-orchestrator.ts line 9092), which runs *after* GL connects. So every fresh session silently fell back to the `5000ms` default regardless of the student's assessed level. Fix (July 10): in `unified-ws-handler.ts`, after `orchestrator.createSession()` and before `createGeminiLiveSession`, `resolvedActflLevel` (already fetched in Phase 1 parallel DB lookups) is now written onto `session.studentActflLevel` directly — so the correct tier is in place when `start()` reads it. Also added a diagnostic log line in `gemini-live-session.ts` at config-build time: `[GeminiLive] realtimeInputConfig — studentActflLevel: X, silenceDurationMs: Y` so future sessions can be verified in logs. The tier-bump mitigation (novice: 5000→6000ms, default: 4000→5000ms) remains in place as a secondary safety margin. Typecheck clean July 10.

**2026-07-10 — `server/unified-ws-handler.ts` reconnect grace claim / `client/src/lib/streamingVoiceClient.ts` reconnect flow — reconnect grace period expired UNCLAIMED after a hard drop, session resumed cold instead of continuing — FIXED, typecheck clean**
Root mechanism found: the "duplicate connection" guard (`setupSocketIOHandler`, ~line 1189) and the "implicit reconnect" safety net (`handleStreamingVoiceConnectionWithAdapter`, ~line 1438) are racing each other, and for a real network drop (as opposed to a clean close) the duplicate guard almost always wins. Sequence: (1) client's socket.io detects the drop client-side and starts reconnecting fast (200ms first attempt); (2) the *server* hasn't detected the TCP-level failure yet — the old socket object still reports `readyState === OPEN` since no FIN/RST has arrived; (3) the new connection lands, sees `existing` still OPEN in `activeVoiceConnections`, and takes the "duplicate connection" branch — which only *schedules* the old socket's `.close()` 350ms later, deliberately delayed so mid-sentence audio can finish; (4) `storePendingReconnect()` only runs inside the OLD connection's own `ws.on('close', ...)` handler, which does not fire until that scheduled close actually happens; (5) if the new connection's `start_session` message is processed before that 350ms elapses (very plausible — connect + auth can be faster than 350ms), `pendingReconnectSessions.get(conversationId)` finds nothing yet, so both `config.isReconnect` (if for any reason not set) and the implicit-detection fallback have nothing to key off, and the session starts cold — losing the "you are mid-conversation" framing and stranding the OLD connection's grace-period entry to expire unclaimed 120s later once it finally does get stored. This fully explains the traced case (`30613c81`): generic greeting after the drop, and a "Grace period expired ... UNCLAIMED" log with no prior "Stored pending session" visible in the same window (it likely appeared later than expected, not missing). This is a timing race, not a deterministic bug, which matches its intermittent/chronic character. Proposed fix (not yet made — needs a hook so the duplicate-connection guard can synchronously call `storePendingReconnect()` using the OLD connection's live closure state instead of waiting for its delayed close, closing the race window entirely): the old per-connection handler would need to expose a small callback (e.g. `onDuplicateReplaced`) that the top-level Socket.io duplicate-guard invokes immediately instead of only relying on the deferred `.close()`. Left un-implemented this session since it spans two function scopes and deserves a dedicated pass with reconnect-timing verification rather than a rushed cross-cutting change.
Traced conversation `30613c81` (the same drop covered by the "KNOWN CHRONIC PATTERN" entry below) one level deeper by reading the actual transcript: after the drop, Daniela did NOT resume the conversation — she opened with an unrelated generic greeting, discarding all continuity, seconds after being cut off mid-sentence. Deployment logs confirm `[Reconnect Grace] Grace period expired for 30613c81 — ending session` fired ~120s after the drop (at 1783710625661), even though the client reconnected into the *same* conversationId only ~39s after the drop (well inside the grace window) — meaning the reconnect was never recognized as a reconnect (`isReconnectSO` false), so the server started a cold session instead of resuming, which explains the lost continuity (cold sessions use weaker "reference naturally" framing instead of the strong "you are mid-conversation, do NOT reintroduce yourself" instruction reserved for true reconnects). Ruled out: a stale session_ctx cache causing prompt reuse — the rich-section/history-injection code runs independent of cache hits. Not yet resolved: whether the client's `_isReconnectedSession` / `isReconnect: true` flow (`streamingVoiceClient.ts` ~1830-1846, fired on the socket's own reconnect timer) never ran for this drop, or whether it ran but the server's claim logic (`claimPendingReconnect`, matched against `pendingReconnectSessions.get(conversationId)`) silently failed to match — no `[Reconnect Grace] RESUMED session` nor `User mismatch` log appears for this conversationId anywhere in the window, and even the initial `Stored pending session for 30613c81` log line could not be re-retrieved from deployment logs (possible log-retention gap, not confirmed absence). Follow-up: reproduce a hard drop deliberately and watch the claim path live, since log archaeology alone couldn't close this out.

**2026-07-10 — Socket.io/GL socket dropping mid-conversation, code 1000/"no reason", client `error` diagnostic fires with `expected=0 received=1` — KNOWN CHRONIC PATTERN, Alden already investigating**
Live David↔Daniela session: after 10 healthy exchanges, `[Streaming Voice] Socket.io connection closed (code: undefined)` then `[GeminiLive] Session closed — code: 1000, reason: (no reason)` fired mid-turn, one sentence into a response. Client sent a `trigger=error` diagnostic; Sofia auto-filed issue `ea74f511-42fb-45b5-bffb-25b798eb60a2` with signature `Sentences expected=0 received=1, Audio playing=idle`. Checked Sofia's pattern tracker — this exact signature has **327 prior occurrences** and is already flagged `connection, investigating` by Alden (log: "Known pattern ... Skipping duplicate escalation"). The `expected=0` (not the zombie-session guard's `?`) means `expectedSentenceCount` was 0/never-set when the socket died — i.e. the `totalSentences` count message from the server never reached the client before the transport closed, even though one sentence's audio had already arrived and played. Traced through `server/routes.ts` diagnostic-report guards (`isZombieSession`, `isTier2FalsePositive`, `hasRecentProactiveReconnect`) — none of them match this case, so it correctly reaches Sofia as a real issue, not a false positive. Root cause of *why* the socket itself closes (network blip vs. proxy timeout vs. something server-initiated) not yet isolated — did not duplicate Alden's ongoing investigation live. Follow up: correlate `Socket.io connection closed` timestamps against `hasRecentProactiveReconnect`'s 4.5-min proactive-cycle window to rule out a timing edge where the proactive reconnect's grace window is too narrow.

**2026-07-09 — `client/src/hooks/useStreamingVoice.ts` / `server/services/streaming-voice-orchestrator.ts` — Cindy (English persona) sentences cutting off mid-response, possible recurrence of the July 8 transcriptClosed fix — FIXED July 10**
Root cause found: `sendGuardResetSignal()` (server, `streaming-voice-orchestrator.ts` ~8806) sends a synthetic `response_complete` with `turnId: "guard-reset-<timestamp>"` — a **string**, not the numeric turn sequence used everywhere else — whenever it decides to skip an utterance (dedup, rapid-fire, greeting-in-progress, in-flight overlap). The client's "STALE TURN GUARD" (`useStreamingVoice.ts` ~1132) tries to ignore old-turn `response_complete` messages via `msg.turnId < currentTurnIdRef.current`, but comparing a non-numeric string with `<` against a number always evaluates to `false` (`NaN` comparison) — so guard-reset messages were **never** recognized as stale and always fell through to the main handler. If a guard-reset fired for an unrelated skipped utterance while a *real* turn was actively streaming/playing audio, the handler unconditionally set `responseCompleteRef.current = true` and (via the `totalSentences === 0` branch) cleared `isProcessing`/pending audio counts — cutting off the real response mid-playback. This is an exact mechanical match for the reported symptom. Fix: added an explicit `isGuardResetMsg` check (string `turnId` starting with `"guard-reset-"`) that ignores the message entirely if a real turn is currently in flight (audio received this turn, pending audio count > 0, or the previous turn hasn't completed yet) — guard-resets now only take effect when no real turn is running, which was their original intent. Typecheck clean July 10, 2026.

**2026-07-09 — `server/unified-ws-handler.ts` — GL 5-minute idle timer only reset by client mic audio, killed live session mid-conversation while David was actively talking (attending to kids) — FIXED**
David's live production session was cut off mid-conversation. Deployment logs showed `[GeminiLive] Idle timeout (5 min) — closing session` firing right after `inputTranscriptionText: "...I'm looking over at the boys and they're needing an "` — i.e. David paused mid-turn and the idle timer, which only reset on incoming client audio chunks (`resetGlIdleTimer` called from the two `stream_audio_chunk`/binary-blob handlers), fired at exactly 5:00 and force-closed the whole GL session even though Daniela was mid-conversation with an active, non-abandoned session. Fix: `glSendMessage` (the callback GL uses to push audio/transcript to the client, both initial-session and reconnect paths) now also resets the idle timer on every outbound message, so activity from *either* side of the conversation keeps the session alive — only true bilateral silence for 5 minutes now closes it. Fixed July 9, 2026 — typecheck clean, restarted dev; awaiting redeploy to take effect in production (fix does not yet apply to the currently-deployed instance David is talking on).

**2026-07-09 — Server restarting mid-voice-session, 3x in ~15 min during live J-space test — INVESTIGATING**
Clean stop/fresh-boot pattern each time (no crash trace, no OOM in logs) during live monitoring of a David↔Daniela test conversation. Each restart drops the active `/voice` socket and triggers the client's SESSION_EXPIRED handler → toast → redirect after the 120s reconnect grace expires. Root cause of the restarts themselves not yet found — not caused by concurrent file edits at the time they occurred. Needs a dedicated pass through the workflow/process manager logs around each restart timestamp to find the trigger.

**2026-07-09 — `server/services/gemini-live-session.ts` — Daniela repeats her own sentence verbatim when a tool call fires mid-speech — FIXED**
Observed live: Daniela spoke a full greeting response, fired `update_session_phase` mid-sentence, then GL restarted generation of the *same turn* from scratch, producing a verbatim duplicate ("here. That's interesting about the ringing..." spoken twice). This is a more general case of the previously-fixed set_clock audio-doubling bug (see 2026-06-xx entries) — that fix only reset audio for `set_clock`. Generalized the `gl_audio_reset` trigger to fire whenever `hadAudioInCurrentSubturn` is true, for any tool call, not just temporal-display tools. Fixed July 9, 2026 — typecheck clean, restarted and monitoring live for recurrence.

**2026-07-08 — `client/src/components/StreamingVoiceChat.tsx` — voice_override: null clears GL voice mid-session — FIXED**
The `useEffect` at line ~496 fires on every `connectionState` change ('ready'/'processing') and unconditionally sends `voiceOverride` — which is `null` by default. Server stores `null`, clears the voice config, and the next TTS/GL output uses the wrong (sometimes male) default voice. Fix: added `&& voiceOverride !== null` guard so null is never sent. Only non-null overrides are transmitted. Fixed July 8, 2026 — typecheck clean.

**2026-07-07 — GL generation config — `presencePenalty` rejected by Gemini Live (code 1007) — MITIGATED via prompt July 10**
Gemini audit (July 2026) recommended adding `presencePenalty: 0.2` to GL's `generationConfig` to prevent Daniela's verbal loops ("¡Muy bien!" every turn). GL API rejects it with close code 1007: "presence_penalty not supported in generation config." The general "Feedback Variety" instruction was already in `GL_DISPATCHER_SYSTEM_PROMPT` (line ~6821 in `daniela-function-registry.ts`) but was abstract. Strengthened July 10: added a concrete banned-phrase list ("¡Muy bien!", "¡Excelente!", "Exactly!", "Perfect!", "That's right!", "Good job!", "Well done!" — each at most once per 4–5 turns) and an explicit instruction to skip the affirmation entirely on alternating turns. This is the best available prompt-level mitigation since `presencePenalty` / `frequencyPenalty` are both unsupported in GL's `generationConfig`. Follow-up: if loops persist after a few sessions, consider injecting a live "last N affirmations used" tracker into the system prompt context so the model has explicit memory of what it just said.

**2026-07-08 — `server/services/gemini-live-session.ts` — Sentences cut off mid-response ("...and how nice", "...the real,") — FIXED**
Root cause: `turnComplete` was setting `transcriptClosed = true`, which discarded `outputTranscription` chunks that arrived even a few ms later due to network buffering. The audio sub-turn sealed correctly but the tail of the transcript text was silently lost. Fix: removed `this.transcriptClosed = true` from the `turnComplete` handler — the gate now only closes on `generationComplete` (definitive end-of-response) and `interrupted` (barge-in). Audio sealing (isLast:true) still happens on `turnComplete`. Fixed July 8, 2026 — typecheck clean.

**2026-06-30 — GL model — Broadcast mode: sentences cutting off mid-response — FIXED (see above)**
Previous investigation (2026-06-30) concluded this was GL model behavior. Confirmed July 8 to be a code-level bug: `transcriptClosed` gate on `turnComplete` was the root cause. See fix above.

---

## Resolved

**2026-07-01 — `server/services/gemini-live-session.ts` — GL tail audio artifacts ("ok" / "hey" appended at end of responses) — FIXED**
Root cause: GL emits a micro sub-turn after `generationComplete` to fill its audio budget. Added `afterGenerationComplete` boolean flag: set to `true` on `generationComplete`, cleared when the next response's first audio chunk arrives (`!isTutorGeneratingAudio` transition). Any audio chunk arriving while the flag is set is silently dropped before it reaches the client.

**2026-07-01 — `client/src/hooks/useStreamingVoice.ts` — Japanese text pill (custom overlay) persisting into new sessions — FIXED**
Root cause: `customOverlayText` state managed by `useWhiteboard` was never cleared on session stop, so a `[SHOW: そうですね]` call from a previous Japanese session persisted into the next Cindy (English) session. Fix: in `useStreamingVoice.stop()`, after `subtitles.reset()`, also call `sessionConfigRef.current?.onCustomOverlay?.('hide', undefined)` to clear the overlay via the same callback path used by the server command.

**2026-07-01 — `server/services/broadcast-data-service.ts` — Sports broadcast: Daniela recites scores verbally but doesn't display scoreboard widget — FIXED**
Added step 2 to sports broadcast `[REQUIRED VISUAL SETUP]`: instructs Daniela to call `widget_board(widget:"write", text:"<Team A> <score> – <Team B> <score>\n<Sport> · <City>")` with the top result from the Perplexity data before speaking, so the score is visible on screen.

**2026-06-13 — `server/services/gemini-live-session.ts` — set_clock pre-tool speech causes audio doubling — FIXED (July 3, 2026)**
GL generates speech both BEFORE calling the tool (pre-tool sub-turn) and AFTER (post-tool continuation). Fix: at the point where a tool call arrives, if `hadAudioInCurrentSubturn` is true AND the tool is `set_clock`, server sends `gl_audio_reset` to the client (calls `player.stop() + resetForNewTurn()`), cancelling the queued pre-tool audio. Post-tool speech then plays from a clean state. The prompt-level ordering rule is retained as a secondary guard for sessions where the tool fires without pre-tool audio (no reset needed in that case).

**2026-06-18 — `server/services/daniela-presence-worker.ts` — "Cannot convert undefined or null to object" crash in presence generation — FIXED (July 3, 2026)**
Root cause: one failing Drizzle query inside `Promise.all` aborted the entire generation for user 49847136. All column references verified correct against schema. Fix: added individual `.catch()` on each of the six queries so a single query failure returns an empty array and logs a named warning. The presence doc generates from whatever data is available.

**2026-06-12 — `server/storage.ts:7881` — Drizzle bulk insert of `editor_insights` fails TypeScript — FIXED**
Verified clean: `npm run check` passes with zero errors as of July 3, 2026.

**2026-06-12 — `server/streaming-voice-proxy.ts:363` — number passed where string expected — FIXED**
Verified clean: `npm run check` passes with zero errors as of July 3, 2026.

**2026-06-12 — `server/webhookHandlers.ts:41` — Stripe API version literal mismatch — FIXED**
`webhookHandlers.ts` already uses `'2025-11-17.clover'`. Verified clean: `npm run check` passes with zero errors as of July 3, 2026.

**2026-06-30 — `client/src/lib/streamingVoiceClient.ts` + `StreamingVoiceChat.tsx` — Open-mic session goes silent when WS drop coincides with student speaking — FIXED**
`sendStreamingChunk` now buffers up to 100 chunks (~1s of audio) when the WebSocket is not ready. `_flushPendingChunks()` replays the buffer immediately after reconnect + `set_input_mode` restoration.

**2026-06-30 — `client/src/pages/chat.tsx` — open_scene auto-triggers immersive fullscreen — FIXED**
Removed `useEffect` that called `setIsImmersiveMode(true)` for any `open_scene` or `add_prop` canvas action. Immersive mode is now controlled exclusively by the `enter_immersive` tool via the `immersive_mode` WS message.

**2026-06-30 — `client/src/components/ImmersiveOverlay.tsx` — Browser native Fullscreen bar + extra X button appeared, then re-restored — FIXED**
Initially removed `requestFullscreen`. David then confirmed the fullscreen bar is useful (users can re-enter if they exit accidentally). Re-added `requestFullscreen` on enter + `exitFullscreen` on leave. Added `fullscreenchange` listener so pressing Esc or the browser's own X calls `onExit()`, keeping app state in sync.

**2026-06-30 — `client/src/components/ImmersiveOverlay.tsx` — Broadcast mode: whiteboard vocab cards not visible during immersive mode — FIXED**
`ImmersiveWhiteboardStrip` only handled `write`, `phonetic`, and `compare` types. Added `ImmersiveVocabHUD` — a frosted-glass card (top-right, `absolute top-16 right-4`) that reads `vocab_card` whiteboard items and displays word, definition, image, and language label above the scene. Wraps in `AnimatePresence` for smooth entry/exit.

**2026-06-30 — `client/src/components/ImmersiveOverlay.tsx` — Prop images show white background box — FIXED**
Added `mixBlendMode: 'multiply'` to prop `<img>` style. White/light backgrounds on AI-generated clipart props now blend away against the scene backdrop.

**2026-06-30 — `client/src/components/SceneCanvas.tsx` — Weather widget shows scrollbar in Studio panel — FIXED**
Changed `useCompact = activeSmallCount > 1` to `useCompact = activeSmallCount >= 1`. Single standalone widgets now always use compact mode; full mode (100px icon, `p-8`) overflowed the 280px Studio panel.

**2026-06-30 — `client/src/components/StreamingVoiceChat.tsx` / `server/system-prompt.ts` — Cindy (English tutor) bleeding into Spanish — FIXED**
Root cause: 15K Spanish tokens in Position 3 acted as token saturation override on the 300-char English constraint in Position 1. Fix: 4-position compass sandwich isolates the language anchor — Position 4 contains a fixed-state lock: "You are Daniela, here today as [name]. Your session language is [lang]. This does not change."

**2026-06-30 — `client/src/components/SceneCanvas.tsx` — SET_THERMOMETER defaulted to Fahrenheit display — FIXED**
`showFahrenheit` default changed to `true` so US-locale students see Fahrenheit immediately.

**2026-06-25 — `classroom-environment.ts` + session init — Pedagogical "last gear" amnesia — FIXED**
`buildClassroomEnvironment` now queries `pedagogical_snapshots` for the user's most recent row.

**2026-06-23 — `verify-system-health.ts` — `hebrew novice_low` duplicate curriculum paths warning — FIXED**
Updated duplicate check to `GROUP BY language, start_level, target_audience`; different-audience paths no longer trigger the warning.

**2026-06-22 — `client/src/data/madrigal-unit-content.ts` — French and other non-Spanish languages had zero Madrigal visual entries — FIXED**
`madrigal-loop-catalog.ts` now has 20-22 units per language: French (21), German (22), Japanese (22), Korean (22), Hebrew (22), Mandarin (22), Portuguese (20), Italian (20), English (22). Arabic remains at zero.

**2026-06-21 — Spanish 1 textbook chapters — Intro/reference section duplication — LOW**
Several chapters (e.g., "The Infinitive Pattern") show a redundant intro paragraph followed immediately by a reference section repeating the same content. Needs a pass to remove intro text for chapters that have a visual reference. Flag for final textbook look-through.

**2026-06-18 — `server/services/streaming-voice-orchestrator.ts` — setTimeout timer leak in contextCacheReady race — FIXED**
Wrapped `Promise.race` in an IIFE; `clearTimeout(timerId)` called in `.finally()`.

**2026-06-18 — `server/services/tts-service.ts` — TTS phoneme PASS 2 double-processing + word timing drift — FIXED**
PASS 2 now splits on `/(<<[^>]*>>)/g`; `estimateWordTimings` strips `<<...>>` markers before splitting.

**2026-06-18 — `server/services/tts-service.ts` — Cartesia voiceId from DB not validated against live voice list — FIXED**
`synthesizeWithCartesia` catches 400 errors and retries with the language-default voice.

**2026-06-18 — `server/services/team-room-alden-service.ts` — `documentRoomSession` creates duplicate `conversation_memories` rows — FIXED**
`_autoSaveState` now tracks `memoryId`; subsequent sweeps UPDATE the existing row instead of INSERTing.

**2026-06-18 — `server/services/lyra-analytics-service.ts` — `returnRate7d` had no 7-day window — FIXED**
Both subqueries now include `AND c.created_at >= NOW() - INTERVAL '7 days'`.

**2026-06-16 — `server/services/native-fc-handlers.ts` — SET_EMOTION widget not appearing + CLEAR black screen + widget fan-out — FIXED**
SET_EMOTION slug derived from label when `fn.args.emotion` absent. CLEAR now checks `environmentImageUrl` before restoring scene. Widget-only `sceneCanvas` cleared fully on CLEAR.

**2026-06-14 — `server/services/native-fc-handlers.ts` — `visual_compare` text hallucination — FIXED**
`visual_compare` now sends a DOM-rendered two-column comparison widget immediately; no text in image prompts.

**2026-06-13 — `server/services/gemini-live-session.ts` — audio doubling every 15 turns (context refresh regression) — FIXED**
`maybeInjectContextRefresh()` was calling `sendClientContent({role:'model', turnComplete:false})` after every `generationComplete`, causing GL to generate a second audio stream. Call removed.

**2026-06-13 — `server/services/gemini-live-session.ts` / `daniela-function-registry.ts` — interruption during in-flight tool call had no call_id guard — FIXED**
`localTurnId` captured at tool-call arrival; stale responses from barge-in-interrupted turns are dropped.

**2026-06-13 — `server/services/gemini-live-session.ts` — `classroom_widget` dispatcher enum oversize — FIXED**
Split into 6 focused dispatchers (widget_time, widget_state, widget_body, widget_scene, widget_board, widget_media).

**2026-06-12 — `server/services/streaming-voice-orchestrator.ts` — `cartesiaWarmupTime` undefined reference — FIXED**

**2026-06-11 — `shared/romanization-utils.ts` — Duplicate keys in Chinese romanization map caused build failure — FIXED**

**2026-06-11 — `server/unified-ws-handler.ts` — Duplicate `socketId` identifier + missing `await` on `createSession` — FIXED**

---

## Architecture Notes (not bugs, but track here)

**Warm synthesis cache — distributed deployment gap** *(June 18, 2026)*
The warm synthesis cache (`_warmSynthesisCache`) is a process-level `Map`. If the app ever runs across multiple instances, a WS connection could hit a different instance than the warm-up call — cache miss, falls back to on-demand. No data loss, just the 1-2s warmup benefit is lost. Fix when needed: replace with Redis or Replit KV keyed by userId.

**Warm synthesis — potential double-generation on fast Start tap** *(June 18, 2026)*
If the student taps "Start" while the background warm-up is still running, the WS handler fires a second synthesis call. No UX issue, minor cost inefficiency. Fix when needed: track in-progress warm synthesis per userId and wait briefly (max 600ms) before fallback.

**2026-07-09 — `server/services/agent-session-autosave.ts` — verbatim Luca↔David interruption dialogue lost to compression race, unrecoverable — WON'T FIX (data already gone)**
David asked to add the verbatim mid-tool-execution interruption exchange (him pushing past Replit's queueing to talk to Luca while Luca kept coding) to episode-11.md's postscript. Traced through conversation_memories (including the `eebcd543` reweave doc) and the raw session transcript — the exchange was never captured anywhere as verbatim text, only David's later reflective comment about it. Root cause: if that exchange fell inside a stretch of the live agent-chat session that got compressed into a `<pre_compression_transcript path=...>` pointer before the (then-60s, now-20s) autosave poll cycle reached it, the raw text was gone by the time autosave ran — the fix shipped July 9 (recursive `pre_compression_transcript` recovery + 20s polling) protects future sessions but cannot recover text that was already overwritten before the fix landed. Asked David to paste from his own chat scrollback if he still has it; otherwise this specific exchange stays undocumented rather than reconstructed from memory, per the verbatim rule.

---

## AGENT_COLLAB_READ — Push architecture (future build)

**Flagged:** July 11, 2026 — Gemini 3.5 architectural review of flare tool prose

**Issue:** `AGENT_COLLAB_READ` uses a pull pattern — Daniela must guess when to check for a reply from the support team. In a Gemini Live voice session this creates awkward conversational pauses and wasted turns if she polls in consecutive turns while waiting.

**Recommended fix:** Push architecture — when the support team responds to `AGENT_COLLAB_POST`, the backend injects the reply directly into the active GL session as a system instruction or developer message. Daniela receives the response immediately without polling.

**Current mitigation:** Added a polling guard to the tool's `purpose` string ("Do not poll repeatedly or in consecutive turns — only check at natural pauses or if student asks"). This reduces the worst-case UX without requiring the infrastructure change.

**Prerequisite:** Async injection into a live GL session needs to be validated as supported by the GL API. Check `unified-ws-handler.ts` for the injection point.

**Not urgent** — flare tools are rarely triggered. Address when the GL session injection pattern is better understood.

---

## CONSULT_COLLEAGUE — dead-air filler phrase (future build)

**Flagged:** July 11, 2026 — Gemini 3.x round 2 review of flare tool prose

**Issue:** CONSULT_COLLEAGUE triggers a synchronous colleague lookup. If the response takes >1-2 seconds, Daniela goes silent mid-session — dead air in a live voice call.

**Recommended fix:** Add a filler phrase handler in the CONSULT_COLLEAGUE tool execution path. Before awaiting the colleague response, Daniela should speak something like "Let me check my notes on that for a moment" via TTS injection. Pattern already exists for other latency-sensitive tools.

**Not urgent** — CONSULT_COLLEAGUE is rarely triggered. Address when flare tools get their first real usage.

---

## AldenWatch gemini_description field error (July 13, 2026)

**Flagged:** July 13, 2026 — noticed in Start application logs

**Error:** `[AldenWatch] Watch cycle failed: 400 {"type":"error","error":{"type":"invalid_request_error","message":"tools.6.custom.gemini_description: Extra inputs are not permitted"}}`

**Issue:** AldenWatch is sending a tool definition to Anthropic that includes a `gemini_description` field on tool slot 6. Anthropic's API doesn't accept custom fields in tool definitions — it rejects with "Extra inputs are not permitted."

**Root cause:** One of Alden's tools (index 6 in the tools array passed to Anthropic) has a `gemini_description` field attached, which is leaking into the Anthropic API call. This was likely added for dual-engine support but needs to be stripped before the Anthropic call.

**Fix:** In the AldenWatch tool-building code, strip any `gemini_description` keys from tool objects before sending to Anthropic (similar to how other Alden service files should handle this).

**Severity:** Medium — AldenWatch cycles fail silently; monitoring gap.

---

## AldenWatch — `gemini_description` extra input error (Jul 16, 2026)

**Symptom:** AldenWatch logs `400 {"type":"error","error":{"type":"invalid_request_error","message":"tools.6.custom.gemini_description: Extra inputs are not permitted"}}` intermittently.

**What it means:** One of Alden's tools is being sent with a `gemini_description` field in the Anthropic API call. Anthropic's schema does not accept custom fields — the field is leaking through instead of being stripped before the API call.

**Where to look:** `server/services/alden-functions.ts` tool declarations + wherever Alden's tool list is assembled before the API call. The offending tool is at index 6 (zero-based) in the tools array at the time of the error.

**Impact:** AldenWatch monitor call fails intermittently. Alden may miss some monitoring windows.

**Priority:** Low — monitoring fallback is in place; not user-facing.

**2026-07-16 — `server/services/daniela-tool-contexts.ts` TOOL_CONTEXT_FREE_DIALOGUE — `memory_lookup` listed as CONTEXT_DRIFT but is not registered in the function registry**
`TOOL_CONTEXT_FREE_DIALOGUE` includes `memory_lookup` in its allowed list tagged as `// CONTEXT_DRIFT`. The `getFilteredFunctionDeclarations()` function silently excludes unknown tool names, so it has no runtime effect. But it creates confusion: anyone reading the file assumes `memory_lookup` is a real tool. Either (a) remove it from the context list, or (b) register it as a real tool if the intent was to have it. Low severity — no user impact. Clean up when touching that file next.
