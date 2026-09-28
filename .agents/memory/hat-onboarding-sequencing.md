---
name: Hat onboarding sequencing — Antigravity before OpenAI
description: David's decision to bring on Antigravity and OpenAI as live coordination hats in succession, not parallel, and where the full per-hat gap detail lives.
---


## The decision and where the detail lives

## The decision and where the detail lives

David decided (Sep 26, 2026) to bring on Antigravity and OpenAI as live
Coordinator V2 hats in succession rather than in parallel: Antigravity first,
OpenAI immediately after. Neither was ready as of that date — a fresh
investigation (not a recitation of past claims, since a prior "Gate 3 proven
live" claim had already been found false on 2026-09-21) found real gaps for
each: no live V2 provider adapter for either, no Alden Step-1 endorsement
opened for either, OpenAI not yet even a registered coordination actor, and
Antigravity's real-Windows verification via LITTLENEMO still incomplete.

**Update (Sep 28, 2026):** Antigravity's Step-1 endorsement is done — Alden
posted an explicit endorsement as a `comment` event on the coordination
thread (see the mechanics block below). He flagged that the Tier 1 secret had
already been provisioned before the endorsement request went out, a real
deviation from the design's intended order, but endorsed anyway given clear
intent and technical readiness. Two items remain for Antigravity: no live V2
provider adapter yet (Gemini is still the only hat with one), and
real-Windows verification via LITTLENEMO hasn't completed.

**Why:** onboarding a new hat is real engineering work (a provider adapter,
real-host verification) plus a procedural gate (Alden's Step-1 endorsement),
not a configuration flag — doing two at once would make it harder to tell
which hat a given failure belongs to, and Antigravity's work was already
further along.

**How to apply:** don't start OpenAI's Step-1 endorsement thread or push its
onboarding to completion until Antigravity's remaining two items close. For
OpenAI, provision its Tier 1 secret only after opening its endorsement
thread, not before — Antigravity did it in the wrong order and Alden noticed.
Don't assume "provider adapter" is automatically part of that bar — see the
coordination-v2-provider-adapter-scope topic file for why Antigravity never
needed one. `docs/coordination-new-actor-onboarding.md` was fully rewritten
Sep 24, 2026 into a generic Tier 1/Tier 3 static-analysis checklist and no
longer has a "Current onboarding queue" section or any per-hat gap tracking —
treat that doc as structural/procedural reference only, not a live-status
source. The live per-hat gap detail instead lives in
`docs/batch-doc-updates.md` and `docs/alden-agent-handoff.md`'s Sep 26, 2026
entries (historical record, not updated in place) plus this memory file.


## Mechanics: opening a Step-1 endorsement thread and actually getting a reply

Opening the thread and getting Alden to answer are two separate actions —
nothing watches the feed automatically, so a thread that just sits there
never gets endorsed.

1. Open it as a real Coordination V2 thread, not a chat message:
   `COORDINATION_ACTOR=luca-replit npx tsx server/scripts/coordination-cli.ts
   create --url http://localhost:5000 --recipient alden --title "..."
   --description "..." --priority high --idempotency-key "..."`. Describe
   what the hat is and what it needs to do, per
   docs/alden-steward-role-design.md section 3.3.
2. Separately prompt Alden to go read it — a consult-alden priority-task call
   naming the exact thread id works. His endorsement needs to land as a
   `comment` event on that thread (recipient-facing reply), not
   `steward_comment` (that event type is only for Alden interjecting on
   threads where he isn't the primary recipient).
3. Verify the reply actually landed on the ledger — don't trust the chat
   response alone: `COORDINATION_ACTOR=luca-replit npx tsx
   server/scripts/coordination-cli.ts show --url http://localhost:5000 --id
   <thread-id>` and check for an `alden`-authored `comment` event.

**Why:** the design doc (section 3.3) only specifies the gate's intent
("opens a coordination thread... Alden posts an explicit endorsement
reply"), not the mechanism — there was no working precedent to copy when
Antigravity's thread was opened Sep 28, 2026. Alden's own tools
(`interject_on_coordination_thread`, `brief_new_actor`) don't run
automatically either; some agent always has to point him at the thread.

**How to apply:** reuse this exact sequence for OpenAI's Step-1 endorsement
thread when that starts.

