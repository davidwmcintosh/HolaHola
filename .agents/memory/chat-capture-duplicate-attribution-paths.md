---
name: Chat-capture attribution — three independent write paths
description: .chat_capture has three separate DB-writing consumers, each deriving row-level participants/title independently; fixing one does not fix the others.
---

## The architecture

`.local/.chat_capture` (the append-only per-turn capture log) is read by three independent code paths. Each INSERTs its own `conversation_memories` rows and derives row-level `participants`/`title` metadata with its own locally-duplicated logic, by design:

- `agent-session-autosave.ts`'s `checkChatCapture()` — the primary live path, polls while the dev server is running.
- `capture-watchdog.ts`'s `writeToDb()` — backup drain when the dev server is down; a separate long-lived process.
- `save-transcript-now.ts`'s `.chat_capture` fallback (`saveNow()` and `saveChatCaptureWithLock()`) — manual force-save script, used directly and by the session-end checklist.

All three render the dialogue body via the shared `formatChatCaptureSpeakerLabel()` in `transcript-parser.ts` (single source of truth for the text), but none of them import a shared helper for the row's `participants`/`title` — each has its own copy.

## Why

The duplication is deliberate — it isolates regression risk, so a bug in the watchdog's copy can't break the primary autosave path. But it means a per-turn identity/attribution bug fixed in one file's metadata derivation is NOT fixed in the other two. A 2026-09 incident fixed the shared body-rendering function first and initially missed that `capture-watchdog.ts` and `save-transcript-now.ts` each had their own unfixed copy of the metadata-derivation logic — producing rows where the body text was correct but the title/participants metadata still claimed the wrong identity.

## How to apply

Any change to how a turn's identity/attribution is derived (new speaker/source combination, changed label rule, etc.) must be checked against all three call sites above, not just the one where the bug was first observed. `agent-session-autosave.ts`'s `saveTranscriptChunk` and `save-transcript-now.ts`'s JSONL primary branch are the exception: both use `extractTurns()` (legacy Replit JSONL format), which structurally can only ever emit `DAVID`/`LUCA` speakers, never `CLAUDE_CODE` — their hardcoded 2-party participants are safe and out of scope for this bug class.
