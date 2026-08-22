---
name: GL reconnect injection — state-as-knowledge pattern
description: How to frame reconnect context for Gemini Live so Daniela continues seamlessly instead of announcing the disruption.
---

## The rule

When injecting conversation history into a GL reconnect, frame it as something Daniela already holds in mind — not as an instruction.

**Current implementation (`streaming-voice-orchestrator.ts`, `buildGreetingContext()`):**

```typescript
if (isResumedConversation) {
  const historyPreview = session.conversationHistory
    .slice(-4)
    .map(h => `${h.role === 'user' ? 'The student' : 'You'}: ${(h.content||'').slice(0, 250)}${(h.content||'').length > 250 ? '...' : ''}`)
    .join('\n');
  
  contextParts.push(`
Your thoughts are currently focused on the following exchange:
${historyPreview}

Maintain the flow of the lesson seamlessly. Pick up exactly where the conversation left off.
`);
}
```

**Why this framing:**
- "Your thoughts are currently focused on..." defines internal state, not external instruction. GL treats it as something Daniela already knows.
- 250 chars/turn (4 turns = ~1000 chars) gives enough semantic context without bloating the prompt.
- Purely positive directive ("Maintain the flow. Pick up exactly where you left off.") — no negative constraints like "do not mention the disruption." Negative constraints cause pink-elephant activation in LLMs (Gemini flagged this directly).

**What was replaced:** An explicit verbal announcement ("Oh, we got cut off! Let me pick up where we left off...") that caused Daniela to reference the technical disruption out loud and re-recap the lesson.

**Gemini's principle name for this:** "state-as-knowledge" — tell the model what it already knows, not what to do.

## How to apply

Whenever injecting context that should be invisible to the student:
1. Frame it as something the model already holds ("Your thoughts are...", "You recall that...", "You are in the middle of...")
2. Give a purely positive directive for what to do next
3. Avoid "do not X" — tell it what to do instead
4. 250 chars/turn is the sweet spot for history preview in GL (per Gemini review)

**session memory:** conversation_memories `3389ccb8-2bbf-42ae-a121-198f3fb83323`
