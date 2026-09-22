## git log recency filters must use committer date (%ct), not author date (%at)

A CI/detection script that filters commits by "landed within the last N hours" using git's author date (`%at`/`%ad`) can silently misjudge a commit's age, because author date travels with the commit through rebase, cherry-pick, and `git commit --date=...`, and can be arbitrarily old (or deliberately backdated) even for a commit that just landed in the branch being checked. Committer date (`%ct`/`%cd`) reflects when the commit actually landed in the repository being inspected — a rebase or cherry-pick stamps a fresh committer date even when the author date is preserved from the original authoring time.

**Why:** confirmed via a hermetic regression test — a commit made with `git commit --date <10-years-ago>` (which sets only the author date; git always stamps the committer date with the real current time unless `GIT_COMMITTER_DATE` is also overridden) read as roughly 10 years old under `%at`-based age calculation, but correctly read as "just now" under `%ct`.

**How to apply:** any script answering "did this land recently" — recency-gated CI checks, staleness detectors, "what changed in the last N hours" reports — should use `%ct`/`%cd`, not `%at`/`%ad`, unless there is a specific reason to care about original authorship time rather than landing time.

