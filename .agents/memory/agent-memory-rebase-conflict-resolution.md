---
name: Memory-file rebase conflicts resolve via regenerate, not hand-merge
description: When markTaskComplete's rebase onto main hits a conflict inside .agents/memory/*.md, resolve by running the CLI's regenerate, not by interpreting git's ours/theirs prose.
---

A rebase conflict landing inside `.agents/memory/MEMORY.md` or a `.agents/memory/<topic>.md` file during `markTaskComplete` is not a normal content conflict between two authors' prose -- the underlying `agent_memory_*` database is shared across every hat and git branch, so both "sides" of the conflict are usually just two different git snapshots of the same DB at different points in time.

**Why this matters:** trying to manually judge which side's wording is "more correct" or "more polished" is the wrong frame, and can be actively misleading -- in a `git rebase` (not `merge`), "ours" is the branch being rebased onto (upstream/main) and "theirs" is your own commit being replayed, which is the reverse of normal intuition and the reverse of `git merge`'s convention. Guessing wrong risks discarding a concurrent hat's real update.

**How to apply:** for any conflict confined to `.agents/memory/`, don't hand-splice the two texts. Resolve just enough to clear conflict markers (pick either side as a placeholder), then run `npx tsx server/scripts/agent-memory-cli.ts regenerate --all` before calling `continueMergeResolution` -- it overwrites every memory file (index and topic files) from the live shared DB, which already contains both sides' legitimate writes (yours and any concurrent hat's), so the regenerated files are the correct merged result without needing to read either diff. Confirmed working: a two-file conflict (one topic file, plus MEMORY.md's index) both resolved to the fully-correct combined content after one `regenerate --all` call, with zero net diff remaining against the branch being rebased onto.

