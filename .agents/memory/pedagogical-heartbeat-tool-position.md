---
name: Pedagogical heartbeat tool position
description: GL 64-tool cap and parametersJsonSchema pattern for system heartbeat tools in HolaHola.
---

# Pedagogical Heartbeat Tool — Registry Position and Schema Pattern

## The rule

Any tool that must be called in every GL session (system heartbeat, session state, etc.) must be placed at **position #1** in the `const registry: DanielaFunctionEntry[]` array in `server/services/daniela-function-registry.ts`.

## Why

Gemini Live has a hard 64-tool cap. The GL session config serializes the registry array in order. If a tool is at position #140, it is guaranteed to be excluded. Semantic search over `tool_knowledge` does NOT inject tool declarations into the GL session dynamically — it only adds text context. The model will attempt to call the tool, the runtime will fail to find the function mapping, and the call will silently fail or hang.

## How to apply

- Heartbeat/system tools → position #1 in registry array
- Scenario-specific tools → fine anywhere in the first 64 positions
- Rarely used or heavy tools → place after position 64 or use `excludeFromGL: true`

## parametersJsonSchema pattern

Always use `parametersJsonSchema` (not `parameters`) for new tool declarations. `parameters` expects the Google SDK's `Type` enum (`Type.OBJECT`, `Type.STRING`, etc.) — using raw string literals (`'object'`, `'string'`) causes TS2820 errors. `parametersJsonSchema` accepts plain JSON Schema strings without TypeScript enum imports.

```typescript
// CORRECT
parametersJsonSchema: {
  type: 'object',
  properties: {
    my_field: { type: 'string', enum: ['a', 'b', 'other'] },
    my_array: { type: 'array', items: { type: 'string', enum: ['x', 'y'] } },
  },
  required: ['my_field'],
}

// WRONG (TS2820 errors)
parameters: {
  type: 'object' as const,  // TS error: not assignable to Type | undefined
  ...
}
```

## Array vs string for multi-value fields

Use array type with enum + `other` safety valve for multi-value signal fields:
```
detected_signals: { type: 'array', items: { type: 'string', enum: [..., 'other'] } }
```
Not comma-separated strings — those are brittle and unvalidated.

## Leakage prevention for internal frameworks

If a tool encodes an internal framework (gear names, pedagogical states, etc.) that should never be spoken aloud:
1. Put the full definition + negative constraint **in the tool description** (not the system prompt)
2. System prompt: short pointer line only — "Follow the framework defined in the [tool_name] tool. Never mention [internal terms] to the student."
3. This forces GL to read the framework from tool documentation (capability space) not persona space, reducing leakage risk.
