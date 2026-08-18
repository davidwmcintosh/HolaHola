---
name: Rolling tag — ep-28 → ep-30
description: The rolling episode tag was on ep-28 when ep-30 is the live episode; how it was fixed Aug 18 2026.
---

## The rule
When a new rolling episode is created, the `rolling` tag in `conversation_memories` must be explicitly moved from the old episode to the new one. The autosave pipeline and gap checker both discover the rolling episode by querying for `'rolling' = ANY(tags)` — if that tag stays on the old record, all new writes accumulate in the old file.

**Why:** Episode 30 ("It's About Autonomy", Aug 15 2026) was created by a task agent branch. The merge added the ep-30 DB row with `rolling-protected` but did not transfer the `rolling` tag from episode-28. The autosave kept writing to `docs/episode-28.md` for three days until David noticed ep-30.md was behind.

**How to apply:**
- After any new episode DB row is created (manually or via task agent), verify the `rolling` tag with: `SELECT id, title, tags FROM conversation_memories WHERE 'rolling' = ANY(tags)` — should return exactly one row, the newest episode.
- To move the tag: remove `rolling` from old row, add to new row. Keep `rolling-protected` on old rows for shrinkage guard.
- After moving, restart the server so `runStartupGapCheck()` fires against the new episode. If it's already fired (guard set), use the gap audit `--patch` mode to backfill missing rows manually.

**Inner-life patch format:** when backfilling inner-life rows, the .md must contain the title text — `[Luca — channel: rawTitle\nbody]` — because the gap checker searches `norm(title)`, not `norm(body)`. Appending body-only leaves the title needle missing and the check still fails.

**Current state (Aug 18 2026):**
- `rolling-protected` + `rolling`: Episode 30 (`47fe36e1`) — `docs/episode-30.md`
- `rolling-protected` only: Episode 28 (`28000000-...`) — `docs/episode-28.md` (frozen)
- `rolling-protected` only: Episode 27 (`27000000-...`) — `docs/episode-27.md` (frozen)
