# Antigravity Windows Detached Run Hardening

## Scope

Harden `scripts/antigravity-gate3.ps1`'s `run` (and `prepare`) child launch so
an in-progress Gate 3 execution survives the interactive terminal/console that
started it being closed or reused. Do not change coordinator authority, the
approved worktree, the fixed command allowlist, the DPAPI credential
lifecycle, either hash-pinned bundle, or task #1448's bounded execution rules.

## Observed failure

Three independent Gate 3 attempts on 2026-09-12 each completed exactly two
clean coordinator-verified turns, then stopped producing any evidence at all:
no further claim renewal (which runs on its own ~90-second timer inside the
Node runtime, independent of the model-turn loop), no violation, no
completion, no error.

Cross-agent forensic investigation (recorded on coordination thread
`d0fe2092-50e2-4fae-a1b2-ef25dc0b6e56`) ruled out, with direct evidence, every
candidate that would leave a trace:

- no DPAPI call exists anywhere in this runtime's credential-renewal or
  bootstrap path (confirmed by reading the executor and broker code directly);
- no `Kernel-Power`/`Power-Troubleshooter` sleep, hibernate, or
  unexpected-shutdown events in the Windows System log at any of the three
  stall timestamps (checked +/- 5 minutes on the real host);
- no `Microsoft-Windows-NetworkProfile/Operational` disconnect events in the
  same windows.

That leaves the one candidate that produces no system-level log at all: the
terminal window hosting the launcher was closed or reused while a run was in
progress. The operator confirmed heavy concurrent terminal use (PowerShell,
bash, and a browser console simultaneously) on the failure date, making this
the well-supported explanation rather than a stretch.

The mechanism is directly visible in the launcher. `New-ApprovedChild` built
the child `ProcessStartInfo` with `CreateNoWindow = $false` and no other
console-detachment flag; `Start-ApprovedChild` starts it with
`UseShellExecute = $false` and blocks on `.WaitForExit()`. With no explicit
detachment, the Node child inherits the parent PowerShell process's console.
Windows delivers `CTRL_CLOSE_EVENT` to every process attached to a console
when that console's window is closed; a console process with no custom
handler terminates by default on receiving it. The child is killed at the OS
level before it can write any error, submit any evidence, or let its own
renewal timer fire again -- exactly matching "two clean turns, then total
silence, no trace."

## Selected design

Give the Gate 3 child process its own console instead of inheriting the
launcher's, so closing or reusing the launcher's window can no longer deliver
a close signal to it:

1. In `New-ApprovedChild`, set `$startInfo.CreateNoWindow = $true` (keeping
   `UseShellExecute = $false`). This is the standard .NET/Windows mechanism
   for a console child that does not share its parent's console: the child
   receives its own hidden, windowless console object, so `CTRL_CLOSE_EVENT`,
   Ctrl+C, and Ctrl+Break delivered to the launcher's console are not
   delivered to the child.
2. Do not redirect the child's stdout/stderr back through the launcher.
   Piping them through the parent's managed pipes would recreate the same
   coupling this change removes: if the parent is killed, Windows closes the
   parent's pipe handles, and the child's next write to the now-broken pipe
   can fail. The launcher already reports only fixed, non-secret event names
   (for example `child_exit_<code>`) rather than raw child output, so this
   preserves existing behavior; the durable record of what happened is the
   coordinator's PostgreSQL ledger, not the terminal.
3. `Start-ApprovedChild` keeps calling `.WaitForExit()` unchanged. If the
   launcher's own console is closed while waiting, the launcher process
   itself is still terminated by Windows -- nothing can prevent that for a
   window an operator explicitly closes -- but the now-detached child is
   unaffected and keeps running, keeps renewing its claim, and keeps working
   toward a real completion or a real, evidenced failure through the
   coordinator API.

This is a small, localized behavioral change (`CreateNoWindow` from `$false`
to `$true`) applied everywhere the launcher starts a real child process:
`New-ApprovedChild` (used by both `prepare` and `run`) and `Start-PlainChild`
(used only by `initialize`'s one-time bundle build). The `initialize` build
was not implicated in the observed failure -- it is a short synchronous step
that runs before any bootstrap or coordination state exists, so interrupting
it costs at most a retry, not an abandoned claim -- but it shares the exact
same attached-console mechanism, so it gets the same fix for consistency
rather than leaving one child detached and one not. It does not touch
`coordination-runtime-antigravity.ts`, the fixed command allowlist, the
approved worktree/node-path checks, or either hash-pinned bundle.

## Explicit non-goals

- Does not change how the launcher itself is invoked. It remains an
  interactive, attended command; this does not migrate it to Task Scheduler
  or a Windows service.
- Does not change the DPAPI credential lifecycle, the in-flight-store
  recovery model, or any rotation rule. A launcher process killed mid-run (by
  this or any other cause, e.g. an explicit Ctrl+C on the launcher itself
  today) still leaves a stale in-flight credential file requiring the
  existing documented manual recovery. That trade-off already exists for any
  interruption of the parent process and is unchanged by this fix.
- Does not add stdout/stderr relay, a log file, or any new reporting channel.
- Does not change the fixed action set, the approved worktree, the approved
  Node executable check, or either bundle's pinned hash.
- Does not claim protection against an operator explicitly killing the
  child's own process (e.g. via Task Manager) or a full host shutdown/reboot
  -- only against the specific observed mechanism (console-close signal
  propagation from a shared console).

## Security boundary

`CreateNoWindow` only controls console association at process-creation time;
it does not change `FileName`, `Arguments`, `WorkingDirectory`, or the
environment-variable allowlist already enforced by `New-ApprovedChild`,
`Add-AllowedParentEnvironment`, and `Add-RequiredRunEnvironment`. The child
still runs the same approved, hash-pinned bundle under the same approved Node
executable in the same approved worktree, receives the same reduced
environment, and the bootstrap is still injected only into that child's
environment and removed/cleared in `finally` exactly as before. No new
command surface, credential, or trust boundary is introduced.

## Regression proof

Add static source assertions to `server/scripts/test-antigravity-windows-dpapi.test.ts`
proving:

1. `New-ApprovedChild` sets `CreateNoWindow = $true` (positive assertion, so a
   revert back to `$false` fails the check).
2. `UseShellExecute` remains `$false` for the approved child (detachment must
   not go through shell execution, which would reopen the door to shell
   metacharacter/quoting risk).
3. The launcher does not set `RedirectStandardOutput`/`RedirectStandardError`
   to `$true` anywhere (keeps the "no pipe-through-parent" property explicit
   and testable, guarding against reintroducing the coupling this change
   removes).
4. The existing fixed-action, approved-worktree, approved-node, and
   forbidden-environment-variable assertions in the same file continue to
   pass unmodified, proving detachment did not loosen the command or
   credential boundary.

These are Linux-runnable static checks (no Windows execution required), and
the file is already registered in `scripts/run-ci-test-steps.mjs`, so no new
CI wiring is needed.

## Deployment

Because this change touches only `scripts/antigravity-gate3.ps1` and neither
of the two hash-pinned bundled entrypoints
(`server/scripts/antigravity-provisioning-bundle-entry.ts`,
`server/scripts/antigravity-runtime-bundle-entry.ts`), no bundle
regeneration, hash re-pin, fresh bootstrap, or Phase A/B re-registration is
required. The existing approved DPAPI bootstrap and public-bundle
registration remain valid. Rollout is: commit and sync the approved Windows
worktree to the new approved commit, confirm the worktree is clean, and run
`status` to confirm the local credential store is unaffected before the next
`run`.

## Real-Windows proof still required

Everything above is designed and statically verified from a non-Windows
environment. It does not by itself prove that `CreateNoWindow = $true`
detaches the child on the approved Windows host, or that a closed launcher
window no longer kills an in-progress run there. That proof requires an
actual Windows attempt: start `run`, close or reuse the hosting terminal
window while the child is mid-turn, and confirm the coordinator ledger shows
continued claim renewal and eventual completion or evidenced failure rather
than silence.
