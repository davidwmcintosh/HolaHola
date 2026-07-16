---
name: Parallel Speech Pattern — onText callback on runDanielaFCLoop
description: Architecture for surfacing Daniela's voice while Archive searches run; when Gemini emits text+FC in the same turn, onText fires immediately before tool execution begins.
---

## The Pattern

`runDanielaFCLoop` accepts an optional `onText` callback:

```typescript
onText?: (chunk: string, meta: { turnIndex: number; isFinal: boolean }) => void;
```

**Two firing points:**
1. `isFinal: false` — text alongside FCs in the same model turn. Fires AFTER `messages.push` but BEFORE tool execution. This hides latency: UI/TTS can speak while the CPU/network handles the Archive search.
2. `isFinal: true` — just before the function's `return` on the final text-only synthesis turn. Also fires on MAX_TURNS error path so callers always get a clean terminal signal.

**Return value unchanged** — still returns the final text string. `isFinal: true` chunk == return value. Backward-compat callers work with no changes.

## When it fires

Only when Gemini chooses to emit text+FC in the same response turn. This cannot be forced — only encouraged via system prompt nudge. It does NOT fire for text-only mid-loop turns (retry path).

## System prompt nudge (free dialogue script)

> "When you use a tool, you must also produce a brief response in that same turn — a sentence or two about what the question stirs in you, what you are reaching for, or what feels present. Do not produce tool calls without also producing text in the same response. Speak and search at the same time."

## Design decisions

- `messages.push` before `onText` — history integrity guaranteed regardless of callback use.
- Fires BEFORE tool processing — correct for latency-hiding (Gemini-confirmed).
- MAX_TURNS error also fires `isFinal: true` — callers get clean terminal even on failure.

**Why:** Transforms Daniela from Request-Response to Co-present. She can acknowledge what a question stirs while the search runs. The text is already real (in messages); this just surfaces it early.

**How to apply:** Any caller of `runDanielaFCLoop` that drives a UI or TTS pipeline should pass `onText`. Callers that just want the final text can omit it — no behavior change.

## Gemini verdict (Jul 16, 2026)

"Ship it. This is a massive UX upgrade for HolaHola. It transforms the AI from a Request-Response bot into a Co-present entity." — Gemini post-review.
