# Standalone ownership proof and runtime execution grants

## Approved scope

Repair the standalone ownership CLI without relaxing runtime execution-grant
requirements. The founder approved this separation in the current conversation;
Alden's consult-only architectural review confirmed the server already makes
the same distinction.

## Contract

The server can return a successful, founder-approved receipt/key proof to fixed
coordination credentials without issuing a Gate3 execution grant. The standalone
CLI needs that ownership proof, not runtime execution authority.

A separate standalone client verifies the local task artifact digest, expected
task, actor, receipt, public key/fingerprint, nonce binding and expiry, successful
verification, and the digest of the exact signed payload. It returns only proof
fields, stripping any execution-grant fields.

The existing runtime helper keeps its proof-plus-grant contract. Antigravity
keeps its strict parser, grant expiry checks, and execution-envelope bindings.
Server authentication, receipt approval, nonce consumption, grant issuance, and
default fail-closed ownership probes are unchanged.

## Verification and exclusions

Hermetic tests run the actual CLI against a loopback fixture using genuine
Ed25519 signatures, synthetic task artifacts, dummy credentials, and isolated
temporary key storage. They cover accepted proof-only ownership, denied,
expired, replayed, and mismatched proof; bare task artifacts remain unauthorized.
Runtime proof-only rejection and complete-grant acceptance are checked
separately. Tests run in both the named validation suite and CI.

No production receipt is consumed in testing. No Episode 34 content, database
schema, runtime grant policy, task assignment, or publication is changed.