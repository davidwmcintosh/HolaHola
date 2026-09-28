A file that is 100% generated from a shared database (this project's `.agents/memory/MEMORY.md`
index and its per-topic files, written only through `agent-memory-cli.ts`) can still show up as
a real git rebase conflict, because the file's git history and the database's live content are
two independent things — concurrent sessions write straight to the shared DB regardless of which
git branch they're on, so two branches' on-disk snapshots of the same DB-backed file can diverge
and conflict exactly like hand-written source.

**Why:** the conflict is purely mechanical (two stale snapshots of a row set that has since moved
on), not a real disagreement about content — the DB itself already holds the union of every
concurrent writer's changes the moment each CLI call lands, unaffected by git. Hand-merging the
conflict markers as text (picking lines from "ours" vs "theirs") risks reintroducing stale bullets
or dropping ones written after either snapshot was taken.

**How to apply:** when a rebase/merge conflict lands on `MEMORY.md` or any `.agents/memory/<topic>.md`
file, do not hand-edit the conflict markers. Run `npx tsx server/scripts/agent-memory-cli.ts
regenerate --all` (or `--topic-slug <slug>` for just the one file) to overwrite the conflicted file
with a fresh projection of current DB state, confirm zero real conflict-marker lines remain (a line
made of seven repeated `<` characters, seven `=` characters, or seven `>` characters at the start of
the line), and continue the merge/rebase normally. Treat this the same as the existing lockfile
guidance ("accept incoming or regenerate") rather than as a real logic conflict requiring intent
analysis. A rebase can hit this once per replayed commit (multiple conflict rounds on the same file),
and other topic files may appear or update on disk as a side effect since regeneration reflects every
concurrent writer's current DB state, not just the two git sides being merged — that is expected, not
a sign the resolution went wrong. Do not spell out the literal marker character run (seven of the same
symbol back to back) inside this or any memory entry, even as a quoted example: a plain substring
conflict-marker scan cannot tell a quoted example in prose from a real conflict, and will block a
rebase on the false positive — see the self-referential-trap note in
[MEMORY.md housekeeping](memory-index-cap-nudge-verification.md) for a confirmed case.

