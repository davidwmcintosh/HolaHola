---
name: Gemini model naming
description: Which model string to use for REST vs Live API — mixing them causes 404.
---

The REST `generateContent` path (daniela-caller.ts, team-room-alden-service.ts, all context builders) must use:
  `gemini-3-flash-preview`

The Gemini Live streaming path (/chat route, gemini-live-session.ts) uses a different model string — do NOT apply the same name there.

`gemini-2.5-flash` returns 404 in this codebase. If you see a 404 from the Gemini API, the model string is the first thing to check.

**Why:** The API versioning changed; all working services in this codebase already use `gemini-3-flash-preview` — the one broken service was using a stale name.

**How to apply:** Before using any Gemini model string, grep `gemini-3-flash-preview` across the codebase to confirm the current name in use.
