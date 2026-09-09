# Direct coordination clients

The canonical coordination ledger is available to Alden, Daniela, and Luca
[HolaHola] without routing through Luca [Replit]. All three use
`server/services/coordination-actor-client.ts`; operators can invoke the same
client through `server/scripts/coordination-cli.ts`.

The server derives identity only from `x-coordination-token`. The client does
not accept a token argument and does not read `COORDINATION_API_TOKEN`,
`REPLIT_AGENT_TOKEN`, or another actor's credential as a fallback.

## Runtime placement and scope

| Actor | Runtime | Credential | Client actions |
| --- | --- | --- | --- |
| Luca [Replit] | Replit Agent runtime | `COORDINATION_LUCA_REPLIT_TOKEN` | Read his inbox and coordination feed; create and manage participating work; send actor-derived linked replies; atomically close agent-note-origin work with a verified outcome. |
| Luca [Claude Code] | Claude Code runtime | `COORDINATION_LUCA_CLAUDE_CODE_TOKEN` | Read his inbox and coordination feed; create and manage participating work; send actor-derived linked replies; atomically close agent-note-origin work with a verified outcome. |
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
npx tsx server/scripts/coordination-cli.ts ack-inbox \
  --window-token <completed-read-window-token>
```

Reading and acknowledgement are different operations. Reading makes the window
available but never records completion. `ack-inbox` records completed intake
only for the exact processed window represented by its returned token; the
token is not an arbitrary cursor and must not come from another actor, runtime,
or refresh. Do not acknowledge a partial, unread, failed, or differently
refreshed window. Acknowledgement does not accept work, mutate lifecycle state,
prove recipient reading, or prove action.

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

## Two-runtime Luca smoke protocol (pending activation)

This approved protocol is for a future smoke test between Luca [Replit] and
Luca [Claude Code]. It is not evidence that activation has occurred or that the
test has succeeded.

1. The Replit Agent runtime configures only
   `COORDINATION_LUCA_REPLIT_TOKEN` in its own secret store. The Claude Code
   runtime configures only `COORDINATION_LUCA_CLAUDE_CODE_TOKEN` in its own
   secret store. Neither hat shares, copies, prints, requests, or uses the
   other's credential.
2. Each runtime independently calls `inbox --limit 50` as itself and records
   only its own read-window metadata. `show` may investigate an inbox entry,
   but neither `show` nor `list` establishes completeness.
3. Each runtime reads and processes its own complete returned window. Neither
   Luca hat acknowledges, replies, acts, or impersonates the other. A
   recipient-facing comment passes `--recipient`; an internal record passes
   `--ledger-only`.
4. Each runtime calls `ack-inbox` only with the completed read-window token
   returned by its own inbox response. It must not use a fabricated,
   cross-runtime, stale, or partially processed token.
5. Record the two runtimes' separate results, including explicit failure or
   pending states. Inbox storage, reading, acknowledgement, and action remain
   separate evidence and must not be inferred from one another.

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