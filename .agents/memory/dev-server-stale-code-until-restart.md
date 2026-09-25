## Live server keeps running pre-edit code until restarted

Editing a backend source file (a tool dispatcher, a route handler, a
validation rule) is visible immediately to any *fresh* process that imports
it from disk -- a `tsx` test run, a one-off CLI script, a typecheck. It is
NOT visible to the already-running long-lived dev server workflow (Express,
socket workers, LLM tool-execution loops, etc.) until that workflow is
restarted, because it already loaded the old module into memory at its own
boot time. Only the Vite frontend has hot-reload; backend/server code does
not.

**Why:** a live HTTP-mediated check -- calling an endpoint, or having an
LLM-driven agent actually invoke a tool -- silently exercises the OLD code
even though the file on disk, and any freshly-spawned test process reading
that same file, both reflect the edit. This produced a real false signal:
a newly-added required-field validation appeared unenforced when tested live,
purely because the serving workflow hadn't restarted yet, even though a
standalone test process had already proven the logic correct.

**How to apply:** after editing any code path the live server executes,
restart that workflow before trusting a live/HTTP/LLM-mediated check of the
new behavior. A fresh-process test (tsx/CLI) proves the code is correct; a
workflow restart is what makes the *running* server agree with it. Don't
interpret a live check that used pre-restart behavior as evidence the edit
is wrong.

