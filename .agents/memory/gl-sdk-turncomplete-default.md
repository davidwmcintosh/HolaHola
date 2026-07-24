---
name: GL SDK turnComplete default
description: sendClientContent in @google/genai JS SDK defaults turnComplete to true — critical for context injection correctness
---

# GL SDK: sendClientContent defaults turnComplete:true

## The rule
Always pass `turnComplete: false` explicitly on EVERY sendClientContent call that is a context injection (not an intentional "please generate now" request).

**Why:** The `@google/genai` JS SDK sets `turnComplete: true` as the default in `defaultLiveSendClientContentParamerters` (line 13279 of dist/index.mjs). Omitting `turnComplete` is NOT the same as `turn_complete: false` at the protocol level — the SDK fills in `true`. Every `sendClientContent` without `turnComplete: false` triggers a new GL generation, producing an extra simultaneous audio stream.

**How this manifested:** Triple overlapping audio from Daniela — she'd start a response, a second voice would start a few seconds in (FrictionlessSlide 500ms timer fired), then a third (FrictionSignal timer). The dashes at the start of responses 2 and 3 in transcripts are mid-sentence restart artifacts.

**Fixed July 24 2026:** Added `turnComplete: false` to all 5 context injection sendClientContent calls:
- PreTurnGuardian 150ms fallback (~line 2207)
- FrictionlessSlide 500ms fallback (~line 2547)
- FrictionSignal 500ms fallback (~line 2651)
- HardWall correction (~line 2709)
- ArchiveGuardian dedicated channel (~line 3323)

**How to apply:** Grep `sendClientContent` in gemini-live-session.ts whenever adding a new injection. If it's context (not "generate now"), add `turnComplete: false`. The greeting/directive/text-turn calls at lines 1403, 1468, 1489, 1680 correctly have `turnComplete: true`.
