# Cross-Hat Skill Discovery: Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-21-cross-hat-skill-discovery-design.md`
**Scope:** Add the `.claude/skills` symlink and its structural self-check, and
correct the one existing doc section that discusses the cross-hat skill
asymmetry. No schema, no new service, no new CLI.
**Rule:** Complete and verify each phase before beginning the next.

## Constraints (carried over from the design's invariants)

- The symlink is the entire mechanism for Claude Code parity — no copy
  script, no generator, no build step, no format conversion.
- `.local/skills/` and any hat's personal/global-scope installs are never
  auto-mirrored; this plan only lands the documented pointer/promotion
  convention for them, not automation.
- No existing `.agents/skills/*` content is renamed, moved, or reformatted —
  the fix is additive (one new symlink) plus a documentation correction.
- The new regression test must prove the guard fails when broken
  (`--self-check`), not just that it passes today, matching this project's
  established guard convention.

## Phase 1 — `.claude/skills` symlink and structural self-check

### Goal

Give Claude Code a native discovery path to `.agents/skills/`, and prove the
invariant holds with an automated, self-checking guard wired into the
existing validation suite.

### Files

- `.claude/skills` (new symlink)
- new `server/scripts/test-agent-skills-symlink.ts`
- `server/scripts/run-validation-suite.sh`

### Steps

1. Create `.claude/skills` as a relative symlink: `ln -s ../.agents/skills .claude/skills`.
2. Confirm git recorded it as a symlink (`git ls-files -s .claude/skills` shows
   mode `120000`), not a text file containing the target path.
3. Write `test-agent-skills-symlink.ts`:
   - Normal mode: assert `.claude/skills` exists, `fs.lstatSync` reports a
     symbolic link (not a plain file or real directory), `fs.realpathSync`
     resolves it to the same real path as `.agents/skills`, and the sorted
     list of immediate subdirectory names under each path is identical.
   - `--self-check` mode: repeat the same comparison against a deliberately
     wrong target (an empty temp directory created for the run, standing in
     for a hypothetical de-symlinked `.claude/skills`) and assert the
     comparison fails (non-zero exit) — proving the guard would actually
     catch the regression it exists to catch.
4. Add two `run_check` lines to `run-validation-suite.sh`, immediately after
   an existing self-check-paired entry (matching the file's established
   pattern, e.g. the GL game-session detector lines): one for normal mode,
   one for `--self-check`.

### Verification

- `find .claude/skills -mindepth 1 -maxdepth 1 -type d | sort` and
  `find .agents/skills -mindepth 1 -maxdepth 1 -type d | sort` produce
  identical output (33 names).
- `git ls-files -s .claude/skills` shows a `120000` symlink mode entry.
- `npx tsx server/scripts/test-agent-skills-symlink.ts` exits 0.
- `npx tsx server/scripts/test-agent-skills-symlink.ts --self-check` exits 0
  (meaning it successfully proved the broken case fails).
- Both new `run_check` lines pass in a live run of
  `server/scripts/run-validation-suite.sh`.

## Phase 2 — Documentation correction

### Goal

Replace the outdated "Claude Code can self-discover via glob" claim and the
"`editor_insights` is the one channel that crosses this boundary" claim in
`docs/agent-workflows.md` with the corrected, current state.

### Files

- `docs/agent-workflows.md` ("Teaching Skills" section only)

### Steps

1. Rewrite the asymmetry paragraph: state that Replit Agent, Antigravity, and
   (via the new symlink) Claude Code all natively discover `.agents/skills/`
   today, through the identical `agentskills.io` open-standard mechanic; only
   `.local/skills/` and a hat's own personal/global-scope installs remain
   genuinely local to that runtime.
2. Replace the single-channel `editor_insights` claim with the corrected
   pointer/promotion convention from the design: `editor_insights`
   (category `tools`) for durable searchability, a shared-spec fast-share
   note (optionally `--notify <actor-id>`) for immediate cross-hat awareness,
   and promotion into `.agents/skills/` when the tool is actually usable
   outside its originating runtime.
3. Leave every other section of `docs/agent-workflows.md` untouched.

### Verification

- Re-read the rewritten section against Phase 1's actual, verified mechanism
  — no claim in the doc should outrun what Phase 1 built (e.g., do not claim
  Claude Code discovery is "confirmed" in a live session; the design's
  Error handling section already discloses that limit).
- `git diff docs/agent-workflows.md` touches only the "Teaching Skills"
  section.

## Phase 3 — Final verification and commit

### Goal

Confirm nothing else regressed and land the change as one coherent commit.

### Steps

1. `npm run typecheck`.
2. Run `server/scripts/run-validation-suite.sh` in full (not just the two new
   checks) to confirm no unrelated regression from adding the symlink or
   editing the doc.
3. Commit the symlink, the new test script, the validation-suite wiring, and
   the documentation correction together in a single commit.

### Verification

- Validation suite passes end to end.
- `git status` is clean after the commit.
- `git show --stat HEAD` lists exactly the expected file set: `.claude/skills`,
  `server/scripts/test-agent-skills-symlink.ts`,
  `server/scripts/run-validation-suite.sh`, `docs/agent-workflows.md` — no
  unrelated files.

## Explicitly out of scope for this plan

Carried over from the design's "Explicitly deferred" section — not phases of
this plan, not follow-up items to implement now:

- A generated, browsable skills catalog doc.
- A DB-canonical `agent_skills` registry.
- Automatic mirroring of `.local/skills/` or personal/global-scope installs
  into `.agents/skills/`.
