The validation skill's `startValidationRun` polls a running check for a bounded number of cycles and can report `ERROR: POLL_BUDGET_EXCEEDED` on a suite that legitimately takes longer than that budget (observed on a ~159-step suite exceeding 10 minutes), even though the underlying shell command was still making real progress. When this happens, `getValidationRun({runId})` on the same run shows the command `STOPPED` with `exitCode: -1` -- the harness gave up and killed the process, not the process itself failing.

**Why:** treating `POLL_BUDGET_EXCEEDED`/`STOPPED` as a real failure and reporting it as such would be wrong -- the log up to that point may show every check passing right up until the cutoff, with no actual error.

**How to apply:** for a validation command known to run long, launch it directly with `ShellExec`'s `run_in_background: true` (redirect output to a log file, append an explicit exit-code marker after it) instead of `startValidationRun`, then use `Monitor` or periodic log tail checks to wait for completion. This has no poll-budget ceiling. Reserve `startValidationRun` for checks that finish comfortably inside its budget.

