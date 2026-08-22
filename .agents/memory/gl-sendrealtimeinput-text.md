---
name: GL sendRealtimeInput text — student speech channel
description: sendRealtimeInput({ text }) is NOT safe for system/grounding injection in GL — GL treats it as student speech input
---

sendRealtimeInput({ text }) is documented in the codebase at gemini-live-session.ts line ~3495 as wrong for system note injection. GL treats text sent through that channel as student speech — Daniela reads it aloud or responds to it as if the student said it.

**Why:** sendRealtimeInput is the PCM audio streaming channel. The @google/genai SDK supports a text field in LiveSendRealtimeInputParameters, but GL processes it identically to audio-transcribed student speech — it enters the conversation as a user turn, not as a background context note.

**How to apply:** Never use sendRealtimeInput({ text }) for Guardian grounding, wee-oo corrections, or any system note. The only safe injection channels in GL are: (1) tool result bodies (append to last.response.result before sendFunctionResponse), and (2) system prompt / reconnect injection (pre-session, not mid-turn).

**Contrast with sendClientContent:** sendClientContent is also broken for mid-session injection — turnComplete:true triggers duplicate generation (triple audio); turnComplete:false leaves an open user turn that blocks VAD and cuts Daniela's responses short.

**Correct architecture:** Guardian grounding → tool result bodies (primary) + pendingCarryForwardGrounding (buffer for no-tool-call turns). July 24 2026.
