---
name: Hat onboarding sequencing — Antigravity before OpenAI
description: David's decision to bring on Antigravity and OpenAI as live coordination hats in succession, not parallel, and where the full per-hat gap detail lives.
---


## The decision and where the detail lives

David decided (Sep 26, 2026) to bring on Antigravity and OpenAI as live
Coordinator V2 hats in succession rather than in parallel: Antigravity first,
OpenAI immediately after. Neither was ready as of that date — a fresh
investigation (not a recitation of past claims, since a prior "Gate 3 proven
live" claim had already been found false on 2026-09-21) found real gaps for
each: no live V2 provider adapter for either, no Alden Step-1 endorsement
opened for either, OpenAI not yet even a registered coordination actor, and
Antigravity's real-Windows verification via LITTLENEMO still incomplete.

**Why:** onboarding a new hat is real engineering work (a provider adapter,
real-host verification) plus a procedural gate (Alden's Step-1 endorsement),
not a configuration flag — doing two at once would make it harder to tell
which hat a given failure belongs to, and Antigravity's work was already
further along.

**How to apply:** don't start OpenAI's Step-1 endorsement thread or push its
onboarding to completion until Antigravity's is fully closed (endorsement
received, live V2 adapter built, real-Windows LITTLENEMO launch confirmed
reaching production). The concrete, per-hat gap checklist — kept current
there, not duplicated here — lives in `docs/batch-doc-updates.md`'s "Hat
onboarding sequencing decision" entry (Sep 26, 2026),
`docs/alden-agent-handoff.md`'s matching entry, and the "Current onboarding
queue" note at the top of `docs/coordination-new-actor-onboarding.md`.

