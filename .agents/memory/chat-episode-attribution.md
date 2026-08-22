---
name: Chat episode hook — attribution taxonomy
description: Speaker label rules for maybeAppendChatMessage, including consult vs live vs CI distinctions.
---

## Rule

`maybeAppendChatMessage(lucaText, danielaText, options?)` uses an options object (not positional args after the second).

Speaker labels written to the rolling episode:
- `LUCA [HolaHola chat]:` — Luca's side of every captured chat exchange
- `Daniela:` — live GL session response
- `Daniela [consult]:` — REST consult-Daniela call (`isConsult: true`)
- `Gemini:` — architectural consultations routed through the Gemini REST API

CI/functional tests pass `noEpisode: true` — those calls never reach the episode hook.

## Why

The episode record must distinguish a live Daniela GL session (real-time voice, full session context) from a one-shot REST consultation (cold, no session memory). Mislabelling them erases that distinction from the record permanently.

## How to apply

- Pass `isConsult: true` in the options object when the Daniela reply came from a consult-Daniela REST call.
- Pass `noEpisode: true` for CI scripts, dry-run tests, and any call that should not appear in the episode narrative.
- The `isConsult` flag is wired and ready; the consult-Daniela skill does not yet call `maybeAppendChatMessage` — no action needed until a consult exchange is intentionally captured.
