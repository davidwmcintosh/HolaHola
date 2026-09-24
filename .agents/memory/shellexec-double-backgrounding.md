Never append a manual trailing `&` to a command string passed to the shell-exec tool's own `run_in_background: true` option.

**Why:** `run_in_background: true` already runs the given command as the tracked background task and returns a task id immediately -- that IS the backgrounding mechanism. Adding your own `&` on top makes the *tracked* process just a launcher: it forks the real command into a second, untracked detached process and then exits right away (falling through to any trailing `echo`/etc.), so the tool immediately reports the tracked task as "exited with code 0" while the real work is still starting up. The child can then be silently orphaned/reaped along with the launcher's process group, so the intended long-running command may never actually complete -- confirmed by re-running the identical command without the manual `&` and seeing it behave correctly (log file populated, `ps aux` shows it alive) where the double-backgrounded version left no process and no log output at all.

**How to apply:** when a command needs to run in the background, pass the plain command (no trailing `&`) with `run_in_background: true` and read its state via `Monitor`/the background-task-end notification/its log file -- never combine the tool's backgrounding with shell-level `&`.


## Manual `nohup ... &` alone does not survive the call ending

A plain shell-exec call (no `run_in_background: true`) that itself runs `nohup some-long-command > log 2>&1 &` and then returns does NOT leave that command running -- the log file is never created and no process survives past the call.

**Why:** confirmed directly: `bash server/scripts/run-validation-suite.sh > /tmp/out.log 2>&1 &` issued inside a plain (non-backgrounded) call produced no log file and no live process once the call returned. Re-issuing the identical plain command (no `nohup`, no trailing `&`) through the tool's own `run_in_background: true` parameter worked correctly instead -- log populated, process alive, completion reported later.

**How to apply:** anything that must outlive the current call needs the tool's own `run_in_background: true` parameter on the plain command. Do not rely on shell-level `nohup`/`&`, alone or combined, to detach a process from a foreground call in this environment.

