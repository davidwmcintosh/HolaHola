# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

---

## Active

**2026-07-09 — `client/src/hooks/useStreamingVoice.ts` / `server/services/streaming-voice-orchestrator.ts` — Cindy (English persona) sentences cutting off mid-response, possible recurrence of the July 8 transcriptClosed fix — INVESTIGATING**
David reported sentences getting cut off live, during a David↔Cindy voice session observed via the Luca observation bench. Browser console showed `[StreamingVoice] response_complete with totalSentences=0 — immediately clearing isProcessing (no audio will arrive)`. This client-side early-bailout path (`useStreamingVoice.ts` ~line 1189) is also used intentionally for legitimate guard-resets (dedup, barge-in, greeting-in-progress via `sendGuardResetSignal`), so it isn't proof of a regression on its own — need to correlate server-side `[GUARD RESET]` / `[DEDUP]` logs against the exact turn to tell whether this was a legitimate reset misfiring during a real turn, or a genuine recurrence of the July 8 `transcriptClosed`-timing bug (marked FIXED, see below). Did not touch orchestrator/GL code live while the session was active — follow up with log correlation next session.

**2026-07-09 — Server restarting mid-voice-session, 3x in ~15 min during live J-space test — INVESTIGATING**
Clean stop/fresh-boot pattern each time (no crash trace, no OOM in logs) during live monitoring of a David↔Daniela test conversation. Each restart drops the active `/voice` socket and triggers the client's SESSION_EXPIRED handler → toast → redirect after the 120s reconnect grace expires. Root cause of the restarts themselves not yet found — not caused by concurrent file edits at the time they occurred. Needs a dedicated pass through the workflow/process manager logs around each restart timestamp to find the trigger.

**2026-07-09 — `server/services/gemini-live-session.ts` — Daniela repeats her own sentence verbatim when a tool call fires mid-speech — FIXED**
Observed live: Daniela spoke a full greeting response, fired `update_session_phase` mid-sentence, then GL restarted generation of the *same turn* from scratch, producing a verbatim duplicate ("here. That's interesting about the ringing..." spoken twice). This is a more general case of the previously-fixed set_clock audio-doubling bug (see 2026-06-xx entries) — that fix only reset audio for `set_clock`. Generalized the `gl_audio_reset` trigger to fire whenever `hadAudioInCurrentSubturn` is true, for any tool call, not just temporal-display tools. Fixed July 9, 2026 — typecheck clean, restarted and monitoring live for recurrence.

**2026-07-08 — `client/src/components/StreamingVoiceChat.tsx` — voice_override: null clears GL voice mid-session — FIXED**
The `useEffect` at line ~496 fires on every `connectionState` change ('ready'/'processing') and unconditionally sends `voiceOverride` — which is `null` by default. Server stores `null`, clears the voice config, and the next TTS/GL output uses the wrong (sometimes male) default voice. Fix: added `&& voiceOverride !== null` guard so null is never sent. Only non-null overrides are transmitted. Fixed July 8, 2026 — typecheck clean.

**2026-07-07 — GL generation config — `presencePenalty` rejected by Gemini Live (code 1007) — GEMINI REVIEW NEEDED**
Gemini audit (July 2026) recommended adding `presencePenalty: 0.2` to GL's `generationConfig` to prevent Daniela's verbal loops ("¡Muy bien!" every turn). However, the GL API rejects it immediately with close code 1007: "presence_penalty not supported in generation config." Removed the field as a hotfix. Before giving up on this: (1) ask Gemini if `presencePenalty` is supported on a different config path in Live mode, (2) ask if there is a workaround (e.g. `frequencyPenalty` instead, or a prompt-level injection pattern they recommend). Gemini was the one who suggested it — they may know a path we don't.

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
