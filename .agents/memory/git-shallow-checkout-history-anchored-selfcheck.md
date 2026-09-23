## Git shallow checkout breaks history-anchored self-checks

GitHub Actions' default `actions/checkout` action clones with `fetch-depth: 1`
(a single commit, no ancestor history). Any test or self-check that anchors
itself to a specific historical commit SHA — running `git show <sha>`,
`git cat-file -p <sha>`, `git log --all` expecting to find it, etc. — will
fail there with a misleading error (e.g. "could not read one or more fixture
commits") that looks like a data/fixture bug, not a checkout-depth bug.

**Why:** `detect-episode-dialogue-loss.ts --self-check` anchors its fixture to
real historical commit SHAs from a specific incident. It passed in every
local dev shell (which always has full history) and failed only on a real
GitHub Actions run, confirmed via that run's logs — the fix was adding
`fetch-depth: 0` to the `test-unit` job's checkout step in `.github/workflows/ci.yml`,
not touching the self-check's own logic at all.

**How to apply:** Before assuming a CI failure in a git-history-dependent
check is a logic bug, check whether the workflow's checkout step has
`fetch-depth: 0`. If a new self-check needs to reference specific past
commits, either add `fetch-depth: 0` to its job's checkout, or make the
self-check degrade gracefully (skip/synthetic-fallback) when the referenced
commit isn't reachable, the same way DB-unavailable self-checks already do.

