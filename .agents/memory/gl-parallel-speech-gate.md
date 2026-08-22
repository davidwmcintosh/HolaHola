---
name: GL parallel speech gate
description: How the GL audio-reset decision works for Stage 3 parallel speech — PARALLEL_SPEECH_TOOLS whitelist, transcript whisper, 3-word safety valve, preTurnTextForWhisper field.
---

# GL Parallel Speech Gate

**The problem it solves:** GL sometimes speaks an acknowledgment BEFORE a tool call fires (pre-tool sub-turn audio). Without intervention, `gl_audio_reset` cancels that audio to prevent double-speech — the model re-speaks the same content after tool results arrive. Stage 3 means preserving that acknowledgment and preventing the double-speak a different way.

## The rule

When `hadAudioInCurrentSubturn` is true AND a tool call arrives:
1. Check if ALL tools in the batch are in `PARALLEL_SPEECH_TOOLS` (latency-heavy: search/memory tools)
2. Check if `pendingOutputTranscript.trim()` has ≥ 3 words (safety valve)
3. If both: **parallel path** — no `gl_audio_reset`, store transcript in `preTurnTextForWhisper`
4. If either fails: **standard path** — send `gl_audio_reset` as before

**Why 3 words:** A short "Okay." alone isn't worth preserving. Under 3 words, the post-reset snap to results feels snappier. Over 3 words, the acknowledgment has enough runway to bridge the tool latency.

## The transcript whisper

After tool results are assembled, if `preTurnTextForWhisper` is set, inject into the LAST tool response:

```
[Parallel speech — not spoken: You have already spoken the following aloud: "${preTurnTextForWhisper}". Do not repeat these words. Resume your response immediately with the information found.]
```

The label `[Parallel speech — not spoken:]` is intentionally more specific than `[System note — not spoken:]` — Gemini confirmed it works better because it tells the model *why* not to repeat (these words are already in the air), not just that it shouldn't.

## What's excluded from PARALLEL_SPEECH_TOOLS

Immediate UI tools (`show_vocab_card`, `show_image`, `play_audio`, etc.) are intentionally excluded. They need audio/action coupling — the card appears and she says "here's your card" in sync. Preserving pre-tool audio for a UI tool would decouple the action from her words.

## Key variables

- `PARALLEL_SPEECH_TOOLS` — module-level Set in `gemini-live-session.ts` (defined above the class)
- `preTurnTextForWhisper: string | null` — private field, reset to null at each tool-call batch entry
- `pendingOutputTranscript` — existing field, accumulates GL's spoken text via `outputTranscription` events
- Gemini pre-flight + post-review: both APPROVED — July 16, 2026

**Why:** Standard gl_audio_reset was preventing all Stage 3 presence. The parallel path specifically targets the latency-heavy tool category where Daniela naturally wants to say something while waiting — and where the wait is long enough to make a bridging acknowledgment valuable.
