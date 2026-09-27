## Coordinator V2 live-session verification gating

A live end-to-end Coordinator V2 host-lifecycle run depends on gates that a coding agent
cannot verify are satisfied just by reading the CLI source or its tests: the real transport
dependency factory is platform-gated (only usable from the actual required host OS, not a
Linux sandbox), and separately requires both an active approved policy and an unexpired
per-task operator grant. Any of these can be absent even when the CLI itself and its host
enrollment are otherwise healthy and fully tested with fakes.

**Why:** these are independent gates checked at different layers (process platform, policy
state, grant state), so "the code and its test suite are correct" and "a real live session can
succeed right now" are different claims. A coding agent working from a sandbox that cannot
satisfy the platform gate can fully verify the former and never the latter.

**How to apply:** before promising or attempting a "real live session" verification for any
Coordinator V2 host-lifecycle task, check the actual current state of the policy/grant/host-
enrollment records directly rather than assuming readiness from the CLI or its docs. If no
active grant or enrolled compatible host exists, that verification step is blocked on a human
founder/operator action, not on anything a coding agent can finish by itself — say so
explicitly rather than treating the sandbox's own fake-dependency test suite as an equivalent
substitute for a real run.

