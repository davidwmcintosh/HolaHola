## Simulating a "fresh checkout" locally requires unsetting REPL_HOME too

`server/services/workspace-root.ts`'s `resolveWorkspaceRoot()` resolves the
canonical workspace root by checking `HOLAHOLA_WORKSPACE_ROOT`, then the
Replit-only `REPL_HOME` env var, before falling back to `process.cwd()`.
A Replit dev/task-agent shell always has `REPL_HOME` set to the real
workspace path. Real GitHub Actions runners never set `REPL_HOME` — there
`resolveWorkspaceRoot()` always falls through to `cwd()`.

**Why:** While root-causing a CI-only bug, a `git worktree add --detach
/tmp/fresh-checkout` was used to simulate a from-scratch checkout locally
(no `.local/`, matching what a real fresh clone looks like) without waiting
~15-20 minutes for a real GitHub Actions round-trip. But any production code
that resolves paths via `workspaceResolution.root` (not its own
`process.cwd()`) kept silently resolving to the *real* workspace even while
running from `/tmp/fresh-checkout`, because `REPL_HOME` leaked through. This
made the simulation write a test's fixture content into the real workspace's
live `.local/episode-capture-status.md` (overwriting real operational state)
while the test's own assertions read from the *worktree's* `.local/` path —
a mismatch that looked like a second real bug but was purely a simulation
artifact.

**How to apply:** Any local simulation of a "fresh checkout" / "what will
GitHub Actions see" must run with `env -u REPL_HOME -u HOLAHOLA_WORKSPACE_ROOT`
(or `unset` both) in addition to using an empty/gitignore-clean directory.
Verify with `node -e "console.log(process.env.REPL_HOME, process.cwd())"`
before trusting the simulation's results. Skipping this can both mask a real
bug (something silently keeps working because it fell back to the real
workspace) and fabricate a fake one (writes land somewhere the test isn't
looking), and it can leave stale fixture content in real operational files
that a future reader (human or agent) would otherwise trust at face value.

