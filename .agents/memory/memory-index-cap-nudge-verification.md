The automated "MEMORY.md is past 80% of its line/byte cap" nudge can fire repeatedly even when direct measurement shows the file under both caps.

**Why this matters:** the nudge self-hedges ("may have changed since you last wrote it"), so it is a heuristic prompt, not a guaranteed-accurate live count. Deleting or rewriting other actors' index entries in this shared, multi-hat file on the strength of the nudge alone -- without confirming the file actually needs trimming -- risks destroying durable lessons another hat still needs, for a problem that may not exist.

**How to apply:** before trimming, measure directly (`wc -l -c .agents/memory/MEMORY.md`) and compare against the stated caps. If the measured file is not actually over either cap, it is safe to leave the index alone and continue with the assigned task; note that you checked rather than performing a speculative bulk edit. Only trim (via `edit-entry`/`remove-entry` through the CLI, never a hand-edit) once a fresh measurement genuinely confirms the file is over cap.


**A confirmed over-cap measurement still doesn't guarantee a safe trim exists.** Sep 25 2026: at a genuinely measured 162/200 lines (81%, byte cap not implicated), a systematic search -- exact-duplicate title/hook scan, spot-reading 8+ topic files against current code, a keyword scan for self-declared obsolescence ("superseded by", "deprecated", etc.), and a title-similarity pass across thematically-close entries (e.g. the several separate Luca-identity entries) -- found zero safe removal/merge candidates. Every entry inspected carried forensic/debugging narrative not reconstructable from the code alone.

**Why this matters:** past-cap does not imply an easy trim exists. A memory file maintained under this file's own no-code-derivable-content rule can legitimately accumulate many small, genuinely distinct, non-redundant lessons in a long-running multi-agent project. The 200-line cap is a display-truncation point (entries past it stop showing in future prompts), not a hard deletion -- rows already in the DB aren't destroyed by exceeding it. Forcing a deletion under nudge pressure risks trading a real, hard-won lesson for a line-count fix that a few more entries would just re-trigger anyway.

**How to apply:** if a genuine measurement confirms over-cap and a good-faith search (duplicates, per-topic-file spot-check, obsolescence keywords, title clustering) turns up no safe candidate, it's acceptable to leave the index alone and note the search was done rather than force a destructive edit. Revisit once either a real duplicate emerges naturally or the margin narrows enough that visibility loss (not just the risk of it) is imminent.


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


## Task 1592 addendum: 3 more merges executed, others deliberately rejected

Task 1592 (Sep 25 2026), after the "zero candidates" finding above: found and executed 3 further
content-preserving merges anyway, none of them duplicates or obsolete content — each was a set of
short, thematically-adjacent-but-distinct entries folded under one umbrella topic, the same
pattern `replit-sandbox-process-quirks.md` already used successfully (that file's own heading says
"Consolidates 4 topics").

Executed: `coordination-ledger-preexisting-failures` → `consolidated-ci-preexisting-failures`
(same lesson — verify a pre-existing-failure claim against current HEAD — applied to a different
suite; also folded in a fresh finding from this task about a stale actor-enumeration test
fixture); `already-resolved-followup-task` → `status-signal-verification` (inverse-direction case
of the same "verify actual state, don't trust appearances" family already collected there); three
small git command-line gotchas (pathspec-scoped commit staging, committer-vs-author recency date,
SSH host-key/LFS-hook hangs) → new topic `git-operational-gotchas`; `memory-index-rebase-conflicts`
folded into this topic (both are meta-lessons about MEMORY.md's own DB-projection mechanics).
Net effect: roughly 164 → 159 index lines.

**Why this doesn't contradict the finding above:** that search's methodology (duplicate-title
scan, obsolescence keywords, title-similarity clustering) correctly found no *duplicate or dead*
entries — these merges weren't that; they were live, distinct, non-redundant lessons regrouped
under fewer umbrella topics without deleting any content.

**Candidates examined and deliberately rejected as too dissimilar to force together:**
`bootstrap-mismatch-diagnosis` / `runtime-rotation-pairing-verification` /
`credential-rotation-recovery-authority` (three distinct points in the credential-rotation
lifecycle); `disposable-database-gate-design` / `postgres-hermetic-testing-gotchas` (both already
large, well-organized, non-overlapping); `coordination-actor-completeness-tiers` /
`coordination-credential-cache-coexistence` (different specific concerns that merely touch
adjacent files); the three Luca-identity entries (`luca-hat-naming-convention`,
`luca-roles-not-bifurcation`, `luca-provider-neutral-execution` — each carries distinct policy
content despite thematic adjacency).

**How to apply:** don't re-attempt merging the "rejected" list above without new information —
they were read in full and judged genuinely distinct, not skipped for lack of time.


## A stale-looking local file can mean "another workspace already fixed it," not "nothing changed"

`.agents/memory/*.md` files are a per-workspace generated projection of the shared DB (see this file's own preamble). A different hat's CLI write — including a `remove-entry`/`remove-block` — updates the DB immediately and regenerates files *in that hat's own workspace*, but does nothing to any other checkout's on-disk files until that checkout runs its own `regenerate --all` (or makes its own next write, which only regenerates the topic(s) it touched).

**Why this matters:** re-measuring `wc -l MEMORY.md` in your own workspace and getting the same number you saw before is not proof nothing changed — it can mean another hat already fixed the exact thing you were about to fix, in parallel, and your local file simply hasn't caught up. Proceeding to independently re-do that work risks a redundant or conflicting write on top of a change that already landed. `git status --short .agents/memory/` reading clean while you know of a very recent DB write you didn't make is the tell: your local projection is behind, not that the write didn't happen.

**How to apply:** if you suspect concurrent activity on this shared file (recent timestamps on entries/blocks you didn't touch, a task list showing another actor active), query the DB directly for the entries/blocks in question before planning an edit, and run `npx tsx server/scripts/agent-memory-cli.ts regenerate --all` to sync your local files to current DB truth before deciding what, if anything, still needs doing.


## edit-entry/edit-block's "Stale version" message can mean "deleted", not "version changed" — now fixed

editEntry() and editBlock() in server/services/agent-memory-core.ts used to fail the same way (zero rows matched) whether the target row's version genuinely moved or the row was soft-deleted by a concurrent actor (deletedAt no longer null, version unchanged). The CLI printed "Stale version: entry ... is now at version N (yours was based on an older version)" in both cases, so if N was exactly the --base-version already passed, the message was actively misleading: nothing about "version" had actually changed.

**Confirmed directly on task 1615 (Sep 27 2026):** a concurrent Replit Agent session (different task, same shared DB, self-reporting the same "luca-replit" actor string) deleted a handful of entries -- including one this session had just queried and was about to edit -- moments before the edit-entry call ran. The resulting message reported the exact version this session had already based its edit on, which looked like a CLI bug rather than a concurrent deletion, and took a direct deleted_at query to actually diagnose.

**Fixed:** editEntry/editBlock's failure result now carries an explicit `reason: "deleted" | "version_mismatch"` field (computed from `deletedAt !== null`, since deletion never bumps `version`), and the CLI's error message names the real cause directly -- "Cannot edit ... it was deleted by \<actor\> at \<time\>" instead of "Stale version" text when the row was actually deleted. A manual `deleted_at` query is no longer needed to tell the two apart. See [CAS failure reason](agent-memory-cas-failure-reason.md) for the durable interface contract this establishes.

