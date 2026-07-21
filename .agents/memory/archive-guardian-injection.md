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

- If `pendingSystemWhisper` ever changes its injection pattern, re-evaluate this in lockstep.
- The `[ARCHIVE GUARDIAN]` label is critical — it signals to Daniela's context that this is grounding data, not a student message.

## If it stops working — escalation path

**Symptom:** Daniela is not responding to the grounding whisper — she slides past it, ignores the `[ARCHIVE GUARDIAN]` context, or the injection silently drops.

**Root cause to check first:** The concat is riding on another tool's response body. If that tool's response is large, malformed, or arrives at the wrong moment in the FC batch, the Guardian content may be buried or dropped before Gemini processes it.

**Fix:** Give the Archive Guardian its own dedicated FC channel — a real `grounding_query` tool call with the result returned as a first-class `functionResponse`. David confirmed: "if he deserves his own channel, he deserves his own channel." We have latency budget to absorb the extra round-trip.

This is a known, pre-approved escalation. Do not re-litigate the tradeoff — just implement the dedicated channel and document what symptom triggered it.
