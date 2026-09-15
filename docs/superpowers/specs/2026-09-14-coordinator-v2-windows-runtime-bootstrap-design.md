# Coordinator V2 Windows Runtime Bootstrap

**Date:** 2026-09-14
**Status:** Proposed design; implementation requires David review
**Scope:** Install and acknowledge the approved Windows Node/tsx runtime after
host enrollment and before any Coordinator V2 task or session authority exists.

## Problem

The first real Windows host is enrolled and has one CurrentUser
DPAPI-protected host credential. It cannot run `Invoke-HolaCoordinator` because
the execution preflight requires an approved `node.exe` and tsx runtime before
the TypeScript host can start.

The existing preparation protocol cannot bootstrap those files:

- it is implemented in TypeScript and already requires Node and tsx;
- its artifacts are task/config material, not runtime files;
- its acknowledgement transaction creates a ready session;
- its recovery contract requires one complete exact task-preparation
  generation.

The runtime bootstrap must therefore be a separate protocol. It must not reuse
or weaken task preparation, promotion, acknowledgement, session, attempt,
lease, provider, budget, or execution authority.

## Goals

1. Reuse the already enrolled host identity and DPAPI-protected credential.
2. Deliver one exact, source-bound Windows Node/tsx runtime release.
3. Verify all executable bytes before any downloaded JavaScript executes.
4. Persist immutable server evidence and DPAPI-protected local retry evidence.
5. Make runtime acknowledgement structurally incapable of creating a task,
   session, attempt, lease, or operation.
6. Leave the existing TypeScript task lifecycle unchanged after bootstrap.
7. Repair the PowerShell 5.1 strict-mode pending-poll failure without weakening
   challenge validation.

## Non-goals

- No npm install on Windows.
- No PATH-based runtime approval.
- No return of the consumed initial-host bootstrap secret.
- No reuse of legacy runtime, actor, Gate 3, or broker credentials.
- No modification of migration `0049`.
- No task reservation, task material, policy grant, provider credential,
  session, attempt, lease, operation, or cleanup behavior in this protocol.
- No execution of a downloaded script before the runtime manifest is verified.

## Authority order

The exact order is:

1. Require an active enrolled host and valid host credential.
2. Require an immutable published Coordinator V2 source-promotion record.
3. Require an immutable published runtime release bound to that exact source
   commit, tree, publication receipt, and protected validation.
4. Issue a short-lived host-bound manifest signed by the existing Coordinator
   V2 Ed25519 server key.
5. Download exact digest-addressed runtime artifacts into a private staging
   directory.
6. Verify Windows Authenticode and the manifest hash for every PE binary.
7. Execute only the verified `node.exe`, using fixed verifier source embedded
   in the exact published launcher.
8. With Node built-in cryptography, verify the pinned Ed25519 key, manifest
   signature, canonical bytes, host/release/source bindings, expiry, maximum
   age, and every staged artifact hash.
9. Atomically install the runtime generation and re-verify path, ACL, reparse,
   length, and digest evidence.
10. Submit an RSA-signed host acknowledgement bound to the exact issue,
    release, manifest, and local evidence.
11. Persist immutable acknowledgement evidence.
12. Exit without creating or exercising task/session authority.
13. On a later explicit `Invoke-HolaCoordinator`, require the acknowledged
    unrevoked runtime and then run the unchanged task preparation, promotion,
    acknowledgement, session, lease, and execution lifecycle.

## Trust anchors

### Source

Every release references one immutable row in
`coordination_v2_source_promotions`. The release repeats and binds:

- repository identity;
- promoted commit SHA;
- exact tree SHA;
- publication reference;
- protected validation ID;
- source-promotion canonical record digest.

The Windows checkout must be clean and detached at that exact commit. The local
tree must equal the release tree before bootstrap or execution.

### Server manifest

The existing `COORDINATION_V2_SERVER_SIGNING_PRIVATE_KEY` signs canonical
runtime manifests with Ed25519. The corresponding public PEM and fingerprint
remain pinned in the published repository.

PowerShell 5.1 does not implement Ed25519 verification. It must not emulate it
with an unreviewed cryptographic implementation. Instead:

1. PowerShell verifies `node.exe` through Windows Authenticode and its manifest
   SHA-256.
2. PowerShell invokes only that verified `node.exe`.
3. A fixed inline JavaScript verifier embedded in the published launcher uses
   Node built-in cryptography to verify the manifest with the pinned Ed25519
   public key.
4. No downloaded JavaScript is imported or executed until this succeeds.

### Runtime artifacts

The release contains:

- an official Windows x64 `node.exe`;
- the exact lockfile-bound tsx CLI and its mechanically enumerated runtime
  module closure;
- no task artifact, secret, credential, policy, provider, or operator payload.

The publication operation must verify the official Node release checksums and
their upstream signature before upload. Windows must independently require a
valid Authenticode signature on `node.exe`.

Non-PE script artifacts are authorized by both:

1. exact membership and SHA-256 in the Ed25519-signed runtime manifest; and
2. the manifest's exact immutable source-promotion commit/tree binding.

This replaces the current inapplicable Authenticode requirement for `.ps1`,
`.mjs`, and `.ts` bytes. It does not remove Authenticode from PE binaries.

## Artifact storage

Runtime bytes are non-secret, but the bootstrap route will not trust mutable or
redirectable public URLs.

Artifacts are uploaded once to the configured object store under immutable
digest-addressed keys:

```text
coordination-v2/runtime/<sha256>/<fixed-artifact-name>
```

The database stores the exact object key, length, digest, role, and fixed
destination. The server streams bytes through a host-authenticated route:

```text
GET /api/coordination/v2/host/runtime-bootstrap/issues/:issueId/artifacts/:artifactId
```

The route:

- requires the existing V2 enrolled-host identity middleware;
- requires the issue to belong to that host and remain unexpired;
- reads only the recorded fixed object key;
- rejects redirects and alternate buckets/hosts;
- sets exact `Content-Length` and `Digest` metadata;
- applies a fixed maximum size;
- never returns object-store credentials or signed URLs.

## Manifest contract

The canonical signed payload contains only:

```text
protocolVersion
kind = "runtime_bootstrap_manifest"
issueId
requestKeyDigest
hostEnrollmentId
hostKeyFingerprint
runtimeReleaseId
runtimeReleaseDigest
sourcePromotionId
repositoryIdentity
promotedCommitSha
exactTreeSha
publicationReference
protectedValidationId
sourcePromotionRecordDigest
artifacts[]:
  artifactId
  role
  fixedDestination
  objectDigest
  byteLength
  mediaType
  requiresAuthenticode
sourceMembers[]:
  fixedPath
  sha256
issuedAt
expiresAt
nonce
```

Rules:

- `protocolVersion` is exactly `1`.
- The manifest lifetime is at most five minutes.
- The release publication age is at most seven days for first installation.
- Reinstallation of the same acknowledged release remains allowed only while
  the release is not revoked and the exact source promotion remains current.
- Artifact and source-member arrays are sorted before canonicalization.
- Destination roles and paths come from a closed server allowlist.
- Unknown, duplicate, absolute, parent-relative, alternate-data-stream, UNC,
  device, or reparse-resolving paths fail closed.
- The response has exactly `payload`, `canonicalResponseDigest`, `signature`,
  and `keyFingerprint`.

## Durable server model

Migration `0052` adds only new tables and functions. It does not alter existing
Coordinator V2 tables or constraints.

### DDL draft

```sql
CREATE TABLE "coordination_v2_runtime_releases" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "protocol_version" integer NOT NULL,
  "source_promotion_id" varchar NOT NULL
    REFERENCES "coordination_v2_source_promotions"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "repository_identity" varchar(512) NOT NULL,
  "promoted_commit_sha" varchar(40) NOT NULL,
  "exact_tree_sha" varchar(40) NOT NULL,
  "publication_reference" varchar(512) NOT NULL,
  "protected_validation_id" varchar(128) NOT NULL,
  "source_promotion_record_digest" varchar(64) NOT NULL,
  "release_digest" varchar(64) NOT NULL,
  "manifest_template_digest" varchar(64) NOT NULL,
  "published_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "coordination_v2_runtime_release_protocol"
    CHECK ("coordination_v2_runtime_releases"."protocol_version" = 1),
  CONSTRAINT "coordination_v2_runtime_release_commit"
    CHECK ("coordination_v2_runtime_releases"."promoted_commit_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "coordination_v2_runtime_release_tree"
    CHECK ("coordination_v2_runtime_releases"."exact_tree_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "coordination_v2_runtime_release_source_digest"
    CHECK ("coordination_v2_runtime_releases"."source_promotion_record_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_release_digest"
    CHECK ("coordination_v2_runtime_releases"."release_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_manifest_template_digest"
    CHECK ("coordination_v2_runtime_releases"."manifest_template_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "uq_coordination_v2_runtime_release_digest"
  ON "coordination_v2_runtime_releases" ("release_digest");
CREATE INDEX "idx_coordination_v2_runtime_release_published"
  ON "coordination_v2_runtime_releases" ("published_at");

CREATE TABLE "coordination_v2_runtime_release_artifacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "runtime_release_id" varchar NOT NULL
    REFERENCES "coordination_v2_runtime_releases"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "role" varchar(48) NOT NULL,
  "fixed_destination" varchar(512) NOT NULL,
  "object_key" varchar(1024) NOT NULL,
  "object_digest" varchar(64) NOT NULL,
  "byte_length" bigint NOT NULL,
  "media_type" varchar(128) NOT NULL,
  "requires_authenticode" boolean NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "coordination_v2_runtime_artifact_role"
    CHECK ("coordination_v2_runtime_release_artifacts"."role"
      IN ('node_executable', 'tsx_runtime_module')),
  CONSTRAINT "coordination_v2_runtime_artifact_digest"
    CHECK ("coordination_v2_runtime_release_artifacts"."object_digest"
      ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_artifact_length"
    CHECK ("coordination_v2_runtime_release_artifacts"."byte_length" > 0
      AND "coordination_v2_runtime_release_artifacts"."byte_length" <= 268435456),
  CONSTRAINT "coordination_v2_runtime_artifact_object_key"
    CHECK ("coordination_v2_runtime_release_artifacts"."object_key"
      ~ '^coordination-v2/runtime/[0-9a-f]{64}/[A-Za-z0-9._-]+$')
);

CREATE UNIQUE INDEX "uq_coordination_v2_runtime_artifact_destination"
  ON "coordination_v2_runtime_release_artifacts"
  ("runtime_release_id", "fixed_destination");
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_artifact_object"
  ON "coordination_v2_runtime_release_artifacts"
  ("runtime_release_id", "object_key");

The two artifact roles are intentionally closed for protocol version 1. A new
role requires a protocol-version change, schema constraint change, destination
allowlist change, and new verification coverage; it is not data-driven
extensibility.

CREATE TABLE "coordination_v2_runtime_bootstrap_issues" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "host_enrollment_id" varchar NOT NULL
    REFERENCES "coordination_v2_host_enrollments"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "runtime_release_id" varchar NOT NULL
    REFERENCES "coordination_v2_runtime_releases"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "request_key" varchar(128) NOT NULL,
  "request_digest" varchar(64) NOT NULL,
  "manifest_digest" varchar(64) NOT NULL,
  "issued_at" timestamp NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "coordination_v2_runtime_issue_request_digest"
    CHECK ("coordination_v2_runtime_bootstrap_issues"."request_digest"
      ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_issue_manifest_digest"
    CHECK ("coordination_v2_runtime_bootstrap_issues"."manifest_digest"
      ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_issue_expiry"
    CHECK ("coordination_v2_runtime_bootstrap_issues"."expires_at"
        > "coordination_v2_runtime_bootstrap_issues"."issued_at"
      AND "coordination_v2_runtime_bootstrap_issues"."expires_at"
        <= "coordination_v2_runtime_bootstrap_issues"."issued_at"
          + interval '5 minutes')
);

CREATE UNIQUE INDEX "uq_coordination_v2_runtime_issue_request"
  ON "coordination_v2_runtime_bootstrap_issues"
  ("host_enrollment_id", "request_key");
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_issue_manifest"
  ON "coordination_v2_runtime_bootstrap_issues" ("manifest_digest");

CREATE TABLE "coordination_v2_runtime_bootstrap_acknowledgements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "host_enrollment_id" varchar NOT NULL
    REFERENCES "coordination_v2_host_enrollments"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "runtime_release_id" varchar NOT NULL
    REFERENCES "coordination_v2_runtime_releases"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "issue_id" varchar NOT NULL
    REFERENCES "coordination_v2_runtime_bootstrap_issues"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "request_key" varchar(128) NOT NULL,
  "manifest_digest" varchar(64) NOT NULL,
  "local_evidence_digest" varchar(64) NOT NULL,
  "acknowledgement_digest" varchar(64) NOT NULL,
  "host_signature_digest" varchar(64) NOT NULL,
  "acknowledged_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "coordination_v2_runtime_ack_manifest_digest"
    CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."manifest_digest"
      ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_ack_evidence_digest"
    CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."local_evidence_digest"
      ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_ack_digest"
    CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."acknowledgement_digest"
      ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "coordination_v2_runtime_ack_signature_digest"
    CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."host_signature_digest"
      ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "uq_coordination_v2_runtime_ack_request"
  ON "coordination_v2_runtime_bootstrap_acknowledgements"
  ("host_enrollment_id", "request_key");
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_ack_release"
  ON "coordination_v2_runtime_bootstrap_acknowledgements"
  ("host_enrollment_id", "runtime_release_id");

CREATE TABLE "coordination_v2_runtime_release_revocations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "runtime_release_id" varchar NOT NULL
    REFERENCES "coordination_v2_runtime_releases"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  "request_key" varchar(128) NOT NULL,
  "reason_code" varchar(128) NOT NULL,
  "revoked_by" varchar(128) NOT NULL,
  "revoked_at" timestamp NOT NULL,
  "canonical_record_digest" varchar(64) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "coordination_v2_runtime_revocation_reason"
    CHECK ("coordination_v2_runtime_release_revocations"."reason_code"
      ~ '^[A-Z0-9_]{1,128}$'),
  CONSTRAINT "coordination_v2_runtime_revocation_digest"
    CHECK ("coordination_v2_runtime_release_revocations"."canonical_record_digest"
      ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "uq_coordination_v2_runtime_revocation_release"
  ON "coordination_v2_runtime_release_revocations" ("runtime_release_id");
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_revocation_request"
  ON "coordination_v2_runtime_release_revocations" ("request_key");

CREATE OR REPLACE FUNCTION coordination_v2_reject_runtime_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'coordination_v2_runtime_evidence_is_append_only';
END;
$$;

CREATE TRIGGER coordination_v2_runtime_releases_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_releases"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();
CREATE TRIGGER coordination_v2_runtime_release_artifacts_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_release_artifacts"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();
CREATE TRIGGER coordination_v2_runtime_bootstrap_issues_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_bootstrap_issues"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();
CREATE TRIGGER coordination_v2_runtime_bootstrap_acknowledgements_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_bootstrap_acknowledgements"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();
CREATE TRIGGER coordination_v2_runtime_release_revocations_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_release_revocations"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();
```

No new table has a foreign key to or column naming a task, policy, preparation
reservation, session, attempt, lease, provider, operation, result, or cleanup
record.

## API

### Publish a release

```text
POST /api/internal/coordination/v2/runtime-releases
```

This operator-only boundary:

- requires the existing protected operator authority;
- verifies the exact current source-promotion record;
- independently reads the promoted commit/tree and verifies the exact bootstrap
  source blobs and package-lock v3 bytes;
- verifies the pinned tsx 4.23.1, nested esbuild 0.28.1, and win32-x64 0.28.1
  dependency graph, npm SRI, and the complete safe tar closure;
- verifies Node v20.20.0 from the commit-pinned official release keyring using
  its pinned digest, `gpgv`, the exact signer fingerprint, and the signed
  `win-x64/node.exe` checksum;
- verifies every object exists at its digest-addressed key with exact length and
  digest;
- verifies the mechanically generated tsx closure against the lockfile;
- writes the release and artifacts in one transaction;
- never overwrites an existing release or object.

Production intentionally excludes `.git` from the published image. Source
verification therefore uses one protected remote snapshot rather than the
deployment filesystem:

- the source-promotion repository identity must equal the configured repository;
- a temporary bare repository fetches only the exact promoted commit through
  the exact `git@github.com:owner/repository.git` transport using the existing
  deploy key and pinned GitHub SSH host keys; HTTPS and alternate transports
  fail closed;
- `FETCH_HEAD` must equal the requested commit and its tree must equal the
  immutable source-promotion tree;
- the bootstrap source members and `package-lock.json` are read as bounded,
  binary-safe blobs from that same snapshot;
- the accepted blob path set is closed, duplicate-free, and traversal-safe;
- the temporary repository and temporary SSH material are removed on every
  success or failure;
- there is no fallback to mutable deployed files, a branch, a tag, local
  tree-equivalence, caller-supplied source bytes, or publication-input test
  dependencies.

### Issue a host-bound manifest

```text
POST /api/coordination/v2/host/runtime-bootstrap/issues
```

Request:

```json
{
  "requestKey": "<bounded random idempotency key>",
  "protocolVersion": 1
}
```

The route requires the existing enrolled-host token and RSA identity proof. It
selects the newest published, unrevoked release whose source promotion is still
current. Same-host/same-key retries return the exact prior issue and signed
manifest. Conflicting reuse fails closed.

### Stream an artifact

```text
GET /api/coordination/v2/host/runtime-bootstrap/issues/:issueId/artifacts/:artifactId
```

Only the issue's host may read an issue artifact before issue expiry.

### Acknowledge installation

```text
POST /api/coordination/v2/host/runtime-bootstrap/issues/:issueId/acknowledge
```

The body contains the exact acknowledgement payload plus the host's RSA-SHA256
signature. The server verifies:

- active enrolled host;
- exact issue/release/manifest lineage;
- unexpired issue;
- unrevoked release;
- exact source promotion remains current;
- acknowledgement and local evidence digests;
- host signature against the enrollment public key;
- idempotency key reuse.

It inserts one immutable acknowledgement. It calls no lifecycle, preparation,
session, attempt, lease, task, or execution service.

### Read runtime status

```text
GET /api/coordination/v2/host/runtime-bootstrap/status
```

Returns only the host's acknowledged release ID/digest, source commit/tree,
revocation state, and whether execution preflight may proceed.

## Windows command

Add:

```powershell
Initialize-HolaCoordinatorRuntime `
  -Endpoint 'https://getholahola.com'
```

The command accepts no task, policy, provider, runtime path, URL, token, secret,
credential, executable, or destination argument.

It derives all paths from the published launcher root and uses:

```text
%LOCALAPPDATA%\HolaHola\CoordinatorV2\runtime-bootstrap-request.dpapi
%LOCALAPPDATA%\HolaHola\CoordinatorV2\runtime-bootstrap-ack.dpapi
<approved-root>\.runtime-bootstrap-staging-<issue-id>\
<approved-root>\runtime\node.exe
<approved-root>\node_modules\tsx\...
<approved-root>\.coordination-v2-runtime-manifest.json
```

The request record is written through CurrentUser DPAPI before the first network
request. A retry reuses the exact request key and issue. The acknowledgement
record is written through CurrentUser DPAPI before the request record is
removed.

The command emits only:

```text
runtimeReleaseId
manifestDigest
sourceCommitSha
exactTreeSha
status = acknowledged
credentialProtected = true
```

It never prints host tokens, RSA private material, object-store data, manifest
nonces, signatures, request keys, decrypted DPAPI content, or artifact bytes.

## Filesystem safety

Before staging and after installation:

- the approved root, staging root, destination parents, and files must not be
  reparse points;
- every resolved path must stay beneath the approved root;
- the owner must translate to the current Windows user, LocalSystem, or
  Administrators;
- no `Everyone`, `Users`, anonymous, guest, or untrusted SID may have write,
  modify, full-control, ownership, or ACL-change rights;
- inherited unsafe write grants fail closed;
- files are written with create-new semantics into a new staging directory;
- existing active runtime files are never modified in place;
- promotion uses same-volume atomic rename/replace;
- partial pre-promotion staging is removable;
- an ambiguous acknowledgement retains the fully verified generation and exact
  DPAPI retry authority for idempotent recovery.

## Execution preflight

`Assert-ExecutionHost` changes from one generic Authenticode function to
role-specific authority:

- `node.exe`: valid Authenticode, exact acknowledged manifest digest, safe
  path/ACL/reparse checks;
- tsx module closure: exact signed-manifest membership and hash, safe
  path/ACL/reparse checks;
- launcher, pinned public key, and Coordinator CLI: exact source-member hashes,
  clean repository, exact promoted commit/tree, safe path/ACL/reparse checks;
- local DPAPI acknowledgement: exact host/release/manifest/source binding;
- server runtime status: same release acknowledged, source current, not revoked.

No task lifecycle starts if any local or server proof differs.

## StrictMode enrollment-poll repair

In `Register-HolaCoordinatorHost`, replace direct optional-property truthiness:

```powershell
if ($status.challenge) {
```

with an explicit property-existence and shape gate:

```powershell
$challengeProperty = $status.PSObject.Properties['challenge']
if ($null -ne $challengeProperty -and $null -ne $challengeProperty.Value) {
    $challenge = $challengeProperty.Value
    if ($challenge -isnot [PSCustomObject] -or
        [string]$challenge.id -notmatch '^[0-9a-fA-F-]{36}$' -or
        [string]::IsNullOrWhiteSpace([string]$challenge.nonce) -or
        [string]::IsNullOrWhiteSpace([string]$challenge.expiresAt)) {
        Fail-Safe 'host_challenge_invalid'
    }
```

Pending responses without a `challenge` property continue polling. Present but
malformed challenges fail closed before signing. No challenge, nonce, or
signature is logged.

## Recovery and revocation

- Failure before DPAPI request persistence creates no server issue.
- Failure after persistence retries with the same request key.
- Same-key issue retries return the exact same manifest bytes and signature.
- Expired issue before acknowledgement requires a new issue but may reuse no
  unverified staged generation.
- Ambiguous artifact reads are retried by exact issue/artifact ID and verified
  by length/hash.
- Failure before atomic promotion removes staging.
- Failure after local promotion but before server acknowledgement retains the
  exact installed generation and DPAPI request record.
- Before acknowledgement, the promoted generation is re-read and re-verifies
  every manifest member, digest, length, destination, source binding, and Node
  Authenticode requirement.
- Ambiguous acknowledgement retries the same signed acknowledgement.
- An expired issue rotates by exact issue generation only; unrelated or newer
  issue state cannot authorize reuse of a staged or promoted generation.
- A revocation is a new immutable record; release and acknowledgement history
  are never updated or deleted.
- Execution preflight fails closed for a revoked release.
- A newer release never auto-upgrades a host. The founder/operator explicitly
  publishes it, and the host explicitly runs runtime initialization again.

## Verification

### Static and unit proof

- closed manifest and API response shapes;
- canonical Ed25519 payload and fingerprint verification;
- source-promotion commit/tree/receipt binding;
- five-minute issue expiry and seven-day first-install maximum age;
- strict destination and object-key allowlists;
- exact tsx dependency closure generation;
- package-lock v3 graph and npm SRI verification for tsx, nested esbuild, and
  win32-x64;
- commit-pinned official Node keyring digest, `gpgv` signer, signed checksum,
  and exact Node executable binding;
- renamed, omitted, duplicated, or destination-shifted tsx closure members are
  rejected;
- Node Authenticode remains required;
- downloaded JavaScript cannot execute before manifest verification;
- the complete initialization critical section is held by a per-current-user
  mutex;
- downloads use create-new bounded files under ACL-proven, non-reparse roots
  and parents;
- a PowerShell 5.1 strict-mode pending response with no `challenge` property
  completes another poll iteration without throwing or signing;
- malformed present challenge fails before RSA signing;
- secrets and decrypted DPAPI values never reach output or errors.

### Database proof

On a disposable Neon branch:

- migration `0052` applies after migrations through `0051`;
- all runtime evidence tables reject update/delete;
- duplicate issue/ack/revocation requests are idempotent;
- conflicting idempotency reuse fails;
- issue expiry and release revocation fail closed;
- acknowledgements are composite-FK-bound to the exact issue, host, release,
  request key, and manifest digest;
- unrelated Coordinator V2 rows remain unchanged;
- before and after row-count assertions prove runtime issue and acknowledgement
  create zero tasks, preparations, sessions, attempts, leases, operations, or
  credentials;
- mutation self-checks fail if the acknowledgement service imports or calls a
  task, preparation, session, attempt, lease, or operation service.

### Windows proof

On a disposable Windows host fixture:

- CurrentUser DPAPI round-trip;
- strong SID-based ACL checks;
- reparse and path-escape rejection;
- official Node Authenticode acceptance and tampered Node rejection;
- bad manifest signature/fingerprint/canonical bytes rejection;
- bad source commit/tree rejection;
- bad artifact length/hash rejection;
- interrupted staging cleanup;
- post-promotion acknowledgement recovery;
- full promoted-generation re-verification before acknowledgement;
- exact-generation expired-issue recovery under the initialization mutex;
- safe output only.

### End-to-end first host

After implementation approval, code review, protected validation, publication,
and source attestation:

1. Run `Initialize-HolaCoordinatorRuntime` on the enrolled Windows host.
2. Verify one exact runtime release acknowledgement and zero sessions.
3. Verify local runtime evidence against the server record.
4. Only then authorize one `Invoke-HolaCoordinator -TaskRef <approved-ref>
   -Format json`.
5. Verify task preparation promotion and acknowledgement occur before the first
   session/lease/operation.

## Publication gate

The Windows host must not run the new command until:

1. migration SQL is generated and reviewed;
2. the migration passes on a disposable Neon branch;
3. focused tests, typecheck, consolidated validation, and system health pass;
4. Alden Anthropic and Gemini give unconditional approval on the final code;
5. the exact commit is pushed to GitHub;
6. the exact source is explicitly published through Replit;
7. the publication marker passes protected validation;
8. Replit and GitHub report the exact same SHA;
9. the exact deployment build is recorded through authenticated operator
   attestation.

Until all nine gates pass, the existing enrolled host and its protected
credential remain untouched and no Coordinator V2 session is created.