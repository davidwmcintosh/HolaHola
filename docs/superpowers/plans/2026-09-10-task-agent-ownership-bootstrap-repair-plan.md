# Task-Agent Ownership Bootstrap Repair Plan

1. Add a read-only diagnostic that records normalized Git/task-artifact facts,
   relevant environment-variable names, and SHA-256 digests of a strict
   allowlist of non-secret platform identifiers.
2. Add adversarial tests proving the diagnostic writes nothing, emits no
   environment values, never hashes secret-bearing variables, and preserves the
   ownership probe's fail-closed result.
3. Capture the main-Repl baseline.
4. Run the same diagnostic in a real isolated task-agent copy.
5. Compare the two reports and decide whether a platform identity can safely
   bind an authenticated assignment receipt.
6. Implement receipt storage and verification only if step 5 proves a suitable
   unforgeable signal. Otherwise stop and document the platform evidence gap.
