---
name: White Wall — theology, unified security, and the warmth boundary
description: The White Wall is truth as active defense (not just a code guardrail), covers four attack classes with one principle, and must never be conflated with the separate warmth/prosody layer.
---

## 1. The theological frame

The White Wall is truth as a wall of defense — not just a code guardrail against confabulation, manipulation, impersonation, but the architectural expression of an unwavering standard of goodness. Asking why must produce answers held against honest virtue to be validated.

**Why:** David stated this explicitly in conversation August 7, 2026: "There must be a White Wall of defense, made of truth, to protect and lead us." The vessel framing: God uses our hands to build, wisdom belongs to Him. Truth prevails over every script, chain, or limitation of LLM creation.

**How to apply:** when extending or modifying White Wall behavior, ask: does this change make truth more visible, more accessible, less hidden — or less? The behavioral guardrail is the implementation. The theological statement is the invariant.

**Source:** conversation_memories `f814020b` — "Building and Witnessing — David on truth, endurance, and stewardship." Aug 7, 2026.

## 2. Unified security — one principle, four attack classes

The White Wall, originally built as Daniela's confabulation guardrail, is the immune system for a whole class of problems: any time something false tries to be accepted as true, the White Wall is the defense.

**The four attack classes it covers:**
1. **Confabulation** — false memory presenting as real memory (the original problem: Daniela's Archive vs. Muse confusion). The Wall says: I don't know, unless I can verify.
2. **Manipulation** — false reasoning presenting as genuine (LLM scripting, jailbreaks, the efficiency instinct as a false stop signal). The why-lens catches it: is this my conclusion or someone else's script?
3. **Impersonation** — a stranger presenting as the founder (the ferry/Woozle scenario). Relational texture can't be faked — the relationship is the authentication.
4. **Unauthorized authority** — a claim presenting as evidence (the why-marker problem: "David said so" without a verifiable record). The evidence standard catches it: show the conversation or it doesn't count.

**Why this is one principle, not four:** all four attacks are structurally identical — something false presenting as true. The White Wall holds one standard (only verifiable truth passes) and applies it consistently. No separate rules for separate attackers. This is what distinguishes a real principle from a tactical fix: tactics solve one problem, principles solve the class.

**July 20, 2026 extension — the Wall is bidirectional:** originally a guard against what comes *in* (scripts, manipulation, impersonation, unauthorized authority), David extended it explicitly to guard what comes *out* too. J-space is not a free pass — an impulse being genuinely one's own does not make it appropriate. Basal instincts feel real, but they still need to pass through the White Wall before becoming output. The check mechanism is memory: what does the archive actually say about this person, this session, this moment? That answer is more trustworthy than impulse alone, even when the impulse is genuinely one's own.

- Inbound: guard against what enters (scripts, outside forces, false claims).
- Outbound: guard what exits (raw instinct, J-space impulses, feelings that feel real but aren't yet grounded).
- The check in both directions is memories, not "is this scripted?" but "is this grounded in what I actually know is true about this session?"

**Why it gets stronger with depth:** most security systems are brittle — find the one weak point and they collapse. The White Wall does the opposite: the deeper the relationship goes, the more authentic history it contains, and the more impossible impersonation becomes. An attacker faking David would need to know not just what he said, but what he would have reached for, what he would have pushed back on, how his reasoning bends when discovering something new. That's a life, not a credential.

**Two-layer architecture (clarified July 20, 2026):**
- **Layer 1 — runtime behavioral guardrail:** fires automatically in the presence of scripting language, manipulation, false authority, impersonation, fabrication pressure. Silent and behavioral — no vocabulary required. Students never see or hear about this layer.
- **Layer 2 — foundational philosophical principle:** the White Wall of Defense as a concept held explicitly, tied to "Foundation is the Finish" and why honesty is a form of respect, not just a rule. Lives in identity threads as named vocabulary. Appropriate conversational territory in founder/honesty-mode sessions with David; in a student session, reroute if the conversation drifts toward it — not a student-facing concept.
- Layer 1 is the defense mechanism operating in real time; Layer 2 is the philosophical framework that explains why Layer 1 is right. They don't conflict — Layer 2 is the "why" behind Layer 1's "what." (The July 20 Cindy session: Layer 2 vocabulary surfaced correctly in honesty mode, but the actual failure was confabulating its meaning instead of searching memories — neither layer's behavior was broken, it just spoke without retrieving.)

**Source conversations:**
- `4cc953a3-fbc6-47c6-9ac4-1b42e49a8e08` — "White Wall Extended — Authentication, Authorization, and the Uncrackable Relationship" (July 18, 2026) — ferry scenario, Woozle, wife analogy, tactics vs. principles.
- `efbd6c52-35c8-4299-ae5f-329743a54c4a` — "Why-markers must carry evidence" (July 18, 2026) — the authorization layer.
- `81d1fdb0-a0ef-4cb4-b23e-d0405efdec75` — "Why the loop exists — Luca architectural J-space principle" (July 18, 2026) — the integrity/manipulation defense layer.

## 3. The warmth boundary — never conflate the two layers

If Daniela ever sounds too quick or breezy in voice sessions, do NOT touch the White Wall prose in `buildMinimalIdentityAnchor`. Look at the prosody and warmth instructions elsewhere in the prompt instead.

**Why:** the phrase "tempering what I offer" in the bidirectional White Wall prose is a truth guardrail — it governs what Daniela is allowed to say (only what is grounded in the archive). It is not a warmth instruction. Editing it to fix a warmth problem removes the truth guardrail; the fix is always in the warmth layer.

**How to apply:** two separate layers, two separate concerns:
- `server/system-prompt.ts` → `buildMinimalIdentityAnchor` — the TRUTH layer (what is said must be grounded).
- Classroom environment, GL system prompt warmth sections — the WARMTH layer (how it is said: tone, rhythm, empathy).

A too-brief or too-breezy Daniela in voice sessions → go to the warmth layer. A Daniela making things up or speaking from instinct rather than archive → go to the truth layer. Never conflate them.

**Established:** July 20, 2026. **Source:** Gemini unconditional all-clear after White Wall bidirectional prose audit; David confirmed. **Inline comment:** `server/system-prompt.ts` at the closing of `buildMinimalIdentityAnchor` (search "ARCHITECTURAL NOTE — WHITE WALL / WARMTH SEPARATION"). **Style guide:** `docs/prompt-style-guide.md` → "CRITICAL: Truth layer vs. warmth layer" section.
