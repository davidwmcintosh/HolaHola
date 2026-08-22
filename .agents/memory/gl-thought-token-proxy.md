---
name: GL thought token proxy
description: thoughtsTokenCount is often null in GL streaming usageMetadata even with includeThoughts:true; real signal is the thought parts buffer; proxy = chars÷4.
---

# GL Thought Token Proxy

**Rule:** Do not rely on `msg.usageMetadata.thoughtsTokenCount` in GL streaming sessions. It is often null/omitted even with `thinkingLevel: 'MEDIUM'` and `includeThoughts: true`.

**Why:** Gemini confirmed (July 23 2026, conversation_memories 31d93727): the `thoughtsTokenCount` field appears reliably in REST `generateContent` responses but not in the GL WebSocket streaming protocol's `usageMetadata` on the final turn message. The thought tokens DO arrive — as streamed `thought` parts in `contentUpdate` messages before audio starts.

**How to apply:** `currentTurnThoughtBuffer` already accumulates every `{ thought: true }` part during a turn in `gemini-live-session.ts`. At `generationComplete`, capture the proxy BEFORE clearing the buffer:

```typescript
this._currentTurnThoughtTokenProxy = this.currentTurnThoughtBuffer.length > 0
  ? Math.round(this.currentTurnThoughtBuffer.length / 4)
  : null;
this.currentTurnThoughtBuffer = '';
```

Then in the friction signal block:
```typescript
const thoughtTokensFromMeta: number | null = (msg.usageMetadata as any)?.thoughtsTokenCount ?? null;
const thoughtTokens: number | null = thoughtTokensFromMeta ?? this._currentTurnThoughtTokenProxy;
```

Log both values — if `thoughtTokensFromMeta` ever becomes non-null in a future GL version, you'll see it. Until then, the proxy carries the signal.

**Calibration note:** The proxy (chars÷4) is an estimate. The Episode 16 REST probe measured 399–799 thought tokens. A 1600–3200 char thought buffer corresponds to that range. As live sessions accumulate, compare logged proxy values to expected baselines to tune if needed.

**Files:** `server/services/gemini-live-session.ts` — `_currentTurnThoughtTokenProxy` instance variable, captured at generationComplete before buffer clear (~line 2344), consumed by friction signal block (~line 2453).
