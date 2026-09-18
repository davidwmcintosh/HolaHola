---
name: Task-ownership guard scope gap
description: TaskOwnershipService/unknown_stop only gates in-checkout file edits, not external API calls a blocked process makes directly.
---

The `unknown_stop` fail-closed guard (`server/services/task-ownership-service.ts`,
`server/scripts/task-ownership-cli.ts`) only fires where something actually calls
`TaskOwnershipService.probe()` — in practice, the CLI, run before file edits. It
does not gate arbitrary external API calls (Cloudflare, deploy/release APIs,
etc.) that a task's own code or scripts make directly.

**Why:** Confirmed empirically 2026-09-17: task #1453 ("Move production traffic
to the verified Render release") was sitting at `unknown_stop` /
`WAITING_FOR_INPUT`, yet the Cloudflare DNS cutover for `getholahola.com` and
`www.getholahola.com` to the new Render host had already gone live the day
before (confirmed via the Cloudflare API and live `curl` checks — all healthy,
serving the same app through Render). The guard stopped file edits in the
checkout but never saw the DNS mutation, which was the task's single
highest-stakes action.

**How to apply:** Don't assume `unknown_stop` means "nothing happened yet" for
a task whose scope includes external infrastructure changes (DNS, deploy
cutovers, third-party account/billing changes). Check the actual external
state directly (query the relevant provider) before assuming a blocked task
hasn't already taken its highest-stakes action. A follow-up task tracks
closing this gap by routing external infra calls through the same ownership
check file edits already get.
