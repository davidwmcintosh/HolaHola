---
name: Daniela self-visibility — tool acknowledgment system
description: How Daniela knows what's actually on the student's screen after firing visual tools (Phase 1 shipped July 2, 2026)
---

## The Problem
Daniela fires visual tools into a void. She fires `SHOW_VOCAB_GRID` and has no idea whether images loaded, how many words are showing, or whether the render succeeded. She fires `OPEN_SCENE` and doesn't know if the student sees the restaurant or a blank. She teaches into the unknown.

## What Was Built (Phase 1)

Tool acknowledgments injected into `pendingGlContext` → flushed via Gap 10 into the last GL tool response before her next turn. Format: `[SYSTEM UPDATE — not spoken: ...]`.

| Tool | Acknowledgment |
|------|---------------|
| `SHOW_VOCAB_GRID` | N words confirmed, M images loaded, word list |
| `SHOW_IMAGE` | Word/translation confirmed, image description, source |
| `OPEN_SCENE` | Scene label and env name confirmed in Studio Pane |
| `START_TEXTBOOK_PAGE` | Vocab list + Madrigal protocol directive |

All in `server/services/native-fc-handlers.ts`.

## The Madrigal Wiring Fix (same edit session)

`processStartTextbookPage` now injects a teaching protocol directive when vocab is present:
- Lists the vocab words on screen
- Gives the exact `vocab_query` to use with `START_MADRIGAL_LOOP`
- Tells her to begin with image presentation, not free conversation

Before this: the textbook page opened, whiteboard showed, but Daniela had no signal to fire the structured Madrigal arc.

## The Gap 10 Channel

`pendingGlContext` items are flushed into the last functionResponse result by `gemini-live-session.ts` ~line 2257. It's the right channel: happens after all async tool promises resolve, before GL generates its next audio turn. Never spoken aloud (`[SYSTEM UPDATE — not spoken: ...]` wrapper).

## Phase 2 (Not Yet Built — documented in docs/observer-seat-test-plan.md §4b)
- Client-side image load failures (server doesn't see 404s — client does)
- Student engagement signals: clicks on word cards, dwell time
- Interface state snapshot at each turn start (what's currently showing)

**Why:** These require client→server feedback (e.g. WebSocket events from the frontend). Different architecture from the tool acknowledgment system which is all server-side.
