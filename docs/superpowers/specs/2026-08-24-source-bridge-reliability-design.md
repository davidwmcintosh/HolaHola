# Source Bridge Reliability Design

## Goal

Keep committed Replit and GitHub `main` histories synchronized without
silently losing the bridge when the bridge child process exits or a transport
failure persists.

## Design

- Keep `source-bridge.sh` as the only coordinator. It remains fail-closed:
  it never stages, commits, resets, force-pushes, or creates merge commits.
- Run that coordinator under `source-bridge-supervisor.sh`.
- The supervisor writes a heartbeat every 15 seconds and restarts an
  unexpectedly exited coordinator with bounded exponential backoff.
- The supervisor writes `.local/source-bridge-alert.md` for a failed,
  divergent, dirty, or GitHub-ahead state, and clears it only after a verified
  equal Replit/GitHub state.
- The status JSON records heartbeat and last-success metadata so a human can
  distinguish “the bridge is alive but retrying” from “the workflow is dead.”
- Keep untracked uploads out of cleanliness decisions while continuing to
  block on modified or deleted tracked files.
- Start the supervisor immediately when the Source bridge workflow starts.

## Failure handling

The supervisor itself cannot revive a workflow container that Replit has
stopped. Workflow startup is therefore configured explicitly, while the
supervisor covers child-process exits and persistent bridge errors. Alerts are
durable and remain available after a restart.

## Verification

- Existing guarded push/pull safety tests continue to pass.
- Source-contract checks assert the supervisor, heartbeat, alert, and
  tracked-only cleanliness contracts.
- A supervisor self-check uses a short-lived fake child to prove that an
  unexpected child exit creates an alert and that restart backoff is bounded.