---
name: Owner-managed OpenAI credential
description: HolaHola uses David's direct OpenAI credential, not Replit's AI proxy or legacy project key.
---

All runtime OpenAI clients use `USER_OPENAI_API_KEY` against `https://api.openai.com/v1`. Do not add a fallback to `AI_INTEGRATIONS_OPENAI_API_KEY` or `OPENAI_API_KEY`.

**Why:** David explicitly chose owner-managed LLM credentials so usage, billing, and key lifecycle remain under his control rather than Replit's managed proxy.

**How to apply:** When adding an OpenAI client, require `USER_OPENAI_API_KEY`; keep the runtime credential guard and its negative self-check updated with the set of active client files.