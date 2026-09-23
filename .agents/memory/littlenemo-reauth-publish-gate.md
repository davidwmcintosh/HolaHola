## Founder-stop sequence

Per `docs/superpowers/specs/2026-09-17-coordinator-v2-windows-reauthorization-compatibility-repair-design.md`
(David-approved), any fix that Windows-host reauthorization testing depends on
must clear this exact sequence:

1. commit + push exact source
2. `prepare` + verify a fresh protected source promotion
3. **stop — founder-only source publication** (only David's actual Publish
   action produces the commit marker `record` requires)
4. `prepare` + verify a fresh runtime release
5. **stop — founder-only runtime publication**
6. fast-forward LITTLENEMO to the exact published commit, verify its tree
7. replay the existing persisted reauthorization generation
8. verify the pending DB row + approval metadata
9. **stop — founder-only approval**
10. poll/sign/store the replacement credential
11. initialize + verify the runtime without creating a session

**Why:** the doc states "No step may reuse a source promotion or runtime
release prepared for different source bytes" — this is a strict,
non-reorderable chain, not parallel tracks. A `prepare` that returns
`ready_to_promote` clears only step 2; three separate founder-only stops (3,
5, 9) remain before LITTLENEMO can be touched.

**How to apply:** when asked to get a fix ready for LITTLENEMO/Windows-reauth
testing, report which step number you've reached rather than implying the
whole chain is done because CI/prepare passed.


## A prepared candidate's `record` window closes if reconciliation becomes necessary

`record`'s `recordLocked` requires `.local/source-bridge-status.json` to still
read `state: "ready_to_promote"` for that exact `candidateSha`, AND (once
heads differ from the candidate) requires the marker commit's *direct* git
parent to be the candidate sha. If local/GitHub `main` diverge for any reason
after `prepare` but before `record` — e.g. an unrelated task's work lands
directly on GitHub main while a doc commit + the publish marker land on local
main — reconciling that divergence via the `candidate`/fast-forward/`sync`
pipeline both flips status past `ready_to_promote` and inserts a 2-parent
merge commit between the old candidate and the current tip. Both effects
independently make `record` for that original candidate permanently
unrecordable, even though its code is fully preserved as an ancestor of the
new unified tip and nothing was lost.

**Why:** hit this live Sep 23 2026 — a founder publish landed cleanly on
local `main`, but a separate task had pushed straight to GitHub `main` from
the same base in the meantime. Reconciling was the correct call
(non-overlapping changes, clean merge), but it retroactively closed the
`record` window for the candidate that had just been published.

**How to apply:** this is not a failure to route around — it matches the
design doc's own rule that no step may reuse a source promotion prepared for
different source bytes. Once reconciliation changes the tip, run a fresh
`prepare` against the new tip and go through the founder-only publish stop
again with the new candidate, rather than trying to force the old `record`
call through.

