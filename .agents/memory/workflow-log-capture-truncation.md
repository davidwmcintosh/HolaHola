## Finished status can arrive with the log tail stuck mid-check

Observed running the "Validation suite" workflow (`run-validation-suite.sh`,
~110+ chained checks, run-to-completion script rather than a persistent
server). Polling with RefreshAllLogs showed steady progress with zero
failures, then a later poll reported the workflow status as "finished"
with "no new content" to drain — but the most recent drained snapshot
file's tail stopped mid-check: a check header had printed, its result line
never appeared, and the script's own trailing summary
("ALL VALIDATION SUITE CHECKS PASSED", always printed on exit 0) was
missing entirely. Reading that exact file directly from disk (bypassing
RefreshAllLogs' incremental "since last cursor" semantics) showed the same
truncated tail, and no further snapshot file appeared even several minutes
later.

**Why:** the workflow status tracker (which reports "finished"/exit code)
and the log-drain-to-file mechanism are not perfectly synchronized for
process-style (run-to-completion) workflows. The last buffered stdout
chunk written at/after process exit can be dropped from the snapshot files
even though the process supervisor correctly recorded completion.
`ps aux` confirmed no process for the script or any of its sub-checks was
still running, which ruled out a genuine hang and pointed at a log-capture
artifact instead.

**How to apply:** if a script-workflow's drained log tail ends abruptly
mid-check while its status already reads "finished" (not "running"), do
not assume a hang or silent failure, and do not immediately re-run the
entire (possibly many-minutes-long) suite from scratch to find out what
happened. First confirm via `ps aux` (and `lsof` for any port the check
might bind) that nothing from the suite is still executing. If genuinely
stopped, read the runner script to identify exactly which check(s) after
the last captured line remain unconfirmed, and directly re-invoke just
those specific check commands via ShellExec to get their real pass/fail
result. That is far cheaper than a full re-run and, combined with the
zero-failures evidence already captured up to the truncation point, is
just as conclusive.

