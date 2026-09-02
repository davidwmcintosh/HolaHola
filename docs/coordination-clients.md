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

Do not pass credentials on the command line or write them into this repository.
Each polling loop persists the returned global cursor in its own runtime. A
missing cursor may replay already-seen events, which is safe; mutations must
reuse the same idempotency key when retried.

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