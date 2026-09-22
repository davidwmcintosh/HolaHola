# Claude Code Skills Symlink — Implementation Plan

**Status:** Complete
**Date:** 2026-09-21
**Design:** `docs/superpowers/specs/2026-09-21-claude-code-skills-symlink-design.md`

## Context

Reconstruction of task #1514 directly on `main` after the task agent's
isolated-repl implementation failed to merge (`MERGE_BUDGET_EXHAUSTED`, zero
changes landed — confirmed by direct inspection: no symlink, no guard test,
no doc change, no design/plan docs under `docs/superpowers/`, clean git
status, no matching commit in `git log`).

## Steps

1. **Create the symlink** — `.claude/skills` -> `../.agents/skills`
   (relative, git-trackable; `core.symlinks` defaults to `true` on this
   platform). Verified: real symlink, `readlink` matches, directory listing
   through the link matches the direct listing exactly.
2. **Write the guard test** — `server/scripts/test-agent-skills-symlink.ts`,
   mirroring the existing self-check convention
   (`test-github-branch-bypass-guard.ts`,
   `test-cross-tool-promote-push-auth-guard.ts`): colored pass/fail output,
   `runRealCheck()` for normal mode, `selfCheck()` for `--self-check`,
   dispatch on the `--self-check` argv flag. Unlike those two examples, this
   guard needs no external credential and no environment skip branch — it
   only touches the local filesystem, so it can run anywhere including an
   isolated task-agent worktree.
3. **Wire into the validation suite** — added as a `run_check` line in
   `server/scripts/run-validation-suite.sh`, immediately after the
   Cross-tool-promote push-auth guard, running both the normal and
   `--self-check` invocations in one step like its neighbors.
4. **Correct the documentation** — `docs/agent-workflows.md`'s "Teaching
   Skills" section: replaced the false "Claude Code can glob it" claim with
   the real symlink mechanism and a pointer to the guard test; kept the
   `.local/skills/`-is-gitignored-forever framing (still true, unaffected);
   narrowed the `editor_insights`-is-the-one-channel claim to explicitly
   scope it to the still-open local-only gap rather than implying it
   covered the now-closed git-tracked gap too.
5. **Verify** — ran the new guard in both modes directly (pass), confirmed
   the symlink survives the self-check's fixture-and-restore cycle intact,
   ran `npm run typecheck` clean, then ran the full validation suite.

## Explicitly out of scope

- Making `.local/skills/` (gitignored) visible to Claude Code — tracked as
  its own separate follow-up, not a symlink-shaped problem since there is no
  git-tracked target to point at.
- Verifying or documenting Antigravity's own skill-loading convention — not
  touched by this change, not asserted either way.
- Re-litigating which directory each hat should read from — this plan only
  restores task #1514's already-approved scope after its merge failure, not
  a fresh design pass.
