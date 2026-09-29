---
name: Agent-memory drift guard can flag legitimate concurrent writes, not just hand-edits
description: The drift guard's "out of sync with the database" error also fires when another actively-running hat wrote new content to the shared memory DB that this checkout hasn't regenerated yet — same error, same fix, different cause than a hand-edit.
---

## The quirk

`findAgentMemoryDrift`/`findAgentMemoryDriftInWorkingTree` (wired into
`run-validation-suite.sh` as "Agent-memory drift guard (live, working-tree
scoped)") compares on-disk `.agents/memory/*.md` files against what the
shared memory DB would currently regenerate. Its own error message says this
is "almost always caused by a direct hand-edit" — but in a multi-hat shared
DB, a second, entirely legitimate cause produces an identical error: another
actively-running hat (a different task's agent, a different IDE/session)
wrote a new entry or block to the same shared DB, and this checkout's
on-disk files simply haven't been regenerated to reflect it yet.

**Why:** discovered running `markTaskComplete` validation for a
documentation-only task with zero `.agents/memory/` edits of my own beyond
one topic file updated correctly through the CLI. The guard still flagged
`MEMORY.md` as drifted; `git diff` showed the on-disk `MEMORY.md` was two
index lines behind the live DB, and the two missing lines pointed at topic
files (about unrelated onboarding/coordination work) that didn't exist on
disk yet. There was no hand-edit anywhere in this checkout — the DB had
simply moved ahead of this checkout's last sync point because other hats
were actively writing to it at the same time.

**How to apply:** before assuming a hand-edit happened, run
`npx tsx server/scripts/agent-memory-cli.ts regenerate --all` and re-check
`git diff`. If the diff is purely additive/updating content you don't
recognize authoring (new topic files, new index lines, expanded existing
topic files), that confirms the concurrent-write cause — commit the sync as
part of your own change (the drift guard requires it to pass regardless of
who authored the underlying content) rather than trying to revert or
suppress it. Only treat it as a real hand-edit concern if `regenerate --all`
produces no diff, or produces a diff that would discard content the DB says
should be there.


**Addendum (Sep 29 2026):** the guard's actual scope check is "does this file differ from git HEAD", not "does it match the database right now" — `findAgentMemoryDriftInWorkingTree` only reports drift for paths `git diff --name-only HEAD` / `git ls-files --others` shows as locally modified or untracked; a file that is clean (matches HEAD) is exempt regardless of how far behind the live database it is. Under real concurrent multi-hat write pressure, `regenerate --all` can already be stale again by the time you re-check (the diff against HEAD kept growing across successive regenerate calls). Do not chase that: you cannot out-race an actively-writing hat, and you do not need to. Run `regenerate --all` once, then `git commit` the result immediately — a committed snapshot is permanently exempt from this guard even if the shared database moves again a second later, because the check only ever compares against your own last commit, never against the database's current state for clean files.

