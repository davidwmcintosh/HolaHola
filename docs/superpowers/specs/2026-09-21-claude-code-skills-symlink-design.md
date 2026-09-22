# Claude Code Skills Discovery: `.claude/skills` Symlink

**Status:** Reconstructed directly on `main` after task-agent merge failure
**Owner:** Luca [Replit]
**Date:** 2026-09-21

## Problem

`docs/agent-workflows.md` claimed `.agents/skills/` — the git-tracked skill
directory shared by every hat — was already fully visible to Claude Code:
"Claude Code can self-discover everything there with a glob, no separate
index needed." That was never true. Claude Code has no native mechanism to
glob an arbitrary repo path on its own initiative; it only auto-loads skills
it finds under its own `.claude/skills/` convention. Every other skill
shared this way required someone to notice it existed and restate it by
hand (e.g. an `editor_insights` pointer), which does not scale and drifts
silently.

This was originally scoped as task #1514 ("Let any agent discover and use
skills another agent installed") and dispatched to an isolated task agent.
That agent implemented and validated the fix in its own environment, but the
merge into `main` exhausted its retry budget (`MERGE_BUDGET_EXHAUSTED`) and
none of its changes — symlink, guard test, or doc correction — ever landed.
Per `.agents/memory/task-agent-merge-budget-fallback.md`, the fix was
reconstructed directly on `main` from the task's own approved description
plus independent verification of the underlying technical claims (rather
than replaying the stuck agent's unverifiable summary verbatim).

## Decision

`.claude/skills` is now a git-tracked relative symlink to `../.agents/skills`.
Claude Code's own native skill-discovery scans its own `.claude/skills/`
directory; because that directory now resolves through to every entry in
`.agents/skills/`, every current and future skill placed there is visible to
Claude Code automatically, with nothing to keep in sync by hand.

**Why a symlink and not a copy or a generated index:** a copy drifts the
moment either side is edited without remembering to re-sync the other. A
symlink has no second copy to drift — there is exactly one directory on
disk, reachable by two paths. This mirrors the project's own working
pattern of using structural fixes (a real relationship the filesystem or
database enforces) over disciplined-humans-remembering-to-update-a-thing
fixes, which is also why `CLAUDE.md` was earlier reduced to a single
`@AGENTS.md` import rather than kept as a hand-synced copy.

**What this does not fix:** `.local/skills/` is gitignored. A symlink can't
project a gitignored, un-pulled directory into visibility for a tool reading
a fresh checkout — there is nothing git-tracked to point at. That gap is
real, stays open, and is tracked as its own follow-up (share a personal or
Replit-only skill with the whole team), not folded into this fix.
Antigravity's own skill-loading convention was not independently verified as
part of this change and is not asserted here either way.

## Verification

`server/scripts/test-agent-skills-symlink.ts`, wired into
`server/scripts/run-validation-suite.sh` in both normal and `--self-check`
modes:

- Normal mode asserts `.claude/skills` is a real symlink, resolves to the
  same real path as `.agents/skills`, and lists identical contents.
- `--self-check` mode confirms the real repo passes first, then breaks the
  invariant three ways (symlink replaced by a plain directory; symlink
  pointed at the wrong target; symlink pointed at a nonexistent target) and
  confirms each is caught, restoring the real symlink via `try`/`finally` so
  a thrown assertion can never leave the repo's real symlink corrupted.

## Corrected documentation

`docs/agent-workflows.md`'s "Teaching Skills" section (which also carries
the unrelated Replit-vs-Claude-Code skill-directory disambiguation note) was
updated to state the real mechanism — the symlink — instead of the false
"Claude Code can glob it" claim, and to scope the `editor_insights` pointer
explicitly to the still-open `.local/`-only gap rather than implying it was
the one channel for every gap.
