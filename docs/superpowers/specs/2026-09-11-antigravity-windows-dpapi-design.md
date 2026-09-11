# Antigravity Windows DPAPI Credential Design

**Date:** September 11, 2026  
**Status:** Approved in principle by David; written-spec review pending  
**Scope:** Replace the 1Password-only Windows credential source for Gate 3 task #1448. Do not change coordinator authority, PostgreSQL state, founder approval, the approved task, or its bounded execution rules.

## Problem

The approved Windows operator does not have 1Password. Requiring a new external password-manager account is unnecessary because the task runs on a known Windows host under a known operator account.

The replacement must preserve the existing credential constraints:

- no fixed Luca credential on Windows;
- no bootstrap or broker secret in chat, stdout, stderr, command arguments, logs, repository files, `.env` files, receipts, or persistent shell configuration;
- PostgreSQL remains canonical;
- founder approval remains mandatory;
- the Gate 3 task and command remain exact and bounded;
- no claim of containment against malicious software already running as the same Windows user.

## Chosen Approach

Add a Windows PowerShell 5.1-compatible launcher that uses Windows Data Protection API (DPAPI) with `CurrentUser` scope.

The launcher owns only the local bootstrap lifecycle. Existing TypeScript preparation, provisioning, broker exchange, task execution, and verification remain authoritative.

No external installation or account is required.

## Alternatives Considered

### Windows Credential Manager

Credential Manager is Windows-native, but safe non-interactive retrieval requires more Windows API surface and more code than DPAPI. It adds complexity without strengthening the stated non-adversarial same-user boundary.

### 1Password

1Password provides strong cross-device operations and service-account isolation, but it requires a new account, installation, and external dependency. It remains a valid future option but is not required for this proof.

### Manually managed environment variable or encrypted `.env`

Rejected. Persistent shell variables and `.env` files violate the credential boundary. Manual copy-and-paste also creates avoidable clipboard and transcript exposure.

## Components

### PowerShell launcher

Add a repository script dedicated to Antigravity Gate 3. It exposes fixed actions rather than accepting an arbitrary child command:

- `initialize`: generate and protect a new bootstrap;
- `prepare`: run the existing public-bundle preparation command;
- `run`: consume the protected bootstrap and run the existing bounded driver;
- `status`: report only non-secret local state.

The launcher must run under both 64-bit Windows PowerShell 5.1 and PowerShell 7. It must reject non-Windows hosts and unavailable DPAPI APIs.

It must resolve and validate the approved worktree:

`C:\Users\David\HolaHola-antigravity`

It must not accept an alternate worktree, arbitrary executable, arbitrary script, or arbitrary child argument.

### Protected local store

The default store is outside the repository:

`%LOCALAPPDATA%\HolaHola\coordination\antigravity-bootstrap.dpapi`

The stored envelope contains only versioned metadata and DPAPI ciphertext. It must not contain the plaintext bootstrap, its hash, broker credentials, task receipts, or command output.

The launcher must:

- create the directory and file without overwriting an existing credential;
- disable inherited ACLs;
- set the current Windows user SID as owner;
- grant that SID the required access and reject unexpected access-control entries;
- verify the ACL after writing and before every read;
- use atomic creation and state transitions;
- reject symbolic links, reparse points, alternate paths, and malformed envelopes.

DPAPI `CurrentUser` is the confidentiality boundary. The ACL reduces accidental cross-user access but does not create adversarial same-user containment.

## Bootstrap Lifecycle

### Initialization

`initialize` uses `RandomNumberGenerator` to create 32 random bytes and encodes them as unpadded Base64URL with the `cb_` prefix. The result must match:

`^cb_[A-Za-z0-9_-]{43}$`

The plaintext exists only in process memory long enough to call DPAPI. It is never accepted as input, displayed, copied to the clipboard, or written unencrypted.

Initialization fails closed if the active or in-flight store already exists. There is no automatic overwrite or rotation.

### Preparation

`prepare` decrypts the active bootstrap in memory and launches only:

`npx tsx server/scripts/prepare-antigravity-provisioning.ts --starting-commit`, followed by the exact synchronized 40-character Git commit SHA

The starting commit remains an explicit non-secret input and must pass the existing TypeScript validation. Preparation does not consume the local bootstrap because Phase B has not registered its digest yet.

The child receives a newly constructed environment containing only an explicit set of Windows/Node runtime variables plus `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN`. It must not inherit unrelated parent secrets or fixed Luca credentials.

The launcher removes the plaintext environment entry and clears its own references in `finally`. PowerShell and .NET cannot promise deterministic physical zeroization of immutable managed strings; the design claims bounded lifetime and no persistence, not provable RAM erasure.

### Bounded execution

`run` requires all existing non-secret runtime, ownership, window, receipt, and artifact-digest inputs. It does not weaken or synthesize them.

Before decryption or child launch, it atomically moves the active store to an in-flight name. Only the in-flight file can supply the bootstrap for that launch. The active name immediately becomes unavailable, preventing a second launch.

It then launches only:

`npx tsx server/scripts/coordination-runtime-antigravity.ts`

The in-flight ciphertext is deleted in `finally`, regardless of child success or failure. A crash residue is never accepted as an active credential. If execution fails after local consumption, the operator must create a fresh bootstrap and repeat provisioning; the launcher must not guess whether broker exchange occurred or replay uncertain authority.

The existing bounded driver remains responsible for exchanging the bootstrap, deleting its environment entry, maintaining short-lived broker credentials in memory, enforcing task #1448, and emitting immutable evidence.

### Rotation and recovery

There is no silent rotation. A future bootstrap requires an explicit operator recovery flow that:

1. confirms there is no usable active or in-flight local bootstrap;
2. generates a new bootstrap;
3. creates a new public bundle;
4. repeats founder challenge approval and Phase B registration.

Old ciphertext is never overwritten into a new lifecycle.

## Child Environment

The launcher must construct a new child environment rather than broadly inherit the parent environment.

The allowlist may include only the Windows and Node variables required to locate and run the approved command, the documented non-secret Gate 3 inputs, and `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN`.

It must explicitly exclude:

- fixed Luca actor tokens;
- Replit, GitHub, database, provider, cloud, and coordination service secrets;
- PowerShell profiles and persistent environment configuration;
- arbitrary caller-provided variables.

No child command line may contain a secret.

## Output and Errors

The launcher may emit fixed event names and non-secret paths, modes, exit codes, IDs, and digests. It must never echo the bootstrap, ciphertext, decrypted bytes, environment contents, or broker credentials.

Failures are explicit and non-secret:

- unsupported platform or PowerShell;
- DPAPI unavailable;
- wrong worktree;
- credential already exists;
- credential missing;
- in-flight credential present;
- malformed envelope;
- ACL or owner mismatch;
- DPAPI decrypt failure;
- required non-secret input missing;
- child launch failure;
- child non-zero exit.

No insecure fallback is permitted.

## Testing and Evidence

### Cross-platform checks

Linux CI may verify:

- the launcher is present and contains no fixed credential;
- only the four fixed actions are accepted;
- approved child scripts are hardcoded;
- no arbitrary command parameter exists;
- storage is rooted under `LOCALAPPDATA`, not the repository;
- secret values are absent from documented output and arguments;
- the runbook and self-check remain aligned;
- the existing TypeScript preparation, driver, broker, and Gate 3 tests still pass.

These checks do not claim that DPAPI or Windows process behavior ran successfully.

### Genuine Windows proof

The approved Windows host must provide the actual DPAPI evidence:

- Windows PowerShell 5.1 parses and runs the launcher;
- initialization creates a decryptable CurrentUser-protected envelope;
- another Windows user cannot use it;
- ACL and owner validation pass;
- preparation emits only the public bundle;
- a second initialization is rejected;
- bounded execution atomically consumes the local ciphertext;
- a second execution attempt is rejected;
- no secret appears in the console, process arguments, repository, or receipt.

This host evidence must be preserved as non-secret immutable coordination evidence. It must not be generalized into adversarial Windows-host containment.

## Documentation and Promotion

Update:

- the Antigravity Gate 3 operator runbook;
- coordination client credential guidance;
- the existing safe-provisioning design and implementation plan;
- batch and handoff records.

The change must pass focused tests, TypeScript checking, registered validation, consolidated CI, system health, and independent review. It must then use the protected promotion workflow and produce exact `SYNCED` evidence. Task #1448 must start from that newly synchronized GitHub `main` commit, not the prior commit.

## Explicit Non-Goals

- no coordinator protocol or schema change;
- no new trust rank for the Windows runtime;
- no replacement for founder approval;
- no arbitrary PowerShell command runner;
- no fixed Windows Luca credential;
- no Linux or macOS credential-store design;
- no adversarial containment claim for processes running as the approved Windows user;
- no claim of Windows execution from Linux-only tests.