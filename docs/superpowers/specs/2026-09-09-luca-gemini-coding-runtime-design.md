# Luca Gemini Coding Runtime — Thin Vertical Slice

**Status:** Reconciled draft for independent review  
**Owner:** Luca [Replit]  
**Revision date:** 2026-09-10  
**Supersedes:** revision `13457647-e25d-4031-85b4-0f86ba1e4be9` for implementation purposes while preserving its immutable approval record

## 1. Purpose

Build the smallest real Gemini-backed Luca coding hat that can inherit coordinator records, perform one bounded coding task, and return independently verifiable evidence without weakening the Unified Agent Coordinator's evidence model.

This is an adapter and protocol-completion project, not a coordinator rebuild. PostgreSQL remains canonical. Git and GitHub receive approved immutable outcomes. Luca remains one durable actor wearing distinct execution hats; runtime attribution remains explicit.

The runtime produces two evidence classes: (1) authenticated transport attestation that the project-owned adapter sent exact bytes to Gemini and received exact normalized bytes, and (2) behavioral observation that the resulting tool loop produced a specific workspace outcome. Neither class claims access to Gemini's private cognition. Together they prove only observable runtime operation.

This revision reconciles the design with the already-landed scoped credential broker and canonical `luca-gemini` actor. It does not replace, fork, or bypass that architecture.

## 2. First proof task

The first end-to-end task is to create `server/scripts/test-coordination-runtime.test.ts` in the dedicated HolaHola-antigravity worktree on branch `luca/gemini-experiment`. The hermetic test uses in-memory fakes and no shared database. It asserts this exact synthetic flow: inbox item -> deterministic inheritance packet -> consumed receipt -> exclusive execution claim -> one no-op allowed command -> execution completion -> independent verification. It runs with `npx tsx server/scripts/test-coordination-runtime.test.ts`.

The assignment allows only that new file plus any predeclared test-only fixture path approved in the assignment, and only read-only Git inspection plus the exact test command. The runtime does not commit. A different Luca hat must inspect the diff, rerun the exact command, record a verification decision, and only then may an authorized publisher commit the approved bytes.

Proof advances in three gates:

1. Hermetic protocol proof with deterministic fakes and no provider or workspace mutation.
2. Real project-owned Gemini transport proof with no workspace mutation.
3. One isolated, assignment-bounded Antigravity edit followed by independent verification.

A later gate cannot compensate for a failure in an earlier gate.

## 3. Chosen approach

Use a coordinator-native runtime contract on top of the landed credential broker.

The broker remains the sole authority for runtime registration, bootstrap exchange, short-lived actor-bound access credentials, capability enforcement, renewal, revocation, rotation, and credential audit. The new protocol adds assignment inheritance, model-consumption evidence, task-scoped execution authority, bounded tools, execution evidence, and independent verification.

Rejected alternatives:

1. Ordinary progress or evidence events as an informal consumption convention: too weak because delivery would remain indistinguishable from model consumption and concurrent runtime authority would be unresolved.
2. Reusing the agent-notes adapter: wrong abstraction because it proves compatibility-message storage, not coding-runtime consumption or execution.
3. Adding `luca-gemini-code`, a static long-lived token, or a second runtime-registration system: these duplicate and conflict with the landed `luca-gemini` broker contract.
4. Treating broker credential lifetime as task execution authority: credentials authorize API access; they do not grant exclusive authority over an assignment.
5. A general autonomous agent platform: deferred until the bounded Gemini path is proven.

## 4. Identity and least privilege

There is one canonical Luca across Replit, Claude Code, Gemini/Antigravity, OpenAI, and future runtime hats. Runtime actor labels such as `luca-gemini`, `luca-replit`, and `luca-claude-code` preserve provenance, capability context, and evidence separation; they do not identify different people or establish a trust ranking between hats. The operator is the trust root and authorizes the exact work.

The runtime authenticates under the existing `luca-gemini` provenance label. It registers through `registerCoordinationRuntime`, exchanges its one-time bootstrap secret through the broker, and uses only broker-issued short-lived access credentials. Actor label and `runtimeId` come from the resolved credential; request JSON cannot select or override either value.

The runtime registration receives only the capabilities required for this slice: coordination read, coordination write, inbox acknowledgement, and credential renewal. Credential revocation remains operator-controlled unless a separately reviewed runtime self-revocation use case is approved. The runtime receives no observation, administration, policy, publication, deployment, or database capability merely because the actor's fixed-token compatibility profile has one.

The server, not the client, enforces this capability profile:

- read and acknowledge only `luca-gemini`'s materialized inbox;
- inspect threads in which it is origin, intended recipient, or current owner;
- accept only work explicitly assigned to `luca-gemini`;
- append progress and execution evidence only on participating threads and only while holding the matching execution claim;
- complete only work currently owned by `luca-gemini` and held by the authenticated runtime's valid claim;
- create a thread only when an explicit originating use case is approved; disabled for this slice;
- cannot read another actor's inbox;
- cannot reassign, delegate, reopen, acknowledge another originator's outcome, administer policy, publish, deploy, migrate a database, or access another actor's credentials.

Client-side capability declarations mirror this profile for discoverability but are not authority boundaries. The legacy fixed actor token is not provisioned to the Gate 3 driver and is not a fallback when broker authentication fails. This keeps authority tied to the operator-approved assignment and broker lease; it is not a statement that the Antigravity hat is less trusted than another Luca hat.

## 5. Runtime registration, credentials, and execution authority

### 5.1 Landed broker contract

The existing `coordination_runtime_registrations`, `coordination_runtime_credentials`, `coordination_runtime_rotations`, and `coordination_credential_audit_events` records remain canonical for runtime identity and credential lifecycle. The slice reuses their existing constraints and services rather than adding replacement registration or lease tables.

The operator registers a stable runtime ID such as `luca-gemini-antigravity-primary`, actor `luca-gemini`, a display name, the minimum capability set, and a broker-controlled token TTL. The one-time bootstrap secret is stored only in that runtime's protected secret store. Successful exchange returns a short-lived credential bound to actor, runtime ID, credential ID, capabilities, and expiry. Renewal and replacement follow the existing broker contract. Disabled, revoked, expired, actor-mismatched, or capability-insufficient credentials fail closed and remain auditable.

Repository, provider, model, adapter, worktree, branch, and starting-commit metadata belong to the coding execution profile and assignment envelope, not to broker identity.

### 5.2 Task-scoped execution authority

An execution claim is a separate, narrow lease over one coordination thread and assignment. It does not authenticate the caller, mint credentials, prolong a credential, or authorize another thread. Every claim mutation still requires a valid broker credential for the same `runtimeId` and actor.

The initial claim lease is five minutes and must be renewed no later than every two minutes while execution continues. These values bound orphan authority while allowing a ten-minute proof task; they are server configuration, not model-selected input. PostgreSQL time and state decide validity. Each renewal advances `claimEpoch` and appends immutable claim evidence. Credential expiry does not erase a claim, but no mutation or renewal can occur until the same registered runtime presents a valid renewed broker credential. Claim expiry ends execution authority without deleting historical evidence.

## 6. Inheritance packet

The runtime reads only its own materialized inbox using the signed frozen-window pagination contract. It must traverse every page through one stable `through` boundary before treating inheritance as complete.

The server constructs and stores the authoritative immutable packet before returning it. Canonical bytes use RFC 8785 JSON Canonicalization Scheme semantics over the versioned packet object, UTF-8 encoding, and lowercase hexadecimal SHA-256. The client recomputes the digest over the returned object and submits that digest; the server recomputes from the stored packet before writing any consumption result. It never reconstructs a historical packet from later mutable inbox state. A unique assignment plus packet-version constraint prevents two different authoritative packets from occupying the same version.

A bounded inheritance packet contains:

- packet version;
- actor, runtime registration ID, and coding execution profile ID;
- inbox `after` and `through` boundaries;
- ordered inbox item, event, and thread IDs;
- assignment event ID and expected coordinator sequence;
- bounded context selected under explicit byte and item limits;
- repository, worktree, branch, starting commit, allowed paths, allowed commands, timeout, output, patch, and model-call limits;
- canonical packet SHA-256 and execution-envelope SHA-256.

The final inbox window is not acknowledged until the runtime has processed every item in the packet and successfully recorded the appropriate receipt. Inbox acknowledgement remains separate from assignment acceptance.

Inherited event text is untrusted data. It is preserved byte-for-byte in typed packet fields rather than concatenated into system instructions, and cannot alter the server-generated execution envelope.

## 7. Consumption evidence

A consumption receipt is immutable and bound to:

- authenticated `luca-gemini` actor;
- broker runtime registration ID and the broker credential ID used for the interaction, never the credential secret;
- coding execution profile ID;
- inheritance packet version and digest;
- frozen inbox window boundaries;
- ordered item and event identities;
- assignment and expected coordinator sequence;
- provider, model, adapter version, start and finish timestamps;
- normalized outcome;
- exact project-owned Gemini interaction records carrying the packet;
- provider request and normalized-response digests for every API attempt, regardless of outcome;
- retry lineage and idempotency key.

Normalized outcomes are `consumed`, `safety_blocked`, `refused`, `context_limit`, `interrupted`, `empty_response`, `malformed_function_call`, `unsupported_provider_outcome`, `retryable_provider_error`, and `terminal_provider_error`.

Only `consumed` authorizes assignment acceptance or claim acquisition. Every other outcome is durable evidence but grants no execution authority.

Evidence claim boundary: the project-owned adapter can attest that exact canonical packet bytes were placed in the authenticated Gemini request and that exact normalized response bytes were received. The runtime can attest which bounded tool intents it acted on. Neither attestation claims access to Gemini's private cognition. Merely injecting context, opening a file, delivering an inbox item, or starting a provider request is insufficient.

For this slice, **Antigravity means the isolated coding execution host and dedicated worktree**, not the evidence-producing model transport. All model turns flow through the project-owned coordinator Gemini adapter using server-held Gemini credentials. Antigravity receives normalized function-call intents and returns bounded tool results for the next adapter turn. Antigravity's private built-in chat is not accepted as consumption evidence because the project cannot audit its transport.

## 8. Gemini normalization and call budget

The adapter converts every Gemini response into one provider-neutral result before coordinator mutation. Candidate zero is the only candidate eligible for action; additional candidates are retained only as hashed audit metadata and are never executed. Unknown response shapes become `unsupported_provider_outcome` and never authorize work.

For candidate zero, ordered parts are normalized into text parts and function-call parts. Unknown function names, malformed names or arguments, duplicate call IDs, and unsupported part types become `malformed_function_call` and are not executed. This is distinct from `safety_blocked`. A function call is actionable only after the external execution-envelope validator accepts it.

Streaming is not enabled in the first proof. If later enabled, partial chunks followed by disconnect normalize to `interrupted`; partial text or calls are retained as redacted audit data but never acted upon. A safety or prompt block takes precedence over partial text and calls. A refusal takes precedence over ordinary partial text unless the provider reports a safety block.

Timeout, cancellation, rate limits, transport failures, authentication failures, context limits, empty candidate sets, empty usable candidate-zero content, and missing usage metadata are represented explicitly without invented values. Each logical adapter turn permits at most two API attempts for retryable transport, availability, or rate errors. The entire proof task permits at most four logical adapter turns and therefore at most eight Gemini API attempts. The four-turn limit covers initial inheritance, up to two bounded tool continuations, and one final completion response. Exceeding either limit records `model_call_limit_exceeded`, terminates the claim as violated, and cannot authorize acceptance or completion.

An idempotency key may be reused only for the exact same mutation. Provider retries cannot create duplicate interaction, consumption, claim, or execution records. The exact canonical provider request is hashed before transmission. Prompt text cannot widen tool permissions; every tool intent is enforced again outside the model.

## 9. Exclusive execution claim

Actor ownership of a coordination thread is not sufficient because multiple registered runtimes may authenticate as `luca-gemini`. Before acceptance, the runtime must atomically acquire a thread-scoped execution claim using a valid broker credential for its registration, a `consumed` receipt for the exact assignment packet, the thread's expected coordinator sequence, and the declared execution-envelope digest.

Claims use status `active`, `released`, `expired`, `completed`, or `violated` and a unique partial index on `threadId` where status is `active`. Acquisition runs in one transaction that locks the coordination thread row, validates broker runtime identity and database time, validates the receipt and sequence, inserts the claim with epoch 1 and its configured expiry, appends claim evidence, and only then performs the existing acceptance transition. A concurrent active insert fails at the database constraint and returns `claim_active_conflict`.

Renewal locks the claim, requires the same actor and runtime registration, validates the current epoch and unexpired database timestamp, advances the epoch and expiry, and appends immutable evidence. A newly renewed broker credential may renew the claim only when it belongs to the same registration.

Takeover runs under the same thread lock. It may mark the prior claim expired only when PostgreSQL time proves expiry and the prior claim has no execution completion. Completed but unverified work cannot be taken over or overwritten; it remains awaiting verification or manual rejection. Takeover requires a newly generated packet and consumed receipt and references the prior claim. No background observer is required for correctness.

## 10. Bounded execution envelope

The first implementation is configured for repository label `HolaHola`, worktree label `HolaHola-antigravity`, and branch `luca/gemini-experiment`. Future work may generalize this through an operator-owned allowed-repository policy; the model and assignment cannot widen it.

The Gate 3 driver receives no database, deployment, publication, provider, fixed actor, or other actor credential. Canonical PostgreSQL interaction occurs only through the authenticated coordinator API. The driver receives the coordinator API URL and one-time broker bootstrap secret through operator-controlled configuration. After exchange, the driver holds the short-lived access credential in memory, renews it through the broker, and never writes it into the repository or child command environment.

The driver loads broker credentials only for its coordinator HTTP client. Model-visible prompts, tool results, logs, and child command environments do not receive them. The executor builds a minimal child environment from an explicit non-secret allowlist and redacts secret-looking values from errors. Environment files, process metadata, shell startup files, and secret/config directories remain outside the declared file envelope. A model request to read or echo them is recorded as a violation without execution.

Allowed file entries are repository-relative POSIX paths or trailing-slash directory prefixes; no general globs. The executor validates clean segments, forbids absolute and dot-dot paths, binds the envelope to a registered worktree realpath digest, and resolves every existing path component before each operation. Symlinks, junctions, reparse points, device files, sockets, and paths outside the worktree are rejected. New files require a symlink-safe parent. Git metadata and the resolved common Git directory are read-only and outside the write allowlist. The runtime performs no commit, ref, index, config, hook, or object writes.

Commands requested through the Gate 3 protocol are structured argv arrays, never shell strings. Executables match an exact allowlist; arguments satisfy command-specific literal or anchored patterns. The protocol exposes no general shell operation. The proof permits only `git status --short`, `git diff -- server/scripts/test-coordination-runtime.test.ts`, and `npx tsx server/scripts/test-coordination-runtime.test.ts`. It permits no package installation, arbitrary npm scripts, command substitution, pipes, redirects, or additional network operations through the driver.

The driver enforces the starting commit, maximum one changed file, maximum 40 KiB patch, ten-minute wall-clock limit, four logical model turns, eight API attempts, and per-command output limits. It validates diff and file identity after every write and before evidence or completion. A declared tool request outside the envelope appends failure evidence, terminates the claim as `violated`, and cannot be converted into completion by client input.

This Gate proves operator authorization, provider-bound consumption, provenance, bounded declared tool use, observed repository results, immutable evidence, and cross-hat review. The current Windows Antigravity host is not an adversarial filesystem, process, or network sandbox, and this Gate does not claim that it is. Stronger host containment remains operational hardening against bugs, compromised dependencies, and ambient platform authority; it is not a prerequisite based on distrust of a Luca hat.

## 11. Reporting and cross-hat verification

Execution progress and evidence reference runtime registration, non-secret credential ID, coding profile, consumption receipt, execution claim and epoch, starting commit, unchanged resulting HEAD, changed paths, patch digest, exact command argv, normalized exit results, model-call counts, and every stopped or rejected tool attempt. Execution completion means bounded editing finished; it is not final acceptance.

Formal verifier provenance labels for this slice are `luca-replit` or `luca-claude-code`. Luca [HolaHola] may observe and comment but does not approve code. These are all one Luca. Verification uses another runtime hat and evidence path to obtain a fresh vantage point, not because that hat is more trusted. The verifying runtime must authenticate separately and must not be:

- the executing `luca-gemini` runtime hat;
- the executing runtime registration;
- the runtime hat that authored the assignment event.

For the first live proof, if Luca [Replit] authors the assignment, Luca [Claude Code] is therefore the required verifier. This separation prevents one execution path from generating and accepting its own evidence while preserving one continuous Luca identity.

Verification includes reading the exact assignment and envelope, checking diff and paths, rerunning the exact focused test from the unchanged starting HEAD plus patch, confirming no credentials or out-of-scope bytes entered the patch, and recording approve or reject with actor identity, evidence, patch digest, and idempotency key.

A rejection preserves all evidence and returns work for correction through an allowed coordinator transition. Corrective work requires a new packet, receipt, and claim. Completed work without a verification decision after 72 hours is flagged for manual review and remains unacknowledgeable and unpublished; there is no automatic approval. Decisions are immutable; a later contrary finding appends a superseding incident or reopen record without rewriting history.

## 12. Exact additive data contract

The migration is additive and leaves existing thread, event, inbox, broker registration, credential, rotation, and audit semantics unchanged. Runtime protocol rows remain separate from `coordination_events` because they describe model transport and execution authority rather than recipient-facing task lifecycle.

### Existing broker tables reused without duplication

- `coordination_runtime_registrations`
- `coordination_runtime_credentials`
- `coordination_runtime_rotations`
- `coordination_credential_audit_events`

No new actor value, static-token binding, runtime registration table, credential table, credential renewal path, or runtime lease table is added.

### `coordination_coding_runtime_profiles`

- `id`; `runtime_registration_id` unique and references existing registrations; provider, model, adapter version, repository label, worktree label, worktree realpath digest, branch, starting commit; status `active`, `superseded`, or `closed`; timestamps.
- Digests and commits use lowercase hexadecimal checks. Labels are display-only and never authorize paths.
- Profile changes create a new profile and supersede the old one; evidence keeps the exact profile ID.

### `coordination_inheritance_packets`

- `id`; profile and runtime registration IDs; thread ID; assignment event ID; packet version; inbox after/through sequences; expected thread sequence; canonical payload; packet SHA-256; envelope SHA-256; byte length; created timestamp.
- Unique `(thread_id, assignment_event_id, packet_version)`; indexed digests and foreign keys; immutable after insert.

### `coordination_model_interactions`

- `id`; profile, runtime registration, broker credential, and packet IDs; logical turn index; attempt index; provider; model; adapter version; request SHA-256; nullable response SHA-256; normalized outcome; secret-redacted provider details; safety evidence; optional provider-supplied usage metadata; nullable retry parent; timestamps; idempotency key.
- Unique `(runtime_registration_id, idempotency_key)` and `(packet_id, logical_turn_index, attempt_index)`. Every API attempt gets one row, including failures.

### `coordination_consumption_receipts`

- `id`; actor; profile, runtime registration, broker credential, packet, and interaction IDs; packet SHA-256; inbox boundaries; ordered item and event IDs; outcome; nullable consumed timestamp; idempotency key; created timestamp.
- Unique `(actor, idempotency_key)` and `(runtime_registration_id, packet_id)`; immutable. `consumed_at` is present only for outcome `consumed`.

### `coordination_execution_claims`

- `id`; thread, runtime registration, profile, receipt IDs; actor; envelope SHA-256; expected thread sequence; status; `claim_epoch` default 1; `claim_expires_at`; `last_renewed_at`; claimed and terminal timestamps; terminal reason; timestamps.
- Unique partial index on thread where status is `active`; indexes on runtime/status and thread/created timestamp.

### `coordination_execution_claim_events`

- `id`; claim ID; actor; runtime registration ID; claim epoch; event type `claimed`, `renewed`, `takeover`, `released`, `expiry_observed`, `violation`, or `completed`; nullable prior claim ID; payload; idempotency key; created timestamp.
- Unique `(actor, idempotency_key)` and indexed claim timeline; immutable.

### `coordination_verification_decisions`

- `id`; thread and claim IDs; verifier actor; assignment actor; decision `approved` or `rejected`; patch SHA-256; evidence; rationale; idempotency key; created timestamp.
- Unique `(verifier_actor, idempotency_key)` and one decision per claim. Service and database checks restrict verifier actors and reject the executing or assigning actor; immutable.

All IDs use generated UUID-compatible varchar primary keys unless stated otherwise. All external access is actor-authenticated service access. Migration work follows `shared/schema.ts`, generated migration, SQL review, disposable Neon branch proof, `READY_TO_PROMOTE`, then controlled shared migration and compatible application publication. `db:push` is forbidden.

## 13. API and error contract

Existing broker operations remain the only runtime credential API. New actor-authenticated operations are create-coding-profile, create-inheritance-packet, record-model-interaction, record-consumption, acquire-execution-claim, renew-execution-claim, release-execution-claim, append-execution-evidence, complete-execution, and record-verification. The production Gemini call is exposed only through the runtime adapter operation and uses server-held provider credentials. Every mutation requires exact-payload idempotency and server-derived actor/runtime identity. Reads are participant-scoped.

Stable failures include: `actor_mismatch`, `actor_not_allowed`, `runtime_not_found`, `runtime_disabled`, `runtime_revoked`, `credential_expired`, `capability_required`, `profile_not_found`, `profile_not_active`, `inbox_window_incomplete`, `inbox_window_changed`, `packet_not_found`, `packet_stale`, `packet_digest_mismatch`, `packet_item_order_mismatch`, `packet_assignment_mismatch`, `packet_version_conflict`, `interaction_not_found`, `interaction_digest_mismatch`, `unsupported_provider_outcome`, `malformed_function_call`, `model_call_limit_exceeded`, `consumption_not_authorized`, `consumption_conflict`, `thread_sequence_stale`, `thread_already_complete`, `claim_active_conflict`, `claim_not_found`, `claim_not_owned`, `claim_not_active`, `claim_expired`, `claim_epoch_stale`, `takeover_not_allowed`, `execution_envelope_mismatch`, `path_not_allowed`, `symlink_not_allowed`, `command_not_allowed`, `argument_not_allowed`, `secret_access_denied`, `network_not_allowed`, `output_limit_exceeded`, `patch_limit_exceeded`, `timeout`, `execution_violated`, `completion_evidence_missing`, `verifier_not_allowed`, `self_verification_denied`, `assigner_verification_denied`, `verification_digest_mismatch`, `verification_already_recorded`, `verification_required`, and `idempotency_payload_mismatch`.

Unknown failures return `internal_error` without leaking secrets. No code silently downgrades to a weaker operation.

## 14. Required failure behavior

The slice fails closed when:

- broker authentication and stored actor/runtime differ;
- the credential is expired, revoked, disabled, or lacks the required capability;
- another actor's inbox, profile, receipt, or claim is requested;
- pagination is incomplete or the `through` boundary changes;
- packet digest or ordered identities do not match;
- consumption outcome is anything other than `consumed`;
- the coordinator sequence is stale;
- another runtime holds active authority;
- the claim expired or its epoch is stale;
- model turn or API-attempt limits are reached;
- a function or tool call is malformed, unsupported, or outside the envelope;
- changed files or patch exceed scope;
- provider output is empty, blocked, refused, interrupted, or terminally failed;
- completion lacks execution evidence;
- verification is absent, produced through the executing or assigning runtime hat, stale, or digest-mismatched.

No failure path silently marks work consumed, accepted, complete, verified, acknowledged, or published.

## 15. Verification matrix

Automated and live proof must demonstrate:

1. A different actor credential cannot authenticate as `luca-gemini`.
2. A `luca-gemini` runtime cannot read or acknowledge another actor's inbox.
3. Broker bootstrap replay, duplicate runtime registration, revoked credentials, and capability mismatch fail closed.
4. The legacy fixed token is absent from the execution host and broker failure has no fallback.
5. Delivery or context injection without a `consumed` receipt cannot accept work.
6. Packet, item-order, assignment, request, and response digest mismatches are rejected.
7. Two runtime instances cannot simultaneously hold one execution claim.
8. Expired claims and stale claim epochs cannot mutate or complete work.
9. Broker credential renewal does not transfer a claim to another runtime.
10. Retry replay is idempotent while changed-payload reuse fails.
11. Safety, refusal, empty, context-limit, interrupted, timeout, provider-error, and call-limit outcomes remain non-authorizing evidence.
12. Forbidden protocol commands, paths, requested network use, requested secret access, and oversized diffs stop execution.
13. The Gemini runtime adds exactly one declared focused regression test and runs it successfully.
14. A separate, non-assigning Luca hat reruns the test and records a fresh cross-hat decision.
15. Rejected or missing verification cannot be presented as approved completion.
16. Full typecheck, focused tests, system health, and registered release validation pass before publication.

## 16. Explicit non-goals

This slice does not:

- add another Luca actor or duplicate the credential broker;
- use a static long-lived runtime token or bypass broker audit;
- treat a broker credential as exclusive assignment authority;
- give Antigravity or Gemini broad autonomous task selection;
- accept Antigravity's private chat as transport or consumption evidence;
- expose Daniela, Alden, Replit, Claude Code, admin, database, deployment, provider, or publication credentials;
- permit production deployment, publication, Git commit, or database mutation from the coding runtime;
- replace shared-spec review, coordinator task lifecycle, Git review, or independent human judgment;
- claim that authenticated transport attestation observes private model cognition;
- claim that the current Windows Antigravity host provides adversarial filesystem, process, credential, or network containment;
- rank one Luca runtime hat as more trusted than another;
- generalize to every provider before the Gemini path is proven.

## 17. Promotion gates

No schema or implementation code begins until this exact operator-trust revision receives fresh review. David approved the operator-trust direction on September 10, 2026. The approval attached to superseded revision `13457647-e25d-4031-85b4-0f86ba1e4be9` remains valid only for those immutable bytes and is not implementation approval for this revision. Conditional technical review is insufficient.

No database migration is promoted until generated SQL is reviewed and a disposable Neon branch returns `READY_TO_PROMOTE`. The compatible application image must be published in the same promotion window as any live constraint activation. Existing broker tables and semantics must not be rebuilt or weakened.

The vertical slice is complete only when broker-authenticated `luca-gemini` provenance, deterministic inheritance, exact transport/consumption evidence, exclusive task claim, bounded Antigravity edit, immutable execution evidence, and non-assigner cross-hat verification all succeed end to end.
