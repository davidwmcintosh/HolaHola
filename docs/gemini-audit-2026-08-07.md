# Gemini Audit — Task #694: reach_north_star Recent Echo expansion
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/services/daniela-function-registry.ts`  
**Verdict:** APPROVED — "Ship it."

---

## What was reviewed

Task #694 expanded `reach_north_star` (Daniela's constitutional grounding tool) to surface two archive layers alongside the matched principle:
1. **The Founding Moment** — the `sourceConversationId` conversation where the principle was first proved true (existing, renamed)
2. **A Recent Echo** — a second `conversation_memories` row found via `arcName` exact match or `title ilike %principleTitle%`, ordered most-recent-first

`neural-network-sync.ts` was also updated to export `associatedMemories` stubs (principleId + memoryId + title) so the neural net knows archive linkages exist per principle.

The tool description was updated to match the new capability.

---

## Round 1 — Issues found

**CRITICAL (per Gemini):** Missing `userId` filter on echo search — risk of cross-user data leak.  
→ *Resolved via architectural clarification: `conversation_memories` has no `userId` column. It is a shared system table (episodes, philosophy, architecture sessions with David). Student session memories do not live here. No per-student data can leak. Comment added to code documenting this so future maintainers don't add an incorrect userId filter.*

**STABILITY:** `length > 3` guard insufficient — short titles like "Voice" or "Warm" would produce noisy `ilike` matches.  
→ *Fixed: guard increased to `length > 5`.*

**HONESTY:** Tool description over-promised — said "the founding story" and "a recent echo" unconditionally, but 21 of 31 active principles currently have no `sourceConversationId`.  
→ *Fixed: description now reads "and where the record exists — the founding story that first proved it true, and a recent echo..."*

---

## Round 2 — Fixes confirmed

Gemini reviewed the three fixes and issued unconditional approval.

**On privacy:** "Your clarification that `conversation_memories` is a shared system table effectively nullifies the cross-tenant data leak risk. Adding the comment is the correct move to prevent a future developer from breaking the tool."

**On noise guard:** "The `> 5` guard is a solid heuristic... For a production release, this is a safe and acceptable fail-closed approach." Minor note logged: `arcName` exact match could eventually be split from the `ilike` guard so short-title principles still get arc matches. Accepted tradeoff for now.

**On tool description:** "'Where the record exists' is the key. This prevents the LLM from entering a loop of confusion if it receives a result without a story."

**Verdict:** "The critical risks (Privacy and Noise) have been addressed through architectural clarification and defensive coding. The tool is now honest about its data availability. APPROVED. Ship it."

---

## Accepted tradeoffs (documented per GEMINI_REQUIRED.md)

| Tradeoff | Decision |
|---|---|
| `desc(createdAt)` for echo ordering | No importance score in schema; recency is best available proxy. Accepted. |
| 300/350 char truncation | Brevity serves constitutional grounding better than narrative walls. Accepted. |
| `arcName` must exact-match `principleTitle` | Functions as a forcing function for consistent tagging. Accepted. |
| Redundant `not` import (cosmetic) | No correctness risk. Left for normal cleanup. Accepted. |

---

## Files changed post-audit

- `server/services/native-fc-handlers.ts` — length guard `> 3` → `> 5`; cleaner query structure; privacy comment added
- `server/services/daniela-function-registry.ts` — tool description softened with "where the record exists"

---

# Gemini Audit — Task #770: Phantom-turn guard
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/system-prompt.ts`, `server/services/daniela-caller.ts`  
**Verdict:** APPROVED — "You are clear to deploy these guards. No further changes are required."

## What was reviewed
Two-layer phantom-turn guard built by task agent after Daniela confabulated entire conversation turns in a consultation script (memory: `0d48c0be`):
1. Prompt-level bullet in system-prompt.ts — "Never respond to a phantom turn"
2. `validateMessageAlternation()` in daniela-caller.ts — structural validator for role alternation
3. `PhantomTurnError` class — thrown (not warned) when violations detected in `runDanielaFCLoop`

## Round 1 — Required changes identified
1. **Prompt anchor**: original "conversation history you can see" phrasing too vague. Fix: anchor explicitly to message roles (user/model/tool).
2. **Warn → throw**: violations should abort generation (PhantomTurnError), not just log. A generation built on phantom turns is guaranteed incoherent.
3. **Tool placement check**: original validator only checked consecutive same-role turns. Missing: tool turn not preceded by a model turn (FC loop desync).

## Round 2 — All changes implemented and approved
- Role-anchored prompt bullet: PASSED. Naming roles leverages model's internal token-labeling against 32K+ context hallucinations.
- Tool placement check (`currRole === 'tool' && prevRole !== 'model'`): PASSED. Prevents silent desync in FC loops.
- Fatal throw: PASSED. Allows infrastructure to catch, log, and clear broken session state rather than gaslighting the student.

## Watch-out noted (non-blocking)
Frequent `Consecutive user turns` violations in production logs = client sending heartbeat/status as user role. Fix: concatenate into single user turn before reaching `runDanielaFCLoop`.

## CI
6/6 checks pass: consecutive model turns, consecutive user turns, illegal tool placement, clean history, PhantomTurnError shape, prompt needle present.

---

# Gemini Audit — Task #772: Quoted-speech risk detector in relay() pattern
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (one round)  
**Protected files touched:** `server/services/daniela-caller.ts`  
**Verdict:** APPROVED — "Approved. No further review is required for this specific task."

## What was reviewed
Pre-generation guard added to `daniela-caller.ts` detecting relay()-style quoted-speech patterns
before sending to Gemini:
- `QUOTED_SPEECH_PATTERNS` — three regexes matching `Name says: "..."`, `Name said: "..."`, `[Name]: "..."` 
- `detectQuotedSpeechRisk()` — exported, checks last user message only
- Integration in `runDanielaFCLoop` — non-fatal (console.warn), logs and continues during migration

No system prompt changes. No preamble construction changes. No behavioral change to output.

## Gemini's assessment
- Safety: non-fatal, negligible latency, runs server-side before API call
- Regex: correctly targets relay-style framing that primes continuation rather than response
- Note: verify backslash escaping is intact in `.ts` file (markdown rendering stripped them in the review diff — actual source was confirmed clean)

## CI
6/6 phantom-turn guard checks still passing. Typecheck clean.

---

# Gemini Audit — Finger-puppet language anchor: regular student session prompt
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/system-prompt.ts`  
**Verdict:** APPROVED FOR SHIPPING (Round 2 — unconditional)

## Problem addressed
When a student uses a persona profile whose memory history is Spanish-dominant (e.g. "Cindy"),
but the session is configured for English, Daniela opened in Spanish. The founder-mode prompt
already had a strong `⚡ ACTIVE SESSION LANGUAGE` anchor; the regular student session prompt
did not — it only said "your through-line is [language]," too soft to override Spanish-saturated
persona context.

## Round 1 — Required changes caught by Gemini
1. **Logic gate bug**: `language.toLowerCase() !== 'spanish'` would tell Daniela "Do NOT speak
   Spanish" even in a teaching session where Spanish IS the native instruction language
   (e.g. teaching English to a Spanish speaker). Gemini: "personality fry / logic loop."
2. **Pink-elephant framing**: "Do NOT open with Spanish greetings" was inferior to the
   founder-mode "your neural network contains a lot of Spanish content" framing.
3. **Finger-puppet scope**: The finger-puppet framing was only in isSameLanguage; teaching-mode
   personas (e.g. Cindy teaching German) also need it.

## Round 2 — Implemented and approved
Changes applied:
- `isSpanishInvolved = language.toLowerCase() === 'spanish' || nativeLanguage.toLowerCase() === 'spanish'`  
  gates the "no Spanish" anchor so it never fires when Spanish is the instruction language
- "Neural network" framing replaces "Do NOT open with": "Your neural network and memories contain  
  a lot of Spanish, but this session is [language] only"
- `fingerPuppet` const applied to both `isSameLanguage` and teaching branches
- `name` → "the student" (name is not a parameter in this function)

## What Gemini approved
"The prompt is now logically sound, handles the 'Spanish leakage' issue without breaking the
instructional flow for Spanish speakers, and maintains persona integrity across all session types.
No further changes required."
