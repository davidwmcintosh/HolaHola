---
name: Windows console child-process lifetime
description: Why a Windows child process launched from a PowerShell console dies silently when that console window is closed or reused, and the correct fix.
---

Windows delivers `CTRL_CLOSE_EVENT` (same signal family as Ctrl+C/Ctrl+Break) to
every process attached to a console when that console's window is closed or its
tab is reused for something else. A console child process with no custom handler
installed terminates by default on receiving it — silently, no crash dump, no
stderr. This hit HolaHola's Gate 3 Windows executor: the launcher PowerShell
script started the real work as a child `node` process without detaching it, so
closing/reusing the terminal mid-run killed an in-progress run with no trace.

**Why:** `System.Diagnostics.ProcessStartInfo` with `UseShellExecute = $false`
(needed to control the child's environment/working directory) makes the child
inherit the launcher's console by default unless told otherwise.

**Fix:** set `$startInfo.CreateNoWindow = $true`. This gives the child its own
hidden console instead of sharing the launcher's, so the launcher's console
closing no longer reaches it. Root file: `scripts/antigravity-gate3.ps1`
(`New-ApprovedChild`, `Start-PlainChild`).

**Deliberate non-fix — do not add stdout/stderr redirection as a "belt and
braces" companion change.** Piping the child's stdout/stderr back through the
launcher's own managed pipe handles recreates the exact coupling `CreateNoWindow`
removes: a killed parent closes its pipe handles out from under the child. Keep
the child's own console detached and let the launcher report only fixed,
non-secret event names — never raw child output — if it needs to signal status.

**How to apply:** any future Windows launcher script in this repo that spawns a
long-running child via `ProcessStartInfo` needs `CreateNoWindow = $true` (or
equivalent full detachment) before it can be trusted to survive the launcher's
own terminal window closing or being reused for another task.
