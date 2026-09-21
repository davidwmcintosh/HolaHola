`ss` is not installed in this Replit container's shell (`bash: ss: command not found`). If you check a listening port with `ss -ltnp 2>/dev/null`, the `2>/dev/null` swallows the "command not found" error and you see empty output indistinguishable from "nothing is listening" — a healthy, actively-serving process can look crashed.

Use `lsof -i :<port>` instead (confirmed available); it reports `LISTEN` and any `ESTABLISHED` connections directly. If you do try `ss` or `netstat`, run it with `2>&1` (not `2>/dev/null`) at least once so a missing binary surfaces as visible text instead of silent empty output.

This surfaced while verifying a workflow restart after a schema migration: two differently-named `Start_application_*.log` files (both starting with the same one-time boot preamble) briefly looked like a crash-and-retry, and an `ss` check with stderr suppressed then looked like confirmation. `lsof -i :5000` plus `ps aux` plus a `curl` 200 showed the single real process was healthy the whole time — the WorkflowsRestart tool's own success return already meant the platform had confirmed serving; the extra log archaeology was true but non-essential given that guarantee.

