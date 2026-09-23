## `.local/` does not exist on a fresh checkout — writers must create it first

`.local/` is gitignored. It does not exist on a GitHub Actions runner, a
fresh `git clone`, or a fresh `git worktree add` checkout — only in a working
tree that has already run the app or its writers at least once. Any code
that writes a file under `.local/<something>` without first creating the
parent directory crashes with `ENOENT: no such file or directory` the first
time it runs there, even though the exact same code has worked in every dev
shell for months (because dev shells accumulate a populated `.local/` from
ordinary use and never hit the missing-directory path).

**Why:** `_writeCaptureStatusFile()` in `server/services/agent-session-autosave.ts`
wrote to `.local/episode-capture-status.md` with a bare `writeFileSync`,
no `mkdirSync` first. It passed in every local run (this shell's `.local/`
already existed) and failed only on a real GitHub Actions run at the exact
command that first exercised that write path. Sibling writers
(`canonical-conversation-capture.ts`, `projection-receipts.ts`,
`episode-mirror-outbox.ts`) already called `mkdirSync(dirname(path), { recursive: true })`
before writing — this one writer had drifted from that pattern.

**How to apply:** Any new (or newly-CI-exercised) code path that writes under
`.local/` must call `mkdirSync(dirname(path), { recursive: true })` (or the
async equivalent) immediately before the write, regardless of how confident
you are that "some other process already created the directory." Don't trust
a green local run alone to prove this — local dev shells hide the bug by
already having the directory.

