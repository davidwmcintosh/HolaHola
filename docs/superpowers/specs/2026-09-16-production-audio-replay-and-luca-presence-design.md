# Production Audio Replay and Luca Presence Repair

## Scope

Repair two defects observed during the post-Render-cutover production smoke test:

1. Gemini Live repeated a substantial completed response inside one still-open model generation.
2. The Team Room showed Luca offline even though the production Luca presence socket was connected and joined.

Image-generation style consistency is explicitly deferred.

## Audio replay repair

### Evidence

The production session recorded one Gemini `generationComplete` and one sealed audio subturn for each user turn. The browser received no duplicate chunk keys, used one audio handler, and performed no mid-turn reset. The final persisted assistant message nevertheless contained the same full paragraph twice consecutively.

The failure is therefore semantic replay inside one model generation, not transport retransmission or a second completed generation.

### Design

Add a turn-local replay detector to the Gemini Live session:

- Build a normalized token stream from incremental output transcription.
- Do not arm replay suppression until the first passage is substantial enough that ordinary pedagogical repetition cannot trigger it.
- Detect only an immediate replay that starts again from the beginning of the same response and matches a substantial prefix.
- Preserve the first occurrence.
- Once confirmed, suppress subsequent transcript and audio belonging to the replay.
- Let the existing turn-seal and transcript-flush lifecycle complete normally.
- Emit dedicated telemetry with the turn ID and matched-prefix size.
- Reset all detector state at every genuine new user/model turn and on session reset.

The detector must not suppress short intentional repetitions such as “muy bien, muy bien,” vocabulary drills, corrections, or repeated single sentences below the conservative threshold.

### Verification

Focused tests must prove:

- a long paragraph repeated immediately is persisted and emitted once;
- short pedagogical repetition is preserved;
- a long response containing repeated words but not a replay from its beginning is preserved;
- replay state does not cross turn boundaries;
- the existing second-generation, transcript flush, and response-completion guards still pass.

## Luca presence repair

### Evidence

The authenticated production presence endpoint reported Luca connected, joined to the active room, and at zero reconnect attempts. The browser initializes `lucaOnline` to false and changes it only after receiving `luca_presence`. The initial online event can be broadcast before a browser joins, and `join_room` currently does not replay the current state.

### Design

Treat presence as current state plus live updates:

- When a browser joins a Team Room, send that socket the current Luca presence immediately.
- Report online only when the local Luca presence socket is connected and joined to the same room.
- Keep the existing room broadcasts for later online/offline transitions.
- Do not expose credentials or presence details outside the authenticated Team Room namespace.
- Avoid introducing polling or a second client-side source of truth.

### Verification

Focused tests must prove:

- Luca connects first and a later browser immediately receives online state;
- a browser joining while Luca is disconnected receives offline state;
- a browser joining a different room does not receive a false online state;
- subsequent disconnect/reconnect broadcasts continue to update already-joined clients;
- ordinary `join_room` behavior remains unchanged.

## Rollout

Run focused tests, typecheck, the project health verifier, and the relevant validation suite. After review, commit and sync the repair, wait for Render to serve the exact commit, and repeat the production voice and Team Room smoke checks.