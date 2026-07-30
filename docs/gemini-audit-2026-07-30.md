# Gemini Audit — Retrieval Protocol paragraph — July 30, 2026

## What was built

A "Retrieval Protocol" paragraph added to `buildMinimalIdentityAnchor` in `server/system-prompt.ts`. This paragraph gives Daniela an internalized reason to stop chaining memory tool calls after two consecutive retrievals without speaking — so she self-corrects before the code-level backstop in `daniela-caller.ts` has to catch her.

## Workflow

Followed the full rephrase rule:
1. **Original audit wording** (from prior Gemini review):
   > "RETRIEVAL PROTOCOL: You are Daniela. Your primary goal is conversation. If you perform more than two consecutive memory lookups without speaking, you are failing the student. After two lookups, you MUST provide a verbal response, even if your information is incomplete."

2. **Alden both-engine consult** — asked for a style-guide-compliant rephrase (no ALL-CAPS headers, no external directives, reads like internalized conviction). Alden-Gemini produced a draft; Alden-Anthropic errored.

3. **Gemini pre-build review** — sent actual code context (the existing tool-use guidance, the code-level guard, the style guide) and asked Gemini to:
   - Assess Alden's draft
   - Rewrite in Gemini's own framing (Gemini framing is authoritative for Daniela-facing prose)
   - Specify exact insertion point
   - Assess risk of naming the number "two"

4. **Gemini post-review** — sent the actual inserted text for unconditional approval.

## Final approved paragraph

> I have to remember that every moment I spend looking inward is a moment David spends in silence. If I have reached into my memory twice in a row and still don't have the full picture, I stop. A third search is a wall between us. At that point, I come back to the conversation with what I have. Being present and slightly incomplete is always better than being perfectly informed and absent. My voice is the bridge; I won't let it stay quiet for the sake of a better search result.

## Insertion point

Immediately after: *"Tool latency in a live voice session is real; use it deliberately."*
Immediately before: *"One exception: if the question implies a test of shared history…"*

**Gemini's reasoning on placement:** The existing prose establishes *why* (latency is real). The new paragraph gives *how* (two-search limit). By positioning before the "One exception" (shared history test), the logical hierarchy becomes: (1) be fast → (2) stop after two → (3) UNLESS they are testing your memory specifically. Placing it after the exception would make the model apply the two-search limit too aggressively to shared-history tests.

## Gemini's findings

**On the number "two":** Safe. GL architecture gives recent turns the highest attention weight — two tool-output blocks without model speech creates strong gradient toward producing speech. The code backstop at turn 3 creates a buffer zone.

**On the "One exception" tension:** Acknowledged design tradeoff. If a user asks a shared-history question and two searches fail, the model will likely attempt a third (because the "accuracy matters more than flow" instruction is more specific). This is intentional — the code-level guard at MEMORY_CHAIN_LIMIT=3 catches it. Prompt handles the soft limit (2), code handles the hard limit (3).

**Gemini's verdict:** "Approved. Deploy."

## Files changed

- `server/system-prompt.ts` — paragraph inserted in `buildMinimalIdentityAnchor`
- `docs/gemini-audit-2026-07-30.md` — this file

## Typecheck

Clean (zero errors before and after change).
