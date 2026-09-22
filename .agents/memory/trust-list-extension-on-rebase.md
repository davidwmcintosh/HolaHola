## Fail-closed trust lists go stale across concurrent tasks

A static guard that trusts specific helper factories by exact (name, module) pair -- not a name-pattern guess -- correctly fails closed (reports "unresolved"/violation) when a concurrent or rebased-in task introduces a NEW, differently-named canonical helper that is equally safe. This is intended behavior, not a bug in the guard.

**Why:** independent task agents can each add their own "obviously safe" sandbox/helper pattern without knowing about a sibling guard's explicit trust list. A guard that pattern-matches names/shapes ("looks like a sandbox factory") can be spoofed by a same-file function merely named like one, so exact-origin trust lists are the deliberate, reviewed design here. That correctness means the trust list goes stale the moment a rebase brings in a new helper, surfacing as new "unresolved" call sites and stale allowlist entries simultaneously.

**How to apply:** after any rebase/merge that lands commits touching files referenced by a guard's ALLOWLIST/TRUSTED_* list, re-run that guard standalone first (before the full validation suite) to see exactly which entries went stale and which new call sites appeared unresolved. Read the new helper's implementation to confirm it is genuinely sandboxed (e.g. mkdtempSync-rooted) before adding it to the trust list -- extend the list because you verified it, not because the rebase is applying pressure to make the test pass.

