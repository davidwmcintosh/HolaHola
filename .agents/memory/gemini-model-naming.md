---
name: Gemini model naming and Replit proxy paths
description: Which Gemini model/path to use for REST vs Live, including Replit proxy path ownership.
---

The REST `generateContent` path (daniela-caller.ts, team-room-alden-service.ts, all context builders) must use:
  `gemini-3-flash-preview`

The Gemini Live streaming path (/chat route, gemini-live-session.ts) uses a different model string — do NOT apply the same name there.

`gemini-2.5-flash` returns 404 in this codebase. If you see a 404 from the Gemini API, the model string is the first thing to check.

For Replit AI Integration transport, the configured base URL already owns the
provider and API-version routing. Append `/models/<model>:generateContent`
directly. Do not insert `/v1beta` between the configured base and `/models`;
that duplicates routing owned by the proxy and fails.

**Why:** A Gate 3 transport first sent the integration credential to the wrong
public endpoint, then reproduced a 404 by adding Google's public `/v1beta`
shape to a Replit proxy base. The working request used the configured base plus
`/models/gemini-3-flash-preview:generateContent`.

**How to apply:** Before constructing a Gemini REST URL, verify whether the
credential/base pair is Google's public API or a Replit integration. For the
Replit pair, trust the supplied base path and append only `/models/...`.
