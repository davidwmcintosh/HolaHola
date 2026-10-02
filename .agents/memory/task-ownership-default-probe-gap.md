---
name: Task-ownership default probe always resolves unknown_stop
description: TaskOwnershipService's default verifyActiveMainReceipt/verifyActiveIsolatedProof both stub to false, so any caller using the default probe always gets unknown_stop, even a legitimate main-session caller.
---

`TaskOwnershipService`'s constructor defaults `verifyActiveMainReceipt` and
`verifyActiveIsolatedProof` to `async () => false` (no receipt-verification
backend is wired up yet). `classifyTaskOwnership` can only return
`main_session` or `isolated_agent` when one of those resolves `true`, so with
the default probe, `probe()` always returns `unknown_stop` — for every
caller, not just an actually-blocked task.

**Why:** every new `assertOwnershipForInfraMutation` call site added for task
#1470 inherits this: gating a call site with the real default probe makes it
fail closed unconditionally in production until real receipt verification is
wired up. That's the correct fail-closed behavior for a genuinely new gate
with no existing legitimate caller to regress. It becomes a real problem the
moment a call site *does* have an existing legitimate automated caller with
no task-ref concept (e.g. `source-control-cli.ts`'s `sync`, invoked by the
Alden Build Guardian from the primary worktree on every build pass) —
requiring a `--task-ref`/proof unconditionally there would permanently break
that caller, not just refuse an actually-blocked task. That site works around
it with a `readCheckoutKind()` conditional (primary-worktree callers bypass
the gate; only non-primary checkouts must supply a proven task ref).

**How to apply:** before wiring `assertOwnershipForInfraMutation` into a call
site, check whether it has an existing legitimate caller with no task-ref
concept. If yes, don't require an unconditional task-ref — find an equivalent
weaker-but-real signal (like checkout kind) to exempt that caller, the way
`source-control-cli.ts` does, and note the exemption's threat-model limits
in a comment. If no legitimate caller exists yet (a brand-new gate), the
default probe's unconditional `unknown_stop` is the right, safe behavior —
don't add a bypass "just in case." Once real receipt verification
(`verifyActiveMainReceipt`/`verifyActiveIsolatedProof`) is implemented, this
whole class of workaround should be revisited and checkout-kind heuristics
replaced with real proof.
