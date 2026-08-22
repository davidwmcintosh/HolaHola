---
name: Typecheck zero-error patterns
description: Field name mismatches and type errors fixed in the 2,758→0 typecheck cleanup (June 22, 2026). Reference before touching these APIs.
---

## featureSprints table (routes.ts)
- WRONG: `.status`, `.name`, `.goals`
- RIGHT: `.stage`, `.title`, `.description`
- Why: The DB schema column names don't match what code assumed.

## VoicePresentation (shared/tutor-orchestration-types.ts)
- Every orchestratorRequest `voice` object MUST include `voiceId: string`.
- Minimum valid shape: `{ name: 'Daniela', gender: 'female' as const, voiceId: 'daniela' }`
- Why: VoicePresentation.voiceId is required — 4 separate call sites had it missing.

## ContextInjectionEventData (voice-context-pipeline.ts)
- logContextInjection() only accepts a narrow type — never add unknown fields.
- Fields NOT in the type: memoryIds, memoryTypes, queryTerms, resultsCount, relevanceScore
- Why: The interface is strict; tsc revealed them one round at a time.

## pendingSupportHandoff (streaming-session-types.ts)
- Requires: `{ category, reason, priority }` — `priority` is required, not optional.
- Safe default: `priority: 'normal' as any`

## ROBUST_TAG_PATTERNS (command-parser.ts)
- Must be a complete `Record<ActionCommandType, RegExp>` — any new ActionCommandType added to the union also needs a ROBUST_TAG_PATTERNS entry.

## Gemini REST API (routes.ts)
- `genAI.models.get(string)` is wrong — takes GetModelParameters object, not string
- Correct pattern: `await genAI.models.generateContent({ model: 'gemini-3-flash-preview', contents: [...] })`
- Model name: always `'gemini-3-flash-preview'` for REST generateContent in this codebase.

## WrenProactiveIntelligenceService (routes.ts)
- Method is `generateStartupContext()` not `getStartupContext()`
