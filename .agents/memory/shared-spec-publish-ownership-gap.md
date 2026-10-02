---
name: Shared-spec GitHub publication has no task-ownership gate
description: GitHubSpecPublisher.publish() pushes a real branch+PR to GitHub, authorized only by a coordination-actor token (luca-replit defaults to policy_admin) — no task-ref/unknown_stop check, unlike the infra-mutation-guard sites.
---

`server/services/github-spec-publisher.ts`'s `GitHubSpecPublisher.publish()`
is a genuine credentialed external mutation (creates a branch, PUTs file
content, opens a pull request against the real configured GitHub repo via
`SHARED_SPEC_GITHUB_TOKEN`). It's reached through
`SharedSpecPublicationService.publish(actor, publicationId)` →
`POST /publications/:id/publish` (`server/routes/shared-spec-routes.ts`,
wired up in `server/adapters/hola-hola-shared-spec-bootstrap.ts`).

Authorization there is `requirePublicationManager`: the original requester,
or anyone whose authenticated actor has `policy_admin` capability.
`HolaHolaSharedSpecAuthenticator` reads `x-shared-spec-token` /
`x-coordination-token`, resolves it to a `CoordinationActorId` via the same
actor-token system used across `coordination-*` services, and grants
`policy_admin` by default to `david` and `luca-replit`
(`SHARED_SPEC_POLICY_ADMIN_ACTORS`, default `"david,luca-replit"`). None of
this consults `TaskOwnershipService` / `assertOwnershipForInfraMutation` —
it has no `taskRef` concept anywhere in its API surface at all.

**Why:** found during task #1470's inventory sweep. Deliberately NOT gated
in that task: unlike Cloudflare DNS/Neon/GitHub-dispatch/S3/git-push (a bare
credential is the *only* gate), `publish()` also requires the content to
already be an independently-reviewed, approved, immutable revision
(`exportApprovedBytes` checks `review.id`/`contentHash` match) — a real,
different-shaped authorization layer. Retrofitting `taskRef` here means
extending `ActorContext`/the coordination-actor model, not just adding one
parameter — a materially bigger design decision than the CLI/source-promotion
gates, which had an obvious single-parameter fit. Treated as a follow-up
rather than an in-task fix.

**How to apply:** if asked to close this gap, the actor-identity model
(`ActorContext.actorId` + `capabilities`) is the right layer to extend, not
a bolt-on parameter to `publish()` alone — `request`/`reconcile` share the
same `requirePublicationManager` gate and the same missing task-ref concept.
Check whether `coordination-v2-cli.ts`/the broader coordination-actor
authority work already has a planned answer for this before inventing a new
one; this subsystem has substantial dedicated design work in progress
elsewhere.
