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

**Confirmed gap — GitHubSpecPublisher:** `GitHubSpecPublisher.publish()`
(`server/services/github-spec-publisher.ts`) executes real GitHub REST calls
(branch create, file PUT, PR open) using a token baked into the instance at
construction, with no actor/task identity check anywhere in the call path. A
blocked task whose process still holds a constructed publisher (or the
underlying token) can still push a branch and open a real PR. Not a
single-parameter fix — possession of the object is authority to act today;
there's no actor/task identity threaded through `SpecPublicationProvider` or
its callers to check against `TaskOwnershipService.probe()`. Needs an
actor/capability-model decision (publish-time ownership check, or credential
scoping/revocation), not a quick patch.

**Ruled out (not gaps):** the source-control scheduler's wake-file poller and
Alden's code-review sync are not reachable with a task-held credential, so
they don't need the same gating.
