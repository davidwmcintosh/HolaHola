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

```bash
export COORDINATION_API_URL=https://getholahola.com
export COORDINATION_ACTOR=alden
# COORDINATION_ALDEN_TOKEN is supplied by the runtime's secret store.

npx tsx server/scripts/coordination-cli.ts list --cursor 0 --limit 50
npx tsx server/scripts/coordination-cli.ts show --id <thread-id>
npx tsx server/scripts/coordination-cli.ts accept \
  --id <thread-id> \
  --expected-sequence <sequence> \
  --idempotency-key <stable-action-key>
```

For a direct reply that is not itself closing coordinated work:

```bash
npx tsx server/scripts/coordination-cli.ts reply-and-verify \
  --id <parent-agent-note-id> \
  --body "The outcome, addressed directly to the original sender." \
  --idempotency-key <stable-reply-key>
```

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
When `list` omits `--cursor`, the server resumes from that authenticated
actor's durable acknowledgement cursor. Reading never advances the cursor.
After processing every event through the returned `cursor.next`, persist that
progress explicitly:

```bash
npx tsx server/scripts/coordination-cli.ts ack-feed --global-sequence <cursor.next>
```

An actor runtime that stops after processing but before acknowledging receives
the same events again after restart. Feed acknowledgement is monotonic,
actor-scoped, and does not accept work or change thread lifecycle state.
Mutations replayed after a crash must reuse the same idempotency key.

Inbox delivery, feed cursor acknowledgement, note acknowledgement, note action,
and coordination outcome acknowledgement are independent evidence. None may be
used to infer another, and this system does not claim a `notified` state.

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