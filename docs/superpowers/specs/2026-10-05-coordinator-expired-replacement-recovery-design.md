# Expired replacement host-credential recovery

Date: 2026-10-05
Status: founder-approved scoped design; local implementation prepared; no release or native-client approval.

## Approved scope

1. Explicit recovery accepts legacy two-field material and correctly formed expired three-field replacement material; malformed and still-valid credentials fail closed.
2. A read-only recovery-context endpoint authenticates with the existing enrolled host key, not an expired credential, and derives the next generation from server history.
3. Existing nonterminal local requests resume their exact signed bytes. A new signed request is persisted before submission.
4. Fresh submissions atomically reject stale generations under the enrollment lock; identical request replay is checked first.
5. Founder approval and enrolled-key challenge proof remain required before storing a replacement credential. No key replacement, runtime initialization, session, or execution is added.

## Protocol details and compatibility

POST /api/coordination/v2/host/recovery-context accepts the same exact four-field signed envelope as reauthorization, with a distinct host_credential_recovery_context declaration purpose. The exact declaration contains contextKey, issuedAt, expiresAt, protocolVersion, hostId, keyFingerprint, minimumGeneration, and kind. One captured timestamp bounds its lifetime to two minutes. Stored active enrollment, protocol, capabilities, fingerprint, and RSA proof are checked. The endpoint only reads records and returns contextKey, nextGeneration, issuedAt, and expiresAt with no-store caching.

The next generation is max(highest server generation + 1, signed local minimum). The minimum preserves already-retired never-accepted legacy generations; it cannot override newer server history. Generations fit PostgreSQL integer and Windows Int32. Pending/approved server requests block discovery without being changed. Submission rechecks monotonicity under the existing exclusive enrollment lock; gaps are allowed for legacy retirement. No reusable context receipt grants credential authority. HTTPS and correlation/freshness checks bind lookup replies; final signed submission independently enforces authority and generation.

A lost submission response keeps the exact DPAPI request. A conflicting response never silently replaces it. Credential and private-key files stay unchanged until the existing approved proof succeeds. Successful completion retains the existing cleanup contract; future recovery therefore consults server history rather than a missing local counter.

## Verification and honest limits

Focused static/contract/cryptographic checks: 21 passed. Typecheck passed. System health: All checks passed — safe to mark done. A separately created disposable local PostgreSQL cluster received the existing reviewed migrations, ran all three reauthorization PostgreSQL tests without skips, and was removed. The service proof includes two approved/completed cycles, next-generation 3 lookup, missing/revoked enrollment refusal, pending-request blocking, founder-only approval, old exact replay after newer history, stale generation refusal, and concurrent submissions.

The existing Windows regression entry point now covers expired replacement material, malformed/future expiry, signed context interoperability, invalid context refusal, lost-response exact retry, preservation before approval, and approved proof/store. It has NOT been executed on Windows PowerShell 5.1 in this preparation. No native-client or execution-policy success is claimed.

## Explicit exclusions and release stops

No publication, production host mutation, Windows command, policy/trust change, credential deletion, or host-key rotation is authorized by this local preparation. Windows diagnostic reporting and the Restricted/unsigned-helper launch problem remain separate. Changed source requires fresh exact-byte source and runtime publication through the shared GitHub-to-Render path, with founder-only stops before native rollout and reauthorization approval. Existing release receipts cannot authorize changed bytes.
