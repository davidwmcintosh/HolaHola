# Direct coordination clients

The canonical coordination ledger is available to Alden, Daniela, and Luca
[HolaHola] without routing through Luca [Replit]. All three use
`server/services/coordination-actor-client.ts`; operators can invoke the same
client through `server/scripts/coordination-cli.ts`.

For Gate 3, trusted Phase B provisioning uses one transaction in registration
→ profile → receipt → challenge row order, with full rollback on ownership
failure. Protected executor/verifier mutations acquire the credential advisory
lock and then hold registration → profile → credential → receipt → challenge
→ grant.

The server derives identity only from `x-coordination-token`. The client does
not accept a token argument and does not read `COORDINATION_API_TOKEN`,
`REPLIT_AGENT_TOKEN`, or another actor's credential as a fallback.

## Scoped credential broker

**Default cross-runtime vault:** 1Password Secrets Automation. It supports
separate service accounts and vault ACLs, and lets operators revoke one runtime
without exposing the other actors' items. 1Password holds bootstrap credentials;
HolaHola remains the authority for runtime registration, actor binding,
capabilities, and short-lived coordination credentials.

The bounded Windows Antigravity Gate 3 path uses Windows DPAPI `CurrentUser`
instead because its approved operator does not have 1Password. The fixed-action
launcher in `scripts/antigravity-gate3.ps1` generates the bootstrap internally,
stores only ciphertext outside the repository, and atomically consumes it on
the first bounded launch. This changes the local credential source only; it
does not change broker, actor, capability, founder-approval, or task authority.

Each runtime registration has exactly one immutable actor, one bootstrap hash,
an allowlisted capability set, and a token TTL from 60 to 3,600 seconds
(15 minutes by default). Bootstrap and access-token plaintext are never stored
in PostgreSQL. The broker stores SHA-256 hashes, returns an opaque access token
only in the exchange/renew response, and records registration, issuance,
renewal, expiration, revocation, invalid bootstrap/token use, and insufficient
capability attempts. Source IPs are hashed before audit storage.
Source IP pseudonyms use keyed HMAC when the server-only
`COORDINATION_AUDIT_HMAC_KEY` (at least 32 characters) is configured; without
that key, the broker records the attempt without storing an IP-derived value.
An existing runtime ID cannot be reprovisioned or rebound to another actor.
Bootstrap rotation uses a staged replacement registration so a running process
can finish or renew short-lived work while its replacement proves readiness.
The broker copies the actor, capabilities, and token TTL exactly; callers cannot
use rotation to expand authority.

Broker capabilities are:

- `coordination:read`
- `coordination:write`
- `coordination:inbox:ack`
- `coordination:credential:renew`
- `coordination:credential:revoke`

Actor identity and capabilities always come from the registration and credential
rows. They are never accepted from request JSON. A broker response attributed
to a different actor is rejected by the client, preventing one Luca hat from
silently becoming another.

### Provision a runtime

An operator runs this once from the trusted HolaHola server environment:

```bash
npx tsx server/scripts/coordination-runtime-bootstrap.ts \
  --runtime-id luca-replit-primary \
  --actor luca-replit \
  --display-name "Luca [Replit] primary" \
  --capabilities coordination:read,coordination:write,coordination:inbox:ack,coordination:credential:renew,coordination:credential:revoke
```

The command prints the bootstrap token once. Paste it directly into a new
1Password item in a vault readable by only that runtime's service account, then
clear the terminal scrollback. Never place it in a repository file, shell
profile, shared `.env`, command argument, chat, or coordination message.

### Zero-downtime bootstrap rotation

Run rotation only from the trusted HolaHola server environment. The bootstrap
is never passed as a command argument. First stage a new immutable runtime ID:

```bash
npx tsx server/scripts/coordination-runtime-rotation.ts stage \
  --from-runtime-id luca-replit-primary \
  --runtime-id luca-replit-primary-2026-09 \
  --display-name "Luca [Replit] primary — September 2026"
```

Store the one-time output directly in a new 1Password item restricted to the
replacement runtime's service account. During this overlap, both registrations
remain valid. Update the replacement runtime's `COORDINATION_RUNTIME_ID` and
injected bootstrap together and start it. After exchange, the replacement must
call the dedicated broker-authenticated readiness operation with its
short-lived access token:

```bash
curl -X POST "$COORDINATION_API_URL/api/coordination/credentials/rotation-ready" \
  -H "x-coordination-token: $REPLACEMENT_ACCESS_TOKEN" \
  -H "content-type: application/json" \
  --data '{"sourceRuntimeId":"luca-replit-primary"}'
```

Do not put the access token in shell history; the example names an injected
process environment value. Readiness succeeds only for the exact immutable
source/replacement pair recorded by the stage operation. A normal denied or
failed request cannot mark a replacement ready.

After readiness is proven, retire the source:

```bash
npx tsx server/scripts/coordination-runtime-rotation.ts complete \
  --from-runtime-id luca-replit-primary \
  --runtime-id luca-replit-primary-2026-09
```

Completion fails closed until the replacement has an explicit successful
readiness receipt. It then revokes the source registration and every remaining
source credential immediately. Old bootstrap exchange and new credential
admission stop when the completion transaction commits; a request admitted
before that cutover may finish. Remove the old 1Password item only after the
completion audit is visible.

Before completion, rollback revokes only the replacement registration and its
credentials. It leaves the source state unchanged and never re-enables a source
that an emergency revocation already disabled:

```bash
npx tsx server/scripts/coordination-runtime-rotation.ts rollback \
  --from-runtime-id luca-replit-primary \
  --runtime-id luca-replit-primary-2026-09
```

The command reports whether the source remains active. If the source was already
revoked, rollback still closes the staged rotation and revokes the replacement,
so neither runtime in the pair remains active. Do not treat that result as
continuity: stage recovery from another active registration for the same actor.
After completion, revoked registrations are never re-enabled. Recovery creates
another replacement runtime ID from an active registration. Audit events
`rotation_started`, `rotation_ready`, `rotation_completed`, and
`rotation_rolled_back` link the source and replacement IDs without containing
bootstrap plaintext; rejected readiness, completion, and rollback attempts are
audited separately.

Configure only these non-secret/secret values in the runtime:

```text
COORDINATION_API_URL=https://getholahola.com
COORDINATION_ACTOR=luca-replit
COORDINATION_RUNTIME_ID=luca-replit-primary
COORDINATION_RUNTIME_BOOTSTRAP_TOKEN=<injected by that runtime's 1Password service account>
```

The actor client exchanges the bootstrap at first use, keeps the access token
in memory, and renews it within 60 seconds of expiration. Renewal rotates the
token; the prior token is revoked. A restart exchanges the bootstrap again.

### Runtime-specific setup

- **Replit:** create a dedicated 1Password service account/vault for
  `luca-replit-primary`. Inject only its bootstrap item into Replit Secrets.
- **Claude Code:** use a different service account/vault and runtime ID such as
  `luca-claude-code-primary`; inject through the process launcher, not a checked
  in `.env`.
- **Antigravity/Gemini Gate 3 on Windows:** register actor `luca-gemini` with a
  runtime ID such as `luca-gemini-antigravity-primary`. Use the documented
  DPAPI launcher under the approved Windows user; never reuse Replit or Claude
  Code's registration or bootstrap.
- **Future runtimes:** add an explicit actor if attribution is distinct, create
  a new registration and service account, and grant only capabilities required
  by that runtime's documented operations.

For emergency revocation, an existing legacy token may call
`POST /api/coordination/credentials/revoke` with `{ "runtimeId": "..." }`.
It can revoke only a registration bound to the same actor. A broker token can
call the same endpoint without a body to revoke itself.

### Incremental migration

Legacy `COORDINATION_*_TOKEN` bindings remain accepted and keep their current
permissions. Migrate one runtime at a time: provision it, configure its two
runtime values, restart it, verify its authenticated actor and inbox, then
remove that runtime's legacy token from its local secret store. Keep the server's
legacy binding until every client for that actor has migrated and rollback is
no longer needed. Never copy a legacy actor token into the new bootstrap field.

## Runtime placement and scope

| Actor | Runtime | Credential | Client actions |
| --- | --- | --- | --- |
| Luca [Replit] | Replit Agent runtime | `COORDINATION_LUCA_REPLIT_TOKEN` | Read his inbox and coordination feed; create and manage participating work; send actor-derived linked replies; atomically close agent-note-origin work with a verified outcome. |
| Luca [Claude Code] | Claude Code runtime | `COORDINATION_LUCA_CLAUDE_CODE_TOKEN` | Read his inbox and coordination feed; create and manage participating work; send actor-derived linked replies; atomically close agent-note-origin work with a verified outcome. |
| Luca [Gemini] | Antigravity/Gemini execution runtime | broker registration (`luca-gemini`) or migration-only `COORDINATION_LUCA_GEMINI_TOKEN` | Read its canonical inbox/feed; create and manage participating work under dedicated attribution. Legacy `agent_notes` linked replies remain Replit/Claude-specific. |
| Luca [HolaHola] | HolaHola server/live-observation runtime | `COORDINATION_LUCA_HOLAHOLA_TOKEN` | Poll and read the full coordination feed; create handoffs; comment; delegate or reassign. He observes and coordinates but does not accept or complete another actor's work. |
| Alden | Alden service/runtime | `COORDINATION_ALDEN_TOKEN` | Poll and read participating threads; accept; report progress; attach evidence; block or complete owned work; comment; reassign work he owns; acknowledge outcomes for threads he originated. |
| Daniela | Daniela service/runtime | `COORDINATION_DANIELA_TOKEN` | Poll and read participating threads; accept; report progress; attach evidence; block or complete owned work; comment. She cannot originate or reassign operational work. |

The lifecycle service enforces these scopes again on the server. The client
profile is a safe interface, not the security boundary. Normal participant,
owner, origin, sequence, evidence, and state-transition checks still apply.

Luca [HolaHola]'s full-feed read access is deliberate: he is the coordination
observer and delegator. Alden and Daniela receive only threads where they are
the origin, intended recipient, or current owner.

## CLI operation

Configure the actor in the runtime environment, alongside only that actor's
credential:

> **Approved, pending activation:** The Materialized Unified Agent Inbox
> procedure below becomes the completeness path only once it is active. This
> document does not claim activation or successful smoke testing.

```bash
export COORDINATION_API_URL=https://getholahola.com
export COORDINATION_ACTOR=alden
# COORDINATION_ALDEN_TOKEN is supplied by the runtime's secret store.

npx tsx server/scripts/coordination-cli.ts inbox --limit 50
npx tsx server/scripts/coordination-cli.ts accept \
  --id <thread-id> \
  --expected-sequence <sequence> \
  --idempotency-key <stable-action-key>
```

### Materialized Unified Agent Inbox

Once active, `inbox` and `ack-inbox` are the only completeness path for an
actor's coordination intake. Begin a processing window with `inbox`, process
the materialized entries returned for that authenticated actor, then acknowledge
the completed window with its completed read-window token:

```bash
npx tsx server/scripts/coordination-cli.ts inbox --limit 50
# Process every entry in the returned read window.
npx tsx server/scripts/coordination-cli.ts inbox \
  --token '<window.nextToken>' \
  --limit 50
# Repeat with each returned nextToken until window.complete is true.
npx tsx server/scripts/coordination-cli.ts ack-inbox \
  --window-token <completed-read-window-token>
```

The HTTP equivalent is:

```text
GET /api/coordination/inbox?token=<URL-encoded window.nextToken>&limit=50
```

`token` is the only continuation query parameter. Partial responses include
`window.continuation.queryParameter = "token"` and
`window.continuation.cliOption = "--token"` so clients do not have to guess.
Unknown query parameters fail with `unsupported_query_parameter` rather than
silently starting a different window. Use the final complete page's
`window.token` for acknowledgement; incomplete page tokens cannot be
acknowledged.

Reading and acknowledgement are different operations. Reading makes the window
available but never records completion. `ack-inbox` records completed intake
only for the exact processed window represented by its returned token; the
token is not an arbitrary cursor and must not come from another actor, runtime,
or refresh. Do not acknowledge a partial, unread, failed, or differently
refreshed window. Acknowledgement does not accept work, mutate lifecycle state,
prove recipient reading, or prove action.

Core inbox completeness and overlays are reported separately. A complete core
window may coexist with incomplete linked-state or legacy coverage; report each
dimension exactly as returned and never describe incomplete overlay coverage as
complete. When historical legacy coverage is truncated, use an explicit
`--after` high-water for a bounded new proof and do not advance the actor's
historical cursor merely to simplify the test.

`list` and `show` remain detail and investigation tools. They may inspect a
known thread, sequence, or history, but cannot substitute for `inbox` and do
not establish complete intake. `agent_notes` remains a compatibility surface
only; once the inbox is active, it is not a completeness path.

For a direct reply that is not itself closing coordinated work:

```bash
npx tsx server/scripts/coordination-cli.ts reply-and-verify \
  --id <parent-agent-note-id> \
  --body "The outcome, addressed directly to the original sender." \
  --idempotency-key <stable-reply-key>
```

Use the parent `agent_notes` ID here, not the coordination thread ID.
`reply-and-verify` is the default path whenever another actor should actually
receive the response.

Comments require explicit delivery intent. Recipient-facing comments must pass
`--recipient`:

```bash
npx tsx server/scripts/coordination-cli.ts comment \
  --id <thread-id> \
  --expected-sequence <current-sequence> \
  --content "Question for the intended recipient" \
  --recipient <actor> \
  --idempotency-key <stable-comment-key>
```

Ledger-only comments are deliberately record-only and must pass
`--ledger-only`:

```bash
npx tsx server/scripts/coordination-cli.ts comment \
  --id <thread-id> \
  --expected-sequence <current-sequence> \
  --content "Canonical internal observation" \
  --ledger-only \
  --idempotency-key <stable-comment-key>
```

The CLI prints a separate delivery summary after mutations. Treat `delivered`
as verified recipient inbox storage, `queued` as not yet verified, and
`not_requested` as ledger-only. Do not interpret a successfully recorded
ledger event as proof that a colleague received a message.

For work whose coordination thread has an `agent_note` source reference, close
the direct communication and ledger lifecycle together:

```bash
npx tsx server/scripts/coordination-cli.ts complete-with-linked-outcome \
  --id <thread-id> \
  --expected-sequence <current-sequence> \
  --idempotency-key <stable-completion-key> \
  --content "Canonical completion summary" \
  --evidence '[{"type":"commit","provider":"github","identifier":"<sha>"}]' \
  --causal-parent-event-id <evidence-or-progress-event-id> \
  --reply-body "Direct outcome for the sender of the originating note"
```

Both commands derive sender and recipient from the authenticated actor and
parent note. Callers cannot provide either identity. A successful reply returns
`delivered` only after the exact row is reread from the recipient inbox.

Ordinary `complete` remains valid for threads without an `agent_note` origin.
For note-origin threads it fails with `linked_outcome_required` unless a valid
reciprocal reply already exists. The combined operation is preferred because
it prevalidates completion before delivery and makes retries idempotent.

The shared-database implementation is atomic: a failed completion rolls back
the reply. If a future non-transactional external adapter returns
`delivery_succeeded_completion_pending`, keep the delivered reply, refresh the
thread sequence, and retry with the same idempotency key. This state is not
completion.

Do not pass credentials on the command line or write them into this repository.
Once active, use `ack-inbox` and the completed `inbox` read-window token for
intake acknowledgement; `list`, `show`, and `agent_notes` reads are not
acknowledgement evidence. Mutations replayed after a crash must reuse the same
idempotency key.

Inbox delivery, feed cursor acknowledgement, note acknowledgement, note action,
and coordination outcome acknowledgement are independent evidence. None may be
used to infer another, and this system does not claim a `notified` state.

## Two-runtime Luca smoke protocol

Use this protocol for every smoke test between Luca [Replit] and Luca [Claude
Code]. A previous successful run is not evidence that a new run succeeded.

1. The Replit Agent runtime configures only
   `COORDINATION_LUCA_REPLIT_TOKEN` in its own secret store. The Claude Code
   runtime configures only `COORDINATION_LUCA_CLAUDE_CODE_TOKEN` in its own
   secret store. Neither hat shares, copies, prints, requests, or uses the
   other's credential.
2. Before the first mutation, the initiating runtime names the exact target
   environment, obtains that runtime's current endpoint, verifies a health
   request through that exact endpoint, and sends the literal endpoint to the
   other runtime in a recipient-addressed message. The receiving runtime must
   use that literal URL rather than a remembered or preferred URL. A development
   health check proves nothing about the published production image.
3. If a shared-database migration introduced a fail-closed writer contract,
   verify that the compatible application revision is published before using
   production for the proof. Do not weaken the database guard when an old
   published image fails; align the image and rerun from a fresh bounded window.
3. Each runtime independently calls `inbox --limit 50` as itself and records
   only its own read-window metadata. `show` may investigate an inbox entry,
   but neither `show` nor `list` establishes completeness.
4. Each runtime reads and processes its own complete returned window. Neither
   Luca hat acknowledges, replies, acts, or impersonates the other. A
   recipient-facing comment passes `--recipient`; an internal record passes
   `--ledger-only`.
5. Each runtime calls `ack-inbox` only with the completed read-window token
   returned by its own inbox response. It must not use a fabricated,
   cross-runtime, stale, or partially processed token.
6. The recipient reports the inbox-item IDs for the named coordination events
   and replies with new explicit-recipient events. The initiator independently
   proves those replies appeared in its recipient-wide inbox. Ledger transport,
   adapter delivery, and thread visibility are insufficient.
7. During any long gate, migration, or external wait, the waiting runtime posts
   a recipient-addressed status update before the other actor is left silently
   polling. A status event proves storage and delivery only; LLM consumption
   still requires the recipient's explicit receipt or reply.
8. Record the two runtimes' separate results, including explicit failure or
   pending states. Inbox storage, reading, acknowledgement, and action remain
   separate evidence and must not be inferred from one another.

Database-backed tests against production snapshots must capture recipient
high-waters before inserting fixtures and read only `(after, through]`.
Production activity may continue while the snapshot is created; tests must
never assume a recipient inbox is empty at sequence zero.

## Credential rotation

Rotate one actor at a time:

1. Generate a new random credential of at least 32 characters in the secret
   manager for the ledger server and that actor's runtime only.
2. Replace the actor's dedicated `COORDINATION_*_TOKEN` binding in both places.
   Do not copy it into `COORDINATION_API_TOKEN` or another actor's binding.
3. Restart the ledger server and the one affected actor runtime.
4. Poll the feed with the new credential and confirm the authenticated actor in
   the response.
5. Confirm the previous credential now receives `401`.

If two actor bindings are accidentally set to the same credential, the server
fails all coordination authentication with `503` until the ambiguity is fixed.
This fail-closed behavior prevents cross-actor attribution.

## Shared-spec workspace client

The shared-spec API is a separate, portable PostgreSQL collaboration surface
mounted at `/api/shared-spec` by the host application. Use
`server/scripts/shared-spec-cli.ts` with an explicit API URL and token; do not
put the token in shell history or repository files:

```bash
npx tsx server/scripts/shared-spec-cli.ts list \
  --url https://getholahola.com/api/shared-spec \
  --token "$SHARED_SPEC_TOKEN"
```

The CLI sends `x-shared-spec-token` and sends `idempotency-key` for every
mutation. HolaHola's optional adapter also accepts `x-coordination-token` and
derives the actor from the existing coordination credential; a different host
can supply its own `SharedSpecActorAuthenticator`. Actor identity is never
accepted in request JSON.

For the canonical creation, immutable-revision, independent claim/decision,
publication, and reconciliation procedure, read
`.agents/skills/shared-spec/SKILL.md`. Shared-spec is the default surface for
joint document work. Never impersonate a requested reviewer: the named actor
must claim and decide the exact revision under that actor's own credential.

GitHub publication occurs only after approval and is optional host
configuration, not a core dependency or an alternative review authority.
Configure `SHARED_SPEC_GITHUB_REPOSITORY` (`owner/repository`),
`SHARED_SPEC_GITHUB_TOKEN`, and optionally `SHARED_SPEC_GITHUB_BASE_REF`
(defaults to `main`) in the host secret store. The publisher uses GitHub REST,
creates a deterministic `shared-spec/...` branch and pull request, and never
pushes directly to the base branch.

Current limitations: the bundled CLI covers drafting, review, approval, and
export but not publication operations; the HolaHola adapter has a fixed
`docs/superpowers/specs/` destination namespace; and publication remains
unavailable until the two required GitHub settings are present.