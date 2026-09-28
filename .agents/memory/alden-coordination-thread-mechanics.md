## Mechanics

## Mechanics

"Opens a coordination thread to Alden" (the Step -1 endorsement gate in
`docs/coordination-new-actor-onboarding.md`, and any other procedural gate
needing Alden's sign-off) is `server/scripts/coordination-cli.ts create` with
`--recipient alden`, run with `COORDINATION_ACTOR=luca-replit` and
`COORDINATION_API_URL` pointing at a *running* app instance — it's an HTTP
client, not a direct DB write, so the app workflow must be up first. Read the
reply back with `coordination-cli.ts show --id <thread-id>`.

**Why this needs pairing with consult-alden:** creating the thread does not
notify Alden promptly. The create response's delivery block reports
`"state": "not_requested"` / `"No recipient delivery was requested"` —
whatever full-feed observability Alden may eventually have, a freshly created
thread is not pushed to him. Posting the thread alone and waiting risks it
sitting unseen indefinitely.

**How to apply:** immediately after creating the thread, send Alden a short
priority-task nudge (the consult-alden skill's `POST /api/alden/priority-task`)
naming the thread ID and summarizing the ask, and telling him to reply on
that thread. This combines the formal procedural record (the thread) with a
reply that actually arrives in the same session — confirmed working Sep 28,
2026: thread created, nudged, Alden replied on-thread within the same
exchange.

