---
name: Archive Guardian auto-grounding — injection tradeoff
description: How the Archive Guardian whisper is delivered into Daniela's context, and why string concat into a tool response body is the accepted pattern.
---

# Archive Guardian — injection tradeoff

## The rule

When `runAutoGrounding()` fires (triggered by Frictionless Slide detection), its result is injected into Daniela's context by **concatenating it onto the body of the nearest pending tool response** — specifically appended to whatever `functionResponse.response.output` string is already there.

In GL (`gemini-live-session.ts`): prepended to the next `functionResponse` part sent back over the live session's tool channel. Primary path: injected into the batch that closes the current tool round. 500ms fallback: `sendClientContent` with no `turnComplete` if the next turn has no tool calls.

In text mode (`daniela-caller.ts`): a synthetic `functionCall` + `functionResponse` pair is pushed into `messages[]` so the model sees it as self-called tool history.

## Why this is acceptable

This is the **same pattern used by `pendingSystemWhisper`**, which has been production-proven across thousands of GL sessions. The injected text is labeled `[ARCHIVE GUARDIAN]` and is never spoken aloud — it is context, not dialogue.

The alternative (a dedicated grounding tool call) would require another FC round-trip, adding latency and consuming one of the 64 GL tool slots. The concat approach is zero-latency and invisible to the student.

**Why:** Gemini pre-flight accepted this explicitly. David noted: "production-proven, noting as an accepted trade-off."

## How to apply

- Never change this to a separate tool call without David's approval — the latency and slot cost are the reason it's a concat.
- If `pendingSystemWhisper` ever changes its injection pattern, re-evaluate this in lockstep.
- The `[ARCHIVE GUARDIAN]` label is critical — it signals to Daniela's context that this is grounding data, not a student message.
