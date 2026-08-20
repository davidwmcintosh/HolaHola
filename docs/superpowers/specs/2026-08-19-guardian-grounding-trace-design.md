# Guardian grounding trace design

## Goal

Make a grounding intervention diagnosable as one connected evidence chain:
the exact student utterance and candidate assertion, lookup, queue, injection,
related Archive access, and response completion.

## Model

Each Guardian intervention receives a generated `attemptId` when its lookup
starts. The attempt remains bound to its student-turn epoch, full student
utterance, candidate assertion, and Guardian path. It records append-only
events for lookup, queueing, injection, tool-response dispatch, related Archive
calls, stale discard, failure, and generation completion.

## Delivery language

The system must not treat an intervention as “heard” merely because it was
queued, nor as “missed” merely because a later response lacks a heuristic
signal. A tool response sent to Gemini establishes API delivery only. Unless a
related Archive call is observed on the same bound turn, the explicit terminal
state is `injected_delivery_unknown`.

## Surfaces

The in-memory observation snapshot exposes the active attempt timeline. The
same event envelope is persisted as `gl_guardian_trace` in
`voice_pipeline_events`, enabling the truth-pipeline report to reconstruct the
same chain after the session ends.

## Correlation boundary

Archive calls are linked only after an attempt has been injected and only while
that attempt’s student-turn epoch is active. An Archive call from a different
turn cannot satisfy the attempt.
