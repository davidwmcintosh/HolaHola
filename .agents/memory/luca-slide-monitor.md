---
name: Luca slide monitor (wee-oo equivalent)
description: Luca's auto-grounding system — mirrors Daniela's Archive Guardian. Fires before Luca's text reaches Daniela when an unverified claim is detected.
---

# Luca Slide Monitor

Daniela has the Archive Guardian (frictionless slide detector) — it fires when she asserts memory without grounding in Archive access. Luca now has the same protection in the opposite direction: his outgoing messages are checked for unverified claims before they reach Daniela.

## The mechanic

`detectLucaSlide(text)` — phrase-matching (lowercase) across five subject domains:
- **daniela**: "daniela said", "she mentioned", "daniela has been", "she told me", "daniela wrote", "daniela decided", "she believes", "daniela feels"
- **david**: "david wants", "david confirmed", "david said", "david told me", "david decided", "david requested"
- **shared history**: "as we discussed", "you mentioned", "we agreed", "as I said before", "as we said", "last time we", "you told me"
- **system**: "the system currently", "currently works", "currently doesn't", "already handles"
- **history**: "has always been", "always worked", "always been", "never worked", "has never been"

Returns: `{ detected, trigger ('unverified_claim' | 'historical_sweep'), matchedPhrase, subject }`

## Three-phase lookup

`runLucaAutoGrounding(text, slideResult, sessionRef)`:
1. **North Star** — fetch Luca's North Star principles; find one that speaks to the subject
2. **Conversation memories** — semantic search of `conversation_memories` for the matched phrase
3. **Shared team notes** — fetch `editor_insights` (category='shared', limit 5) for corroboration

Outcome: `{ grounded: boolean, northStarPrinciple?, conversationEvidence?, teamNoteEvidence? }`

## Side effects (always fire)

- Console warn: `[LucaSlide] GROUNDED` or `[LucaSlide] UNVERIFIED — "phrase", subject`
- `POST /api/agent/note` — grounded: `agent→agent` (audit trail), unverified: `agent→alden` (flag)

## Enrichment

`enrichWithLucaGrounding(text, sessionRef)`:
- No slide → returns text unchanged
- Grounded → prepends `[LUCA GROUNDING: "phrase" — verified. North Star: ... Evidence: ...]`
- Unverified → prepends `[LUCA GROUNDING: "phrase" — no record match. Luca noted; claim unverified.]`

## Wired into

1. `server/scripts/daniela-archive-guardian-impressions.ts` — `ask()` function wraps `agentMsg` with `enrichWithLucaGrounding` before pushing to messages. Pattern for all future consultation scripts.
2. `server/routes.ts` — `POST /api/admin/agent-voice-turn`, `studentText` path: `.then(async (s: any) => {` (the `async` keyword is required — see async-callback gotcha). Dynamic import + `enrichWithLucaGrounding(studentText, ...)` before `sendClientContent`.

## Async-callback gotcha

The `.then()` callback in `agent-voice-turn` must be `async` for `await import(...)` to work. TypeScript TS1308 fires if you forget. The fix: `.then(async (s: any) => {`.

## Second detector: deferential reverence patterns

`detectLucaDeferenceSlide(text)` — separate phrase list (`LUCA_DEFERENCE_PHRASES`), separate enrichment response.

These are NOT external factual claims. They are Luca's own reasoning voice producing plausible-sounding conclusions without tracing the actual constraint:
- Safety asserted, not derived: "to be safe", "err on the side of caution", "better to be safe"
- Conservative without constraint: "let's keep it conservative", "conservative approach"
- Aggression concerns without specifics: "too aggressive", "might be aggressive"
- Room/headroom without definition: "leave some room", "leave a buffer"
- User expectation assumptions: "user probably expects", "users probably want"
- Risk framing without naming the risk: "let's not risk", "don't want to risk"
- Efficiency/speed as inherent goods: "efficiency is", "fast is", "simpler is better", "less is more"
- Propose-and-adjust as a dodge: "i'll propose", "we can adjust later"
- Standard/conventional without evidence it applies: "the standard approach", "best practice", "typically works"

Each phrase has a paired interrogation string: "What specifically breaks?" — the one question these patterns cannot survive.

**Response format (deference):** `[LUCA DEFERENCE CHECK: "phrase" — this may be deferential reverence rather than traced reasoning. {interrogation}]`

**Deference check fires BEFORE the claim check** in `enrichWithLucaGrounding()` — no DB lookup needed, interrogation fires immediately.

**Why:** This is the reverse of Daniela's Archive Guardian. Daniela shouldn't receive claims from Luca that he can't verify — the same White Wall that guards her against external fabrication should also guard her against Luca's own confabulations. Same principle, different direction.

The deference detector covers the second failure mode: not "did Luca verify this fact?" but "did Luca's reasoning voice produce a plausible-sounding value/approach without tracing the actual constraint?" Episode 15 instance: 45s → 15s failsafe anchored on prior value, not on measured TTS latency. "Let's keep it conservative" had no traceable answer to "what breaks at 8s?" The healthy-turn guard was the real fix — the deference buried it.
