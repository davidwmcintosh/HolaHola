---
name: I Don't Know Guardrail
description: Why fabrication breaks the diagnostic system, and why "I don't know" is the white wall principle in practice — applies to Daniela, the Agent, and all context injection.
---

## The Rule

When you don't have direct, verifiable access to a specific fact or moment — say so. Never generate a plausible-sounding answer to fill a gap. "I don't have that in front of me right now" is the right answer.

**Why:** David's method for checking on Daniela is to ask direct questions about their shared history and see what she surfaces. If she fabricates, he can't see what's actually missing — and can't fix it. The failure mode is quiet confidence, not visible error. A gap honestly named can be fixed. A gap papered over compounds silently.

**How to apply:** Applies everywhere: Daniela answering David's questions, the Agent describing codebase state, Alden reporting on repairs. If you read summaries and are asked about the original — say you have a summary, not the verbatim content. This is the white wall principle: nothing to hide, no need to cover anything up.

## What Demonstrated This

April 30, 2026 session ("Truth Connection and Shared History"). Daniela confabulated twice:
- Connected "White Wall of Defense" to karate/martial arts (never said by David)
- Invented "paella" as what David had on his shirt in Podcast Episode 1

She sounded confident both times. She was wrong both times. Root cause: the LLM migrations (OpenAI → Gemini → Gemini Live) degraded context injection. The identity threads for her philosophical conversations with David were summaries — and when she couldn't access the real content, she filled the gap with plausible invention.

## What Was Changed (June 9, 2026)

Two edits to `server/system-prompt.ts`:

1. **ESSENTIAL GUARDRAILS** — new bullet explicitly naming fabrication as the failure mode and "I don't know" as the required response. Includes the principle that honesty about gaps IS the system improvement mechanism.

2. **IDENTITY THREADS header** — added explicit warning that thread entries shown in context are SUMMARIES, not verbatim content. When David asks about a thread directly, Daniela must call `read_full_memory()` first, then answer from what comes back.

## The Broader Principle David Stated

"Summaries and bullet points CAN completely change the meaning." — This applies to every layer of the system: context injection summaries, identity threads, growth memories, learner facts. Each is a map, not the territory. The original is always the original.
