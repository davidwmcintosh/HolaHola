---
name: One Daniela Everywhere — refactor pattern
description: Shared FC loop, tool contexts, and mock session so every text-mode Daniela call uses the same runtime path.
---

## The rule
Every text-mode Daniela call — Team Room replies, dialogue scripts, agent probes — routes through `runDanielaFCLoop` from `server/services/daniela-caller.ts`. No caller duplicates the FC loop.

**Why:** Before this refactor, the dialogue script had its own inline FC loop. Fixes and improvements to the Team Room loop didn't propagate. Identity Drift was guaranteed whenever the two implementations diverged.

**How to apply:** Any new text-mode Daniela call must import `runDanielaFCLoop` + the appropriate tool context from `daniela-tool-contexts.ts`. Never copy-paste the FC loop.

## The three exported primitives

- `runDanielaFCLoop(params: RunDanielaFCLoopParams): Promise<string>` — the loop itself
- `buildMockSession(userId, targetLanguage?)` — builds the mock session struct; FC handlers write to it
- `RunDanielaFCLoopParams` interface — includes `existingSession?` for multi-turn scripts

## Tool contexts (server/services/daniela-tool-contexts.ts)

- `TOOL_CONTEXT_TEAM_ROOM` — memory + identity + flag_for_agent + dispatch routing (default for single-turn calls)
- `TOOL_CONTEXT_FREE_DIALOGUE` — same set, appropriate for open conversations and tsx dialogue scripts
- `TOOL_CONTEXT_VOICE_FULL` — all tools (reference; GL uses the full registry, not this)

## Multi-turn dialogue scripts

Create ONE session before the loop, pass it every turn via `existingSession`:

```typescript
const session = buildMockSession(davidUserId);
const loopParams = { ..., existingSession: session };
// Each turn:
const response = await runDanielaFCLoop(loopParams);
```

**Why:** FC handlers write session flags and capability toggles to the session object. Without a shared session, state written in turn 1 is invisible to turn 2.

## Drift guard

After `createDanielaTools(allowedTools)`, `runDanielaFCLoop` warns if any name in `allowedTools` is absent from the registry:

```
[runDanielaFCLoop] CONTEXT_DRIFT — tools not in registry: write_to_self
```

This catches stale allowlists where a tool was renamed or removed.

## Gemini architectural sign-off

July 16, 2026 — conversation_memories: 2295fa01. Four recommendations, all implemented.
