## MEMORY.md rebase conflicts are concurrent appends

## MEMORY.md rebase conflicts are concurrent appends, not real edit collisions

`.agents/memory/MEMORY.md` and every topic file are projections regenerated
from the `agent_memory_*` database tables (see the preamble at the top of
MEMORY.md itself). Multiple hats write to that DB concurrently and each
write regenerates the file from current DB state.

When a git rebase surfaces a conflict in MEMORY.md, the "ours" and "theirs"
sides are typically two regenerated snapshots taken at different points in
time on the same underlying append-only index — not two people editing the
same line. In practice this means the conflict is usually just one side
having zero or more extra trailing bullet lines that the other side lacks,
with every other line byte-identical.

**Why:** confirmed on task #1527's rebase: a line-by-line diff of the "ours"
block against the "theirs" block showed exactly one line of difference out
of 156+ shared lines — a single extra bullet on "ours" that "theirs" didn't
have yet. No line was actually edited on both sides.

**How to apply:** before hand-resolving a MEMORY.md (or topic file) conflict,
extract the "ours" and "theirs" blocks to separate files and run a real
`diff`, not an eyeball scan of a 300+ line list. If the diff shows only
added/missing lines (the common case), the correct resolution is the union
of both sides in stable order, not a semantic rewrite. Only fall back to
manual reasoning about intent if `diff` shows an actual line-level edit
collision, which would indicate two hats tried to change the same bullet's
wording — rare for an append-only index. After resolving, use the normal
`server/scripts/agent-memory-cli.ts regenerate --all` path (or a fresh CLI
write) if you need the file to reflect the live DB again; a hand-resolved
file is a one-time rebase artifact, not a replacement for the DB being the
source of truth.

