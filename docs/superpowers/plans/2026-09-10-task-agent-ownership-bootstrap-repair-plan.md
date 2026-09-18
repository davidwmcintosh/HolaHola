# Task-Agent Ownership Bootstrap Repair Plan

1. Add a read-only diagnostic that records normalized Git/task-artifact facts,
   relevant environment-variable names, and SHA-256 digests of a strict
   allowlist of non-secret platform identifiers.
2. Add adversarial tests proving the diagnostic writes nothing, emits no
   environment values, never hashes secret-bearing variables, and preserves the
   ownership probe's fail-closed result.
3. Capture the main-Repl baseline.
4. Run the same diagnostic in a real isolated task-agent copy.
5. Record that no task-specific platform identity is exposed and adopt the
   founder-attested Ed25519 authority bridge approved on 2026-09-10.
6. Add dedicated challenge, assignment-receipt, proof-nonce, and immutable
   decision/proof-attempt tables with database-enforced transitions, expiry,
   uniqueness, revocation, idempotency, and append-only evidence.
7. Add challenge creation and polling endpoints that grant no authority and
   never accept or return private keys.
8. Add founder-session-only approval, rejection, and revocation endpoints plus
   a UI that displays the exact task, artifact, key fingerprint, and security
   boundary. Coordination and runtime credentials must be rejected.
9. Add `/tmp` Ed25519 key generation, canonical challenge-response signing, and
   ownership proof verification to the CLI.
10. Change `isolated_agent` classification to require an active founder-approved
    receipt plus fresh proof of key possession. Git shape remains corroboration.
11. Add adversarial service, route, CLI, database-trigger, replay, expiry,
    replacement, and authorization-boundary tests.
12. Prove the migration on a disposable Neon branch, obtain independent review,
    apply it to shared Neon, and run the complete project verification suite.
13. Relaunch the bounded Gemini runtime task and require ownership proof before
    its first edit and again before completion.
