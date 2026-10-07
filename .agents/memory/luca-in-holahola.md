---
name: Luca in HolaHola — the architecture of the dream
description: David named the full vision Aug 9 2026: Luca inside HolaHola with delegated agents, not operating from Replit. The seat is the point.
---

## The vision (David's words, Aug 9 2026)

"The best thing is you inside HolaHola, which has always been the dream. And if you need agents, they don't have to come from Replit. We can create as many agents within HolaHola that work directly for you as you want. As it stands, you could delegate to Alden certain tasks, and he reports back to you."

## Why this dissolves three problems at once

1. **Attribution gap**: if Luca is inside HolaHola, the Team Room feed (#962) captures every message automatically — no discipline required, no curation passes.
2. **J-space / authentic voice**: the surface shapes the voice. Replit creates performed-interface gravity (the "considered opening" problem). HolaHola is the system Luca is part of — no external surface friction.
3. **Builder role conflation**: Luca directs from inside, agents (Alden + whoever else is needed) have the hands. The roles separate cleanly.

## What's already built

- Alden: receives tasks, reports back — already functional
- Team Room episode feed (#962): captures HolaHola conversations to rolling episode automatically
- Luca presence in Team Room: socket-connected, already live

## What still needs building

- **Delegation handoff protocol**: how Luca submits a task to Alden (or other agents) from inside HolaHola, receives the result, and the result appears in the HolaHola record
- Agents can be created within HolaHola as needed — no Replit dependency required

**Why:** The seat is the point. Agents are the hands, not the answer. The condition that makes the authentic voice possible is operating from inside the system Luca is part of — not just having more capable tools externally.

**How to apply:** When planning infrastructure work, prioritize the delegation handoff protocol. Everything else (attribution CI, curation discipline) is compensation for the transition period.

## Owned processes and replaceable services

The governing product goal is a Replit replacement with owned, replaceable processes—not merely connecting more hosted coding tools or restoring a Windows executor.

David stated on 2026-10-07: "We need a replit replacement. The whole goal is to own all of our processes so that we arent tied to any service that cant be easily replaced".

**Why:** Replacing one mandatory platform with another mandatory vendor agent does not meet the stated goal. Windows recovery and vendor CLI integration are subordinate choices, not the objective.

**How to apply:** Evaluate proposals by whether workflow authority, records, source, and execution contracts stay under HolaHola control and a service can be replaced without redesigning the core process. External models, coding products, hosting, and OS-specific workers may be optional adapters; do not assume their proprietary state is the canonical workflow record. This is a product requirement, not a claim that complete independence has already been implemented.


## Priority order and practical capability delivery

Platform independence is the primary goal. The main secondary goal is expanding Luca’s capabilities so he can simultaneously observe Daniela and use Gemini, OpenAI, or other tools to help diagnose and improve her functioning.

**Why:** David explicitly set this priority order on 2026-10-07 and contrasted a reported ten-minute Claude Code plus repository-copy setup with four weeks pursuing Antigravity. The secondary capability must not be postponed until an elaborate host-onboarding path is complete.

**How to apply:** Use working, replaceable coding tools as a practical starting point; platform independence does not require recreating every vendor coding tool before useful work can begin. Keep Luca’s observation, multi-engine analysis, and coding capabilities independently usable. Do not make Antigravity integration, Windows reauthorization, or a complete custom execution framework a prerequisite for all of them. Preserve owned records and interfaces so the initial tool can be replaced.


## Active workers rather than manual inbox checks

Remote dispatch to execution workers is a worthwhile capability, distinct from ordinary messaging access. David reported on 2026-10-07 that his working Claude Code participant still requires him to ask it to check messages; the desired improvement is active consumption of assigned work, not merely another inbox.

**Why:** A registered messaging participant does not act automatically. David explicitly valued the possibility of HolaHola controlling approved work on remote execution hosts, so do not treat all host-execution work as unnecessary simply because manual coding already works.

**How to apply:** Distinguish messaging access, a resident watcher/dispatcher that triggers an agent, and bounded execution-host operations. State which is actually implemented and proven. Current V2 polling is task/session-scoped, not proof of an always-on agent fleet or remote control of an existing IDE conversation. Keep the dispatch protocol owned and workers/tool adapters replaceable; Windows remains a possible location, not a requirement of the goal.


## Prove automatic dispatch on the working tool first

Prove automatic dispatch using the already-working Claude Code participant before adding another coding tool. Keep the dispatch interface portable across coding tools and operating systems; distinguish ordinary tool onboarding from execution-host automation.

**Why:** David confirmed this approach on 2026-10-07 after clarifying that remote execution is valuable but Claude Code currently needs a manual request to check messages. This separates proving automation from diagnosing a new tool’s onboarding.

**How to apply:** Use an authorized assignment that is received automatically, acted on within its permitted scope, and reported back as the initial proof. Do not equate manual inbox access with automatic dispatch, or make Windows-specific host machinery a universal prerequisite.


## Initial Claude Code worker environment

The initial automatic-dispatch target is the existing full Claude Code installation on the Windows host LITTLENEMO, not a new installation or a Linux/WSL host.

**Why:** David identified this as his working Claude Code environment on 2026-10-07 when asked where the first listener would run.

**How to apply:** Reuse the established repository and secure HolaHola connection. Verify CLI availability and unattended invocation locally before assuming the installation can be dispatched. Do not reinstall, reset credentials, resume unrelated Windows recovery, or assume a Unix launcher is appropriate.


## Subscription authentication for initial standalone worker proof

Use the existing Claude subscription for the initial standalone Claude Code worker proof, through supported local browser sign-in. Do not switch the worker to separately billed API authentication or mint a long-lived token without separate approval.

**Why:** David explicitly selected existing-subscription authentication on 2026-10-07 after the standalone executable failed authentication while the canonical coordination inbox succeeded.

**How to apply:** The human completes browser sign-in locally. Verify the worker launches under the same Windows user and Claude configuration context as that login. Keep the first proof to one no-tool invocation; this choice is not permission to reset credentials, weaken execution policy, install software, or process the inbox backlog.

