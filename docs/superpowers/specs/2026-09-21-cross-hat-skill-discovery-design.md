# Cross-Hat Skill Discovery: Shared `.agents/skills/` Without a New Registry

**Status:** Approved design pending written-spec review
**Owner:** Luca [Replit]
**Date:** 2026-09-21

## Problem

Task #1514: each hat's skill directory (Replit's `.local/skills/` + `.agents/skills/`,
Claude Code's own installed skills, Antigravity's) is currently assumed to be private
to that runtime, even though the hats are meant to act as one coordinated team. A
skill one hat creates or installs should be discoverable and usable by every other
hat, regardless of which one added it. The task names the same pattern already built
for `.agents/memory/` and the two shared instruction docs
(`docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md`) as likely
precedent, but flags skills as a distinct asset class needing its own brainstorming
session rather than being folded into that plan.

## Research findings (why this is a smaller problem than it looks)

Before designing anything, this session verified — against Anthropic's and Google's
current documentation, not recalled training knowledge — how Claude Code and Google
Antigravity actually load skills today:

1. **All three runtimes use the identical open standard.** Replit, Claude Code, and
   Antigravity have each adopted the `agentskills.io` Agent Skills format: a folder
   containing a `SKILL.md` file with YAML frontmatter (`name`, `description`) and a
   progressive-disclosure loading model (name+description surfaced up front, full
   body read only when the skill is invoked). There is no format-translation problem
   to solve between hats — the artifact is byte-identical wherever it lives.
2. **Antigravity already reads this repo's `.agents/skills/` natively.** Google's
   Antigravity docs state its workspace-scoped skill path is literally
   `<workspace-root>/.agents/skills/<skill-folder>/` — the exact directory already
   git-tracked in this repo (33 skills, 174 tracked files as of this design). Nothing
   needs to change for Antigravity to see every skill in this repo today.
3. **Replit Agent already reads it too** — confirmed directly by this session's own
   system prompt, which lists all 33 `.agents/skills/` entries as available skills
   alongside the platform-provided `.local/skills/` set.
4. **Claude Code is the one runtime with a real, structural gap.** Its native Agent
   Skills discovery scans `.claude/skills/<name>/SKILL.md` — in the current project
   directory, in parent directories up to the repository root, and in the user's home
   directory (`~/.claude/skills/`) — plus any directory passed via `--add-dir`. It has
   no notion of `.agents/skills/` at all. `.claude/skills/` does not exist in this repo
   today, so there is no naming collision to resolve.

`docs/agent-workflows.md` already carries a related but weaker claim — that "Claude
Code can self-discover everything [in `.agents/skills/`] with a glob." That was only
ever true in the sense that an instructed agent could read the files if it went
looking; it is not the same as Claude Code's native Skill-tool discovery, which
surfaces a skill's name and description automatically at session start the same way
Replit's and Antigravity's own mechanics do. That claim is corrected as part of this
design (see Architecture, Documentation updates).

## Scope

In scope:

1. Closing Claude Code's structural gap so it natively discovers the exact same
   `.agents/skills/` files Replit Agent and Antigravity already read — no copy, no
   translation.
2. A documented (not automated) convention for the genuinely non-portable remainder:
   `.local/skills/` (Replit-platform tooling) and any hat's own personal/global-scope
   skill installs (a Claude Code plugin installed outside this checkout, a skill
   dropped into Antigravity's global `~/.gemini/antigravity/skills/`).
3. Correcting the one existing doc section (`docs/agent-workflows.md`, "Teaching
   Skills") that already discusses this asymmetry, so it states the current, verified
   reality instead of the prior assumption.
4. A structural self-check proving the fix holds, wired into the existing validation
   suite, following this project's established guard-plus-self-check convention.

Out of scope:

- Building a DB-canonical `agent_skills` registry (tables, CLI, per-runtime
  projection generator) mirroring the memory/docs design. See "Explicitly deferred"
  for why that mechanism doesn't transfer here.
- A generated, browsable skills catalog (`docs/skills-catalog.md`). Also deferred —
  see below.
- Any automatic mirroring of `.local/skills/` content, or any hat's personal/global
  skill installs, into `.agents/skills/`. These are addressed by an explicit
  pointer/promotion convention, never silent sync, because the source files do not
  exist as portable content across runtimes in the first place (see Architecture).
- Renaming, moving, or reformatting any existing skill under `.agents/skills/`.
- Teaching Skills (the DB-backed `teaching_skills` table Daniela invokes during
  lessons) — already explicitly a different asset class per `docs/agent-workflows.md`
  and untouched by this design.

## Decisions from stakeholder input

Confirmed with David before finalizing the architecture:

- **Asset scope:** include `.local/skills/` and personal/global-scope installs, not
  just `.agents/skills/` — but per Architecture below, "include" means "give this a
  documented bridge," not "silently mirror," since the underlying files are not
  portable across runtimes.
- **Architecture ambition:** minimal. A symlink plus documentation, not a new database
  schema — because unlike `MEMORY.md`, adding a skill is already a conflict-free git
  operation (a new subdirectory), so the concurrent-whole-file-edit hazard that
  justified DB-canonical storage for memory does not apply to skills.
- **Deliverable bar for this session:** write and commit the design and implementation
  plan, and also land the minimal fix itself (the symlink, its self-check, and the
  documentation correction) in this same session, rather than deferring all
  implementation to a follow-up task.

## Invariants

1. `.agents/skills/` remains the single git-tracked source of truth for
   project-authored, cross-hat-shared skills. No hat hand-maintains a second copy of a
   shared skill's content anywhere else in the repo.
2. Every runtime's native skill-loading mechanic resolves to the exact same files
   under `.agents/skills/` — never a translated or duplicated copy — so there is
   exactly one place to edit a shared skill regardless of which hat edits it.
3. The `.claude/skills` symlink is a pure filesystem alias with no independent
   content of its own; it must never become, or be replaced by, a real file or
   directory that could drift from `.agents/skills/`.
4. `.local/skills/` and any hat's personal/global-scope skill installs stay outside
   the shared store by construction. Crossing that boundary is always an explicit act
   — a pointer (so other hats know something exists) or a promotion (copying usable
   content into `.agents/skills/`) — never an automatic or silent sync, because the
   source directories do not exist as portable files on every runtime.
5. A regression that turns `.claude/skills` back into an ordinary directory, or lets
   it diverge from `.agents/skills/`, must be caught by an automated check — not
   discovered later by a hat noticing a skill is missing.

## Architecture

### Closing the one real gap: `.claude/skills`

Add `.claude/skills` as a git-tracked, relative symlink to `../.agents/skills`.
Claude Code's native project-skill scan already looks at `.claude/skills/` in the
project directory; once the symlink exists, that scan resolves to the same 33
`SKILL.md` files Replit Agent and Antigravity already read, through the same
progressive-disclosure mechanic (name+description at session start, full content on
invocation) — no sync script, no generator, no build step, and no format conversion,
because the artifact format was already identical across all three runtimes before
this change.

This is a materially different guarantee than the doc's prior claim: before, an
instructed Claude Code session could stumble onto `.agents/skills/*/SKILL.md` only
through general file exploration if told to look; after, it gets the same native,
autonomous, name-and-description-driven discovery every other runtime already has.

### `.local/skills/` and personal/global-scope installs: pointer and promotion, not sync

`.local/skills/` is gitignored by the Replit platform and holds Replit's own built-in
tooling (pdf, canvas, deployment, security-scan, and similar product features) — not
content a hat "installed" as part of building HolaHola. It does not exist as a
directory on any non-Replit runtime's filesystem at all, so no per-runtime-projection
scheme can make it natively appear elsewhere; the files genuinely are not portable.
The same reasoning applies to a skill any hat installs at its own personal or global
scope outside this checkout — a Claude Code plugin a contributor installed locally, or
a skill dropped into Antigravity's global `~/.gemini/antigravity/skills/` — those live
outside git by construction, for that runtime instance alone.

For both cases the bridge is always an explicit act, never silent sync:

1. **Pointer** — record that the tool exists, using whichever of these fits the
   moment: an `editor_insights` row (`category = 'tools'`) for durable, queryable
   institutional memory (the existing convention this project already documents), and
   a shared-spec fast-share note (`shared-spec-cli.ts share`, optionally
   `--notify <actor-id>`) when a specific hat should know right now rather than the
   next time someone queries `editor_insights`. These are complementary, not
   competing: `editor_insights` answers "have we seen this before" later;
   `--notify` answers "does someone need to know this today."
2. **Promotion** — if the tool is actually usable outside its originating runtime (it
   doesn't depend on Replit-only callbacks or another runtime's proprietary plugin
   API), copy its `SKILL.md` and any bundled resources into `.agents/skills/<name>/`,
   crediting the origin, and commit. Once promoted, it is exactly the same shared
   asset as every other entry in `.agents/skills/` — visible to every hat through the
   same native-or-symlinked paths above, with no further special-casing.

No code implements this half of the scope. There is nothing to build a sync mechanism
for — the source content genuinely does not exist as files on every runtime — so the
correct fix is a documented convention, not automation pretending otherwise.

### Documentation updates

`docs/agent-workflows.md`'s "Teaching Skills" section is the one place today that
already discusses the `.agents/skills/` vs. `.local/skills/` asymmetry, and it is
rewritten (not superseded elsewhere) to state the corrected, current picture: all
three runtimes now natively resolve `.agents/skills/` (two natively already, Claude
Code via the new symlink); `.local/skills/` and personal/global-scope installs remain
genuinely local, bridged only by the pointer/promotion convention above, replacing the
prior "`editor_insights` is the one channel that crosses this boundary" claim, which
is no longer accurate on either half (Claude Code no longer needs a channel at all for
`.agents/skills/`; the fast-share note is now an available second channel for the
part that still does).

No changes are needed to `docs/shared-agent-instructions.md` or `replit.md`:
`replit.md` already routes every hat's session start through
`docs/agent-workflows.md` (`CLAUDE.md` → `docs/shared-agent-instructions.md` and
`replit.md` → `docs/agent-workflows.md`'s session-start checklist), so the corrected
section is already inside every hat's existing reading chain without adding a new
required read anywhere.

## Error handling / known caveats

- **Windows Git symlink risk.** If a checkout has `core.symlinks=false` (the default
  on Windows without Developer Mode or admin rights), Git materializes `.claude/skills`
  as a plain text file containing the literal target path instead of a real symlink.
  Claude Code's directory scan would then simply find no `.claude/skills/` directory
  on that machine and silently proceed as if no project skills exist there — not a
  crash, but a silent capability loss specific to that checkout. This design does not
  solve that at the Git layer (it is a client-side configuration issue this repo
  cannot force); it is disclosed here rather than assumed away. Any hat running Claude
  Code from a Windows checkout should confirm `git config core.symlinks` is `true`
  before relying on this path — this project already has Windows-based tooling
  (`scripts/antigravity-gate3.ps1`) so the case is real, not hypothetical.
- **Verification limit.** This design can prove — from inside this repo — that the
  symlink is structurally correct: it exists, it is a real symlink (not a plain file),
  and it resolves to a path listing the same skill names as `.agents/skills/`. It
  cannot prove that a live Claude Code session actually lists and invokes one of these
  skills through its own UI/tool-call path; that can only be confirmed by running
  Claude Code itself, matching the equivalent, already-disclosed limitation in the
  memory/docs implementation plan's Phase 7 verification.

## Testing

New `server/scripts/test-agent-skills-symlink.ts`:

- **Normal mode** asserts: `.claude/skills` exists; `fs.lstatSync('.claude/skills')`
  reports a symbolic link, not a plain file or real directory; resolving the symlink
  yields the same real path as `.agents/skills`; and the set of immediate
  subdirectory names under each path (the skill names) is identical.
- **`--self-check` mode** proves the guard has teeth, matching this project's
  established convention of pairing every guard with a test that proves it actually
  fails when the protected property regresses: it points the same comparison at a
  deliberately wrong target (an empty temporary directory standing in for a
  hypothetical de-symlinked `.claude/skills`) and asserts the normal-mode assertion
  would correctly fail against it, non-zero exit.
- Wired into `server/scripts/run-validation-suite.sh` as two `run_check` lines
  (normal mode, then `--self-check`), matching the file's existing pattern for other
  guard-plus-self-check pairs (e.g. the GL game-session detector, the raw-window
  capture alignment check). No database is involved, so no disposable-branch gating
  or `neon-branch.ts` allowlist entry applies — this is a pure filesystem check.

## Explicitly deferred

- **A generated, browsable `docs/skills-catalog.md`** (name, description, owning hat
  per skill), in the spirit of `docs/operations-catalog.md`. A reasonable follow-up if
  skill count or provenance tracking becomes a real day-to-day need, but not required
  to satisfy "any hat can discover and use a skill another hat installed" — native
  discovery already answers that for everything under `.agents/skills/`.
- **A DB-canonical `agent_skills` registry** mirroring the memory/docs design's
  tables, CLI, and per-runtime projection generator. Not justified today: the
  memory/docs design's DB-canonical mechanism exists specifically to make concurrent
  *edits to the same file* conflict-free (88 commits/60 days on `MEMORY.md` alone,
  with a real merge conflict already on record). Adding a skill is structurally
  different — it is always a new subdirectory, which is already conflict-free at the
  git level; two hats adding two different new skills in the same window never
  collide. There is no analogous hazard here for a database layer to solve.
- **Automatic mirroring** of `.local/skills/` content, or any hat's personal/global
  scope installs, into `.agents/skills/`. Addressed by the explicit pointer/promotion
  convention above, not automation, because the source content does not exist as
  portable files across runtimes to mirror from.

## File inventory after this change

| Path | Mechanism | Notes |
|---|---|---|
| `.agents/skills/*` | Git-tracked directory (unchanged) | Canonical shared store; already native to Replit Agent and Antigravity |
| `.claude/skills` | New git-tracked symlink → `../.agents/skills` | Gives Claude Code the same native discovery path; no independent content |
| `.local/skills/*` | Gitignored, Replit-platform-managed (unchanged) | Not portable; bridged only by the explicit pointer/promotion convention |
| `docs/agent-workflows.md` | Existing file, "Teaching Skills" section rewritten | Corrects the stated asymmetry to match the verified, current state |
| `server/scripts/test-agent-skills-symlink.ts` | New, self-checking regression test | Proves the symlink invariant holds and that the guard would catch a regression |
