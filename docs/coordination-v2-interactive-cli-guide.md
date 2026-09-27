# Coordinator V2 interactive CLI guide

## Purpose

`server/scripts/coordination-v2-interactive-cli.ts` lets an intelligent host
agent — for example Antigravity — drive the Coordinator V2 host lifecycle one
subcommand at a time, reasoning between each step, instead of running inside
the unattended `Invoke-HolaCoordinator` / `runCoordinationWindowsHost` loop
described in [Coordinator V2 operator path](coordination-clients.md). It adds
no new protocol authority: every subcommand is a thin dispatch onto the same
`CoordinationWindowsHostDependencies` methods, built by the same
`createCoordinationV2HttpDependencyFactory`, that the automated path calls.
What it adds is purely local — state persisted to disk between separate
process invocations, and secret redaction on stdout.

Use this CLI when the operation a poll offers back needs real judgment to
execute (reasoning about what local change satisfies the request) rather than
a fixed child role a script can run blindly. Use `Invoke-HolaCoordinator`
instead when one unattended command is enough.

## Prerequisites

Nothing here creates authority — it all has to already exist:

- an active founder-approved Coordinator V2 policy;
- an operator grant for the task;
- a compatible enrolled host;
- a locally prepared, DPAPI `CurrentUser`-protected credential for the same
  Windows user who will run this CLI.

See [Architecture](coordination-v2-architecture.md) and
[New actor onboarding](coordination-new-actor-onboarding.md) for how these are
obtained. Unlike `runCoordinationWindowsHost`, this CLI never calls
`dependencies.preflight` itself — it assumes the environment is already sound
and goes straight to the server.

The real dependency factory (`createCoordinationV2HttpDependencyFactory`)
refuses to construct outside `process.platform === 'win32'`, throwing
`windows_required`. Running any network subcommand from a non-Windows shell
returns `{"ok":false,"step":"<subcommand>","error":"windows_required"}` — that
is the CLI failing closed correctly, not a bug.

## Running it

One process per subcommand, always from the repository root (state is written
under `.coordination-v2-interactive-session/` relative to the working
directory):

```
npx tsx server/scripts/coordination-v2-interactive-cli.ts <subcommand> --task-ref <task reference> [--policy <policy selector>]
```

`<subcommand>` is one of `start | poll | claim | renew | submit-result |
cleanup | status`. `--policy` is optional and selects among already-approved
policies, exactly like `Invoke-HolaCoordinator -Policy`. A `--format` flag is
accepted for parity with the non-interactive CLI's argument parser but has no
effect here — every subcommand always prints exactly one JSON line to stdout
and sets its exit code to `0` (`ok: true`) or `1` (`ok: false`).

Each invocation prints one `CoordinationV2InteractiveOutput` object.
`sessionToken` and `cleanupSessionToken` are never included, even inside
`offer` or an error — a reasoning transcript or log is assumed to be an unsafe
place for them.

| Field | Meaning |
| --- | --- |
| `ok` | Whether this step itself succeeded. |
| `step` | Which subcommand produced this output. |
| `taskRef` | Echoes the `--task-ref` you passed. |
| `sessionId`, `attemptId`, `leaseId`, `leaseEpoch` | Redacted, non-secret identifiers from the current bound state. |
| `action` | `poll` only: `"operation_available"` (an `offer` follows — go claim it) or `"renew"` (nothing to do yet; poll again, calling `renew` first if the lease is getting old). |
| `offer` | `poll` only, present when `action` is `"operation_available"`. Hand this straight to `claim`. |
| `terminalState` | Present when the transport itself reported one. See the reaction table below, and its caveats. |
| `cleanupAcknowledged` | `cleanup` only: whether the server durably acknowledged cleanup. |
| `error` | A short machine code when `ok` is `false` for a reason other than a clean `terminalState`. |

## The sequence

1. **`start`** — run exactly once per task. Reserves/acknowledges the session
   and acquires a lease, minting a fresh `holderInstanceId` for this run. On
   success you get `sessionId`, `attemptId`, `leaseId`, `leaseEpoch`, and local
   state is saved. If the session already concluded before you got here (for
   example you're re-running against a finished task), `start` is the one
   subcommand that can hand back a clean `terminalState` describing that
   pre-existing state instead of leasing anything — react per the table below
   rather than proceeding to `poll`.
2. **`poll`** (loop) — asks whether there is host work. `action:
   "operation_available"` with an `offer` means claim it; `action: "renew"`
   means there is nothing to do yet.
3. **`claim`** — turns the last `poll` offer into a bound claim (fails closed
   with `no_offer_to_claim` if called without a fresh offer). Once claimed, do
   the actual reasoning/work the offer's `operation` describes.
4. **`renew`** — extends the lease without changing anything else. Call it
   between polls if a reasoning/working step is taking a while and the lease
   should not lapse.
5. **`submit-result`** — reports the outcome of the work just done. Requires a
   prior successful `claim` (fails closed with `no_claim_to_submit_against`
   otherwise). Pipe a single raw JSON **object** on stdin — whatever the
   claimed operation's contract expects as its result payload, e.g.:

   ```
   echo '{"changedFiles":["src/foo.ts"],"testsPassed":true}' \
     | npx tsx server/scripts/coordination-v2-interactive-cli.ts submit-result --task-ref 9001
   ```

   The CLI wraps that payload in a `structured_result` envelope bound to the
   claim (the claim's own binding, a `resultDigest` over exactly what was
   piped, a `requestId` chained off the claim) and sends it — the envelope is
   never constructed by hand, and the digest must match the server's own
   recomputation or the call fails closed.
6. **`cleanup`** — call after any terminal condition: a clean `terminalState`,
   a thrown error, or (see below) once the session's conclusion is otherwise
   known. Check `cleanupAcknowledged`; if it comes back `false`, that is not a
   failure to fix — call `cleanup` again later, the same way `cleanup_pending`
   works for the automated host.
7. **`status`** — a pure local read of the last-saved session/attempt/lease
   identifiers. It never touches the network or needs credentials, so use it
   to re-orient after a crash or restart, never to check the live server's
   opinion of the session.

## A scope boundary worth knowing before you start

`submit-result` moves the **attempt** to `result_ready`. It does **not** move
the **session** to `succeeded`. Reaching `succeeded` is a separate
session-level transition — `begin_verification` then `accept_completion`,
posted to `/api/coordination/v2/sessions/:id/transitions` and
`/api/coordination/v2/sessions/:id/completion` — that nothing in this
codebase currently calls automatically. That pair of transitions belongs to
whoever is driving the session's own reasoning/provider side, not to the host
transport this CLI wraps (the host protocol is deliberately "thin ...  not a
state-machine authority" — see [Host protocol](coordination-v2-host-protocol.md)).

Practically: after a successful `submit-result`, do not expect an immediate
`terminalState: "succeeded"` in that same response — the real transport does
not populate that field on this call today. Go back to polling. The session
will eventually conclude one way or another, and a host finds out about that
the way a host always finds out about things it doesn't own: a
`poll`/`claim`/`renew`/`submit-result` call made after that point throws
instead of returning a clean value. The confirmed code for "the session you're
bound to is already terminal" is `LEASE_SESSION_TERMINAL`. Treat any thrown
error the same as a clean `terminalState`: stop advancing the attempt, and
call `cleanup` (cleanup is the one operation still allowed once a session is
already terminal).

## Reacting to `terminalState` and `error`

The canonical vocabulary (matching `CoordinationWindowsTerminalState`) is
`succeeded | failed | exhausted | expired | revoked | cleanup_pending |
preflight_failed | host_unavailable | invalid_request`. This CLI passes
through whatever string the transport gives it without normalizing it the way
the automated host's `safeTerminal()` does — treat any value outside this list
defensively (stop, `cleanup`) rather than assuming it is safe to ignore.

| `terminalState` | What it means here | React |
| --- | --- | --- |
| `succeeded` | The session already concluded successfully (realistically only ever seen from `start`, per the boundary above). | `cleanup`, then stop — the task is done. |
| `failed` / `exhausted` / `expired` / `revoked` | The session ended without success, before or independent of anything this run did. | `cleanup`, then stop and report the failure upstream. |
| `cleanup_pending` | Cleanup itself did not complete. This CLI normally reports the same idea through `cleanupAcknowledged: false` instead of this string — react identically either way. | Retry `cleanup` later. |
| `preflight_failed` / `host_unavailable` / `invalid_request` | Something about the request itself, or the environment, was rejected before any session work happened. | Do not retry blindly — recheck the prerequisites above (policy, grant, host enrollment, credential). |

Errors surfaced in the `error` field instead of a clean `terminalState` (all
real codes from `coordination-transport-lease-service.ts`):

- `LEASE_SESSION_TERMINAL` — the session already concluded
  (succeeded/failed/exhausted/expired/revoked) through some other path. React
  exactly like a terminal state: stop, `cleanup`.
- `LEASE_NOT_FOUND` — the session id in local state does not exist on the
  server. `LEASE_EXPIRED` — the session's own `expiresAt` passed, or the
  transport lease's own duration lapsed.
- `LEASE_STALE_EPOCH` / `LEASE_HOLDER_MISMATCH` — a newer lease, or a
  different holder instance, has already superseded the one this run is
  operating under. Stop; do not keep issuing calls against stale local state.
- `LEASE_HOST_MISMATCH` / `LEASE_AUTHORIZATION_DENIED` — this run is not
  authorized for this session; recheck host enrollment and the operator grant
  before retrying.
- `LEASE_CONFLICT` / `LEASE_REPLAY_CONFLICT` — a database-level conflict or an
  idempotency-key collision. Safe to retry once with a fresh call.
- `LEASE_INVALID_REQUEST` — malformed input reached the server (should not
  happen through this CLI's own argument/stdin validation, but fails closed if
  it ever does).

Local, CLI-only errors (no network round-trip involved): `interactive_session_not_found`
(no `start` has been run yet for this `--task-ref` in this working directory),
`no_offer_to_claim`, `no_claim_to_submit_against`, `invalid_result_json` /
`result_must_be_object` (stdin to `submit-result` was not a single JSON
object), `unsupported_subcommand`, `invalid_argument`, `windows_required` (see
prerequisites above). The full authoritative catalog of server-side codes is
[Stable diagnostics](coordination-v2-error-codes.md).

## Recovering across process restarts

Because each subcommand is its own process, `status --task-ref <ref>` is the
way to check whether a session for that task is already in flight before
deciding whether to call `start` again. Calling `start` a second time for a
task that is genuinely still active (already leased, not yet concluded) is
not a safe way to check on a session — `start` only cleanly handles the very
first call for a task, or a retry after the local session file was lost, and
otherwise expects to run the full acknowledge-and-lease sequence from
scratch.

## Example run

```
$ npx tsx server/scripts/coordination-v2-interactive-cli.ts start --task-ref 9001
{"ok":true,"step":"start","taskRef":"9001","sessionId":"…","attemptId":"…","leaseId":"…","leaseEpoch":1}

$ npx tsx server/scripts/coordination-v2-interactive-cli.ts poll --task-ref 9001
{"ok":true,"step":"poll","taskRef":"9001", … ,"action":"operation_available","offer":{"attemptId":"…","operation":"execute"}}

$ npx tsx server/scripts/coordination-v2-interactive-cli.ts claim --task-ref 9001
{"ok":true,"step":"claim","taskRef":"9001", … }

# — do the actual work the offer described here —

$ echo '{"changedFiles":["src/foo.ts"],"testsPassed":true}' \
  | npx tsx server/scripts/coordination-v2-interactive-cli.ts submit-result --task-ref 9001
{"ok":true,"step":"submit-result","taskRef":"9001", … }

# poll again; once the session concludes elsewhere, the next call throws, or a
# fresh `start` reports a terminalState — either way, then:

$ npx tsx server/scripts/coordination-v2-interactive-cli.ts cleanup --task-ref 9001
{"ok":true,"step":"cleanup","taskRef":"9001","cleanupAcknowledged":true}
```

## See also

- [Coordination clients](coordination-clients.md)
- [Architecture](coordination-v2-architecture.md)
- [Host protocol](coordination-v2-host-protocol.md)
- [Stable diagnostics](coordination-v2-error-codes.md)
- [Recovery runbook](coordination-v2-recovery-runbook.md)
- `server/scripts/test-coordination-v2-interactive-cli.test.ts` — the exact
  call sequence and output shapes this guide describes, enforced by test.
