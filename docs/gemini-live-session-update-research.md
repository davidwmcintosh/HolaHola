# Gemini Live: Mid-Session Configuration Updates

**Research date:** June 13, 2026  
**SDK version:** `@google/genai` (installed in this project)  
**Status:** CONFIRMED HALLUCINATION — does not exist at any level (protocol or SDK)

---

## The Question

Gemini 3-flash-preview (in a code-review audit) recommended **State-Based Tool Injection** for reducing "Middle-Loss" — dynamically swapping dispatcher enum values mid-session as the lesson phase changes. It described this as "send a `session_update` mid-stream" without closing the connection.

We verified this against the actual SDK.

---

## What the SDK Actually Provides

The `Session` class (`@google/genai/dist/genai.d.ts`) has exactly **4 public methods**:

```typescript
class Session {
  readonly conn: WebSocket_2;  // ← raw WebSocket, exposed

  sendClientContent(params: LiveSendClientContentParameters): void;
  sendRealtimeInput(params: LiveSendRealtimeInputParameters): void;
  sendToolResponse(params: LiveSendToolResponseParameters): void;
  close(): void;
}
```

There is **no `session.update()`, `sendSessionUpdate()`, or equivalent** in the SDK.

---

## The Protocol Level (the escape hatch)

The underlying `LiveClientMessage` wire protocol has these fields:

```typescript
interface LiveClientMessage {
  setup?: LiveClientSetup;        // ← "SDK users should not send this"
  clientContent?: LiveClientContent;
  realtimeInput?: LiveClientRealtimeInput;
  toolResponse?: LiveClientToolResponse;
}
```

`LiveClientSetup` contains everything you'd want to update mid-session:

```typescript
interface LiveClientSetup {
  model?: string;
  generationConfig?: GenerationConfig;
  systemInstruction?: ContentUnion;   // ← system prompt
  tools?: ToolListUnion;              // ← tool declarations
  realtimeInputConfig?: RealtimeInputConfig;
  sessionResumption?: SessionResumptionConfig;
  contextWindowCompression?: ContextWindowCompressionConfig;
  inputAudioTranscription?: AudioTranscriptionConfig;
  outputAudioTranscription?: AudioTranscriptionConfig;
  proactivity?: ProactivityConfig;
}
```

Because `session.conn` is a public `WebSocket_2` with a `send(message: string): void` method, we **could** send a raw `{ setup: { tools: [...], systemInstruction: {...} } }` JSON message at any time after connection.

---

## Can We Actually Do It?

### Option A: Raw WebSocket Send (Untested)

```typescript
// After phase_shift tool call is received:
const newTools = buildPhaseTools(newPhase);
const newSystemPrompt = buildPhaseSystemPrompt(newPhase);

(this.liveSession as any).conn.send(JSON.stringify({
  setup: {
    tools: [{ functionDeclarations: newTools }],
    systemInstruction: { parts: [{ text: newSystemPrompt }] }
  }
}));
```

**Risks:**
- The SDK comment says "SDK users should not send this message" — it may be silently ignored, or cause an error, or cause undefined behavior
- We don't know if the API treats a mid-session `setup` as an update (delta) or a reset (clears conversation history)
- The WebSocket message format may require additional framing we don't know about
- **This has not been tested and could crash the active session**

### Option B: Session Resumption (Known to exist)

The SDK **does** have `SessionResumptionConfig`:

```typescript
interface SessionResumptionConfig {
  handle?: string;   // session resumption handle of previous session
  transparent?: boolean;
}
```

If the server sends a `SessionResumptionToken` mid-session, we could potentially reconnect with a new tool set and pick up where we left off. But this involves a reconnect and the "transparent reconnect" only works under specific conditions (not during model generation or function calls).

### Option C: System Prompt Injection via `sendClientContent` (Confirmed working)

What **does** work today, without closing the session:

```typescript
// After phase_shift, inject phase context via sendClientContent
this.liveSession.sendClientContent({
  turns: [{
    role: 'user',
    parts: [{ text: `[PHASE UPDATE: You are now in ${newPhase} mode. Available tools for this phase: ${toolList}. Use only these tools until phase_shift is called again.]` }]
  }],
  turnComplete: false
});
```

This doesn't change the actual tool declarations (all 63 are still present), but it uses the recency-bias effect in the context window to make the model strongly prefer the phase-appropriate tools. Effectively "shadow dispatching" via the system context.

---

## What Other Mid-Session Changes Are Possible Today

Using `sendClientContent` (confirmed working, we already use it):

| What you want to change | How to do it today |
|---|---|
| Current lesson topic | `sendClientContent({ turns: [topic injection] })` |
| Active tool set (shadow) | `sendClientContent({ turns: [phase prompt] })` — no hard enforcement |
| Interrupt / redirect | `sendClientContent({ turns: [redirect instruction] })` |
| Tutor persona | Already works via `switch_tutor` tool + handler |
| Voice speed/style | Already works via `voice_adjust` tool + handler |
| Conversation history injection | `sendClientContent({ turns: history })` |

---

## What We Should Test

Before building State-Based Tool Injection around `session_update`, we need to validate whether the raw WebSocket escape hatch works:

```typescript
// Test: send a minimal setup update on an active session and observe
// 1. Does it throw?
// 2. Does Gemini acknowledge it (check for setupComplete in response stream)?
// 3. Does it change which tools are invoked in subsequent turns?
// 4. Does it clear conversation history?
```

A safe test: during a dev session, after receiving the first tutor greeting, send a raw `{ setup: { tools: [] } }` and see if subsequent tool calls fail (which would confirm the tools were updated) or succeed (which would confirm the setup was ignored).

---

## Recommendation for State-Based Tool Injection (Current Path)

Given that `session_update` is not confirmed:

1. **Phase 1 (Now):** Implement tool consolidation (merge redundant tools, demote inner-life tools to a dispatcher) to reduce native count from 59 to ~12-15. This is independent of `session_update` and reduces Middle-Loss immediately.

2. **Phase 2 (Validate):** Run the raw WebSocket `session.conn.send()` test to see if mid-session setup updates are accepted. Do this in a throwaway dev session, not production.

3. **Phase 3 (If validated):** Build the full State-Based Tool Injection system with `phase_shift` triggering `session.conn.send({ setup: { ... } })` to swap dispatcher enums. If NOT validated, fall back to system-prompt shadow dispatching.

---

## Related Files

- `server/services/gemini-live-session.ts` — Session connect and tool passing
- `server/services/daniela-function-registry.ts` — All tool declarations + dispatcher definitions
- `server/services/streaming-voice-orchestrator.ts` — `createSession()` + live session lifecycle
- `docs/gemini-audit-full-toollist-2026-06-13.md` — Full Gemini 3-flash audit that recommended session_update
