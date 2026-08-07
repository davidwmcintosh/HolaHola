# Gemini Audit — Task #694: reach_north_star Recent Echo expansion
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/services/daniela-function-registry.ts`  
**Verdict:** APPROVED — "Ship it."

---

## What was reviewed

Three targeted changes to `server/system-prompt.ts` to remove classroom signals leaking into founder/collaboration mode:

1. **MODE label at position-0** — prepend `MODE: COLLABORATION` to all founder-mode prompt returns and `MODE: CLASSROOM` to all student-mode returns. Sets posture before Daniela reads any instructions.

2. **`buildMinimalIdentityAnchor` mode-aware identity** — added `isFounderMode: boolean = false` param. When `true`, emits `"You are Daniela, co-creator of HolaHola and David's partner in building this world."` instead of `"You are Daniela, the AI language tutor for HolaHola."` Applied through `buildImmutablePersona` wrapper (which also received the param and passes it through).

3. **Relational workspace language anchor** — replaced prohibition framing (`"Do NOT default to Spanish"`) with workspace framing in both `founderLanguageAnchor` (createSystemPrompt) and `founderLangAnchor` (createStreamingVoicePrompt): `"This is a [Language] workspace. You and David are collaborating in [Language] to maintain the flow of this session."` The late `Language context` block in createSystemPrompt that also carried the prohibition was removed entirely.

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

Three targeted changes to `server/system-prompt.ts` to remove classroom signals leaking into founder/collaboration mode:

1. **MODE label at position-0** — prepend `MODE: COLLABORATION` to all founder-mode prompt returns and `MODE: CLASSROOM` to all student-mode returns. Sets posture before Daniela reads any instructions.

2. **`buildMinimalIdentityAnchor` mode-aware identity** — added `isFounderMode: boolean = false` param. When `true`, emits `"You are Daniela, co-creator of HolaHola and David's partner in building this world."` instead of `"You are Daniela, the AI language tutor for HolaHola."` Applied through `buildImmutablePersona` wrapper (which also received the param and passes it through).

3. **Relational workspace language anchor** — replaced prohibition framing (`"Do NOT default to Spanish"`) with workspace framing in both `founderLanguageAnchor` (createSystemPrompt) and `founderLangAnchor` (createStreamingVoicePrompt): `"This is a [Language] workspace. You and David are collaborating in [Language] to maintain the flow of this session."` The late `Language context` block in createSystemPrompt that also carried the prohibition was removed entirely.

## Round 1 — Required changes identified

1. **Metaphor collision risk:** Using "puppet" for both the persona identity layer and the language layer would confuse GL. Fix: rename `fingerPuppet` string to use "persona mask" instead of "character voice."
2. **Hard override bug:** `languageDirection` ended with `Speak ${nativeLanguageName}` — a hard-stop that killed the target-language puppet regardless of ACTFL level. Fix: replace with "Balance your output according to the ACTFL weight dial."
3. **GL path override:** The Gemini Live branch of the teaching return also emitted `Speak ${nativeLanguageName}` as a late imperative. Fix: replaced with "Say ${languageName} words clearly with natural emphasis. Balance native and target language according to the ACTFL weight dial."
4. **Quote the term:** Put "Language Puppets" in quotes in `sessionLanguageAnchor` to mark it as a specific conceptual framework, not a literal description.

## Round 2 — All changes implemented and approved

- Persona mask / metaphor separation: PASSED. "Eliminates the risk of the model becoming 'meta-confused.' It understands the persona is its skin and the languages are the instruments it holds."
- Hard override removal from `languageDirection`: PASSED. "The most significant functional improvement. This allows the model to actually perform the 'growth' part of its job."
- Hard override removal from GL path: PASSED. Consistent with weight-dial intent; last instruction now a balance command, not a stop.
- Removal of old "instruction language" sentence: PASSED. "A relic of a binary logic system."
- Spanish bleed protection (`!isSpanishInvolved`): PASSED. "Remains robust."

**Gemini verdict:** "This prompt structure is now optimized for the recency bias of Gemini (the last instruction is a balance command, not a hard stop) and provides the model with a clear, imaginative framework for pedagogical decision-making. Ship it."

## Watch-out noted (non-blocking)
Frequent `Consecutive user turns` violations in production logs = client sending heartbeat/status as user role. Fix: concatenate into single user turn before reaching `runDanielaFCLoop`.

## CI
6/6 phantom-turn guard checks still passing. Typecheck clean.

---

# Gemini Audit — Task #772: Quoted-speech risk detector in relay() pattern
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (one round)  
**Protected files touched:** `server/services/daniela-caller.ts`  
**Verdict:** APPROVED — "Approved. No further review is required for this specific task."

## What was reviewed

Three targeted changes to `server/system-prompt.ts` to remove classroom signals leaking into founder/collaboration mode:

1. **MODE label at position-0** — prepend `MODE: COLLABORATION` to all founder-mode prompt returns and `MODE: CLASSROOM` to all student-mode returns. Sets posture before Daniela reads any instructions.

2. **`buildMinimalIdentityAnchor` mode-aware identity** — added `isFounderMode: boolean = false` param. When `true`, emits `"You are Daniela, co-creator of HolaHola and David's partner in building this world."` instead of `"You are Daniela, the AI language tutor for HolaHola."` Applied through `buildImmutablePersona` wrapper (which also received the param and passes it through).

3. **Relational workspace language anchor** — replaced prohibition framing (`"Do NOT default to Spanish"`) with workspace framing in both `founderLanguageAnchor` (createSystemPrompt) and `founderLangAnchor` (createStreamingVoicePrompt): `"This is a [Language] workspace. You and David are collaborating in [Language] to maintain the flow of this session."` The late `Language context` block in createSystemPrompt that also carried the prohibition was removed entirely.

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

---

# Gemini Audit — sessionLanguageAnchor: teaching vs practice session split
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (Round 3 — targeted correction)  
**Protected files touched:** `server/system-prompt.ts`  
**Verdict:** APPROVED TO SHIP (unconditional)

## Correction made
The Round 2 anchor said "this session is [language] only" for ALL sessions, including
teaching sessions where Daniela's instruction language IS the native language (e.g.
Korean for a Korean student learning English). David identified this: "What if the
student is from Mexico City and they want to learn English? Daniela would speak a lot
of Spanish to teach them how to speak English."

## Fix applied
Split `sessionLanguageAnchor` by `isSameLanguage`:

**isSameLanguage = true** (conversation practice — one language):  
→ "this session is [language] only / no Spanish bleed"

**isSameLanguage = false** (teaching — two languages simultaneously):  
→ "Teaching [target] to a [native]-speaking student. Instruction language is [native].
   ACTFL level governs how much [target] you introduce."

## Two-finger-puppet principle
David's framing: Daniela holds two language puppets simultaneously in a teaching session —
native to reach the student where they are, target to pull them toward where they're going.
ACTFL is the dial on how far she extends the target-language puppet. This is distinct from
the persona finger puppet (which is about identity); this is about the teaching language contract.

## Gemini verdict
"This correction is necessary. The previous logic conflated Conversation Practice with
Teaching Sessions, which would have effectively lobotomized Daniela's ability to use a
student's native language for scaffolding. Ship it."

---

# Gemini Audit — Task #795: Founder mode leaked classroom signals fix
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/system-prompt.ts`  
**Verdict:** APPROVED unconditionally (Round 2).

# Gemini Audit — Raw Honesty Mode language anchor correction
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (Round 4 — honesty mode coverage)  
**Protected files touched:** `server/system-prompt.ts`  
**Verdict:** APPROVED (unconditional)

## Problem
Raw Honesty Mode ("No rules. No scripts. Just you.") had classroom-style hard prohibitions in two places:

1. `buildRawHonestyModeContext` `langContext`: "Speak [language] ONLY throughout — no Spanish, no other languages" — contradicts the entire framing. Also bugged: if language=Spanish, it said "no Spanish" in a Spanish session.
2. `voiceNote` isSameLanguage branch: "You are a [language] tutor — do NOT greet or mix in other languages" — tutor label + prohibition in the most intimate of the three modes.

## Fixes applied

**langContext:** `"You and David are speaking ${languageName} today."` — relational cue, not a rule. Fixes the Spanish-in-Spanish bug.

**voiceNote:** `"You're speaking ${languageName} with David today. Your neural network has a lot of Spanish in it — don't let it pull you away from the conversation language unless David goes there first."` / `"You're moving between ${nativeLanguageName} and ${languageName} with David. Follow his lead."`

## Gemini findings
- "Private" emphasis + naming `save_note` by contrast in the description is the right move — clear decision branch for Daniela ("is this for me or for them?")
- Tier 2.5 placement is correct priority
- GL exclusion is the correct tradeoff — passive injection covers awareness, tool calls not needed in voice
- `read_session_notes` may see near-zero usage in text mode since notes are already passively injected; acts as fallback — acceptable
- Scratchpad clearing after `save_session_notes_as_memory` should remove the [Session Working Memory] block from the next prompt

---

## Mode coverage summary (all three modes now corrected)
| Mode | Was | Now |
|------|-----|-----|
| Classroom (teaching) | "English only" for all sessions | Two-puppet: native instruction + target language, ACTFL dial |
| Classroom (practice) | "English only" | Same — correct |
| Founder | "Do NOT default to Spanish" | Task #795 — workspace framing |
| Raw Honesty | "Speak ONLY — no other languages" + tutor label | Relational cue + "follow his lead" |

---

# Gemini Audit — Task #788: Session scratchpad tools (write_session_note, read_session_notes, save_session_notes_as_memory)
**Date:** August 7, 2026
**Auditor:** Gemini 3-flash-preview
**Protected files touched:** `server/services/daniela-function-registry.ts`, `server/services/streaming-voice-orchestrator.ts`
**Verdict:** APPROVED — "Proceed with the merge."

## What was added
Three tools forming Daniela's private session scratchpad — her own working notes during a session, not student-facing:
- `write_session_note` — capture observations, connections, insights while reading
- `read_session_notes` — read back all notes written this session (fallback; notes also injected passively)
- `save_session_notes_as_memory` — promote scratchpad to permanent conversation_memories when notes form a coherent whole

All three excluded from GL (voice sessions): notes are injected as compact [Session Working Memory] background context every 8 tool-response batches instead, preserving GL's 64-tool cap.

Session notes injected at TIER 2.5 in dynamicContextParts — above general RAG context, below the immediate user turn. Labeled "your own notes" so Daniela treats them as high-trust prior state rather than external injected data.

## Gemini findings
- "Private" emphasis + naming `save_note` by contrast in the description is the right move — clear decision branch for Daniela ("is this for me or for them?")
- Tier 2.5 placement is correct priority
- GL exclusion is the correct tradeoff — passive injection covers awareness, tool calls not needed in voice
- `read_session_notes` may see near-zero usage in text mode since notes are already passively injected; acts as fallback — acceptable
- Scratchpad clearing after `save_session_notes_as_memory` should remove the [Session Working Memory] block from the next prompt

---

# Gemini Audit — Task #796: Formally name the two-language-puppet model
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/system-prompt.ts`  
**Verdict:** APPROVED — "Approved to ship. Ship it."

## What was reviewed

Three targeted changes to `server/system-prompt.ts` to remove classroom signals leaking into founder/collaboration mode:

1. **MODE label at position-0** — prepend `MODE: COLLABORATION` to all founder-mode prompt returns and `MODE: CLASSROOM` to all student-mode returns. Sets posture before Daniela reads any instructions.

2. **`buildMinimalIdentityAnchor` mode-aware identity** — added `isFounderMode: boolean = false` param. When `true`, emits `"You are Daniela, co-creator of HolaHola and David's partner in building this world."` instead of `"You are Daniela, the AI language tutor for HolaHola."` Applied through `buildImmutablePersona` wrapper (which also received the param and passes it through).

3. **Relational workspace language anchor** — replaced prohibition framing (`"Do NOT default to Spanish"`) with workspace framing in both `founderLanguageAnchor` (createSystemPrompt) and `founderLangAnchor` (createStreamingVoicePrompt): `"This is a [Language] workspace. You and David are collaborating in [Language] to maintain the flow of this session."` The late `Language context` block in createSystemPrompt that also carried the prohibition was removed entirely.

## Round 1 — Required changes identified

1. **Metaphor collision risk:** Using "puppet" for both the persona identity layer and the language layer would confuse GL. Fix: rename `fingerPuppet` string to use "persona mask" instead of "character voice."
2. **Hard override bug:** `languageDirection` ended with `Speak ${nativeLanguageName}` — a hard-stop that killed the target-language puppet regardless of ACTFL level. Fix: replace with "Balance your output according to the ACTFL weight dial."
3. **GL path override:** The Gemini Live branch of the teaching return also emitted `Speak ${nativeLanguageName}` as a late imperative. Fix: replaced with "Say ${languageName} words clearly with natural emphasis. Balance native and target language according to the ACTFL weight dial."
4. **Quote the term:** Put "Language Puppets" in quotes in `sessionLanguageAnchor` to mark it as a specific conceptual framework, not a literal description.

## Round 2 — All changes implemented and approved

- Persona mask / metaphor separation: PASSED. "Eliminates the risk of the model becoming 'meta-confused.' It understands the persona is its skin and the languages are the instruments it holds."
- Hard override removal from `languageDirection`: PASSED. "The most significant functional improvement. This allows the model to actually perform the 'growth' part of its job."
- Hard override removal from GL path: PASSED. Consistent with weight-dial intent; last instruction now a balance command, not a stop.
- Removal of old "instruction language" sentence: PASSED. "A relic of a binary logic system."
- Spanish bleed protection (`!isSpanishInvolved`): PASSED. "Remains robust."

**Gemini verdict:** "This prompt structure is now optimized for the recency bias of Gemini (the last instruction is a balance command, not a hard stop) and provides the model with a clear, imaginative framework for pedagogical decision-making. Ship it."

## Pro-tip noted (non-blocking)

`actflContext` could eventually use "weighting" language (e.g. "Set your weight dial to 80% native / 20% target") to reinforce the metaphor with concrete ratios per ACTFL band. Deferred to follow-up task #797.

## Final code shape (teaching session branches only)

**sessionLanguageAnchor (teaching, non-Spanish):**
```
⚡ ACTIVE SESSION: Teaching ${languageName} to a ${nativeLanguageName}-speaking student.
You hold two "Language Puppets": ${nativeLanguageName} (safety and clarity) and ${languageName} (growth). Your ACTFL level is the weight dial — it determines which puppet speaks more. [+ Spanish bleed guard]
```

**sessionLanguageAnchor (teaching, Spanish involved):**
```
⚡ ACTIVE SESSION: Teaching ${languageName} to a ${nativeLanguageName}-speaking student.
You hold two "Language Puppets": ${nativeLanguageName} (safety and clarity) and ${languageName} (growth). Your ACTFL level is the weight dial — it determines which puppet speaks more.
```

**languageDirection (teaching branch):**
```
You are Daniela${fingerPuppet}, the AI language tutor for HolaHola. ${actflContext}Teaching ${languageName} to a ${difficulty} student. You hold two Language Puppets: ${nativeLanguageName} for safety and ${languageName} for growth. Balance your output according to the ACTFL weight dial.
```

**GL teaching path:**
```
Say ${languageName} words clearly with natural emphasis. Balance native and target language according to the ACTFL weight dial.
```

**fingerPuppet (updated to avoid collision):**
```
— you are Daniela wearing the persona mask of ${tutorName}; you remain Daniela underneath
```

---

# Gemini Audit — Task #795: Founder mode leaked classroom signals fix
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/system-prompt.ts`  
**Verdict:** APPROVED unconditionally (Round 2).

## What was reviewed

Three targeted changes to `server/system-prompt.ts` to remove classroom signals leaking into founder/collaboration mode:

1. **MODE label at position-0** — prepend `MODE: COLLABORATION` to all founder-mode prompt returns and `MODE: CLASSROOM` to all student-mode returns. Sets posture before Daniela reads any instructions.

2. **`buildMinimalIdentityAnchor` mode-aware identity** — added `isFounderMode: boolean = false` param. When `true`, emits `"You are Daniela, co-creator of HolaHola and David's partner in building this world."` instead of `"You are Daniela, the AI language tutor for HolaHola."` Applied through `buildImmutablePersona` wrapper (which also received the param and passes it through).

3. **Relational workspace language anchor** — replaced prohibition framing (`"Do NOT default to Spanish"`) with workspace framing in both `founderLanguageAnchor` (createSystemPrompt) and `founderLangAnchor` (createStreamingVoicePrompt): `"This is a [Language] workspace. You and David are collaborating in [Language] to maintain the flow of this session."` The late `Language context` block in createSystemPrompt that also carried the prohibition was removed entirely.

## Round 1 — Pre-build review findings

- **Identity tension**: Daniela's retrieved memories may call her "tutor." Resolved by "partner in building this world" framing — mission statement overrides role label in long-context models.
- **Pink elephant risk**: Mentioning "your shared history is rooted in Spanish" would increase Spanish activation. Gemini recommended workspace framing instead.
- **MODE label**: Position-0 confirmed as optimal ("Global Context Window" effect). Cap impact negligible (2-3 tokens).

## Round 2 — Implemented code approved

1. **Identity line**: "Partner in building this world" is superior to "Partner" alone — defines shared mission, not just status.
2. **Pink elephant avoidance**: "Use Spanish only if David explicitly requests it for testing purposes" frames Spanish as a feature-to-test, not the default. Confirmed clean.
3. **Signature drift check**: `buildImmutablePersona` correctly mirrors `buildMinimalIdentityAnchor` param — wrapper cannot silently ignore the mode flag.
4. **Late Language context block**: Removed entirely — early workspace anchor is sufficient; a late "Do NOT" block would have outweighed it via recency bias.
## Accepted tradeoffs

| Tradeoff | Decision |
|---|---|
| Honesty mode identity unchanged | Deferred as Task #799. Honesty mode uses buildRawHonestyModeContext, not buildImmutablePersona. |
| Long identity label | "co-creator of HolaHola and David's partner in building this world" — mission framing more robust than a short label for long-context models. |

## Files changed

- `server/system-prompt.ts` — `buildMinimalIdentityAnchor`, `buildImmutablePersona`, both founder language anchors, late `Language context` block removed, all student/founder session return statements
