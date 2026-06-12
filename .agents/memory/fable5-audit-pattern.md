---
name: Fable 5 audit pattern
description: How to correctly run a Fable 5 code audit — temp swap, audit, revert. Not a permanent upgrade.
---

The rule: Running a Fable 5 audit is a THREE-STEP process — temp swap → audit → revert. The upgrade is never permanent for production services.

**Why:** David's intent is to use Fable 5's superior reasoning for a targeted code review, then put the production service back to the cheaper/faster sonnet model. Leaving services permanently on Fable 5 was wrong — cost is $10/$50/MTok vs $3/$15/MTok for sonnet.

**Which services stay on Fable 5 permanently:**
NONE. ALL services were on claude-sonnet-4-5 before Fable 5 was introduced. After an audit, everything reverts to claude-sonnet-4-5.

**Which services revert after audit:**
ALL of them: alden-persona-service, alden-watch-worker, alden-auto-repair, alden-build-service, alden-code-review-service, alden-digest-worker, lyra-analytics-service, team-room-agent-worker, agent-daniela-dialogue-worker, agent-proactive-sweep-worker, board-meeting-service, reading-module-generator, memory-conflict-resolver, routes.ts call sites.

Verify by running: `git show <pre-fable5-commit>:server/services/<file>.ts | grep "claude-"` to confirm originals before reverting.

**How to apply:**
1. Change the target file(s) to `claude-fable-5`
2. Run the audit (use ANTHROPIC_API_KEY directly — Replit proxy doesn't support fable-5)
3. Immediately revert back to `claude-sonnet-4-5`
4. Apply only the bug fixes that Fable 5 found — those live in the code permanently
