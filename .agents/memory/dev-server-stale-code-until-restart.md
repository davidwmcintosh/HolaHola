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


## Assembled protected API readiness is separate from fixture UI proof

Verify the assembled application's protected API after a restart, not just its public landing page or fixture-intercepted UI. Injected test middleware and intercepted authentication can hide failures in the real middleware stack.

**Why:** The landing page, fixture browser check, route tests, and typecheck passed while the actual anonymous founder API hung. Its route was registered before Passport/session initialization; Express 4 did not forward the resulting rejected async middleware promise. This was deterministic request-time middleware ordering, not a startup race. Source: conversation_memories `119fb593-4dff-47d6-8115-ec9535ba13a7`.

**How to apply:** After changing protected route wiring, check a real anonymous request returns a prompt 401/403, and verify a permitted read separately when authorized. Keep an assembled-stack check alongside injected-middleware tests. A public health or landing response is not proof that protected routes work.
