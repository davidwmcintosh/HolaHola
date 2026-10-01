# Reusable secure coordination runtime onboarding

Date: 2026-10-01
Status: Design for independent and founder review; implementation not started.

## Goal and acceptance

Alden stewards onboarding for Antigravity, Cursor, OpenAI-based clients, and future
MCP/HTTP runtimes. The founder makes one local installation decision and approves
the exact runtime request in an authenticated browser. No coordination credential
is copied through chat, a coordination message, a URL, or terminal output.

The same enrollment protocol and credential lifecycle serve every client family.
Onboarding is complete only after the client makes an authenticated ledger request.
Inbox delivery, acknowledgement, and successful Coordinator V2 task execution are
separate facts and must never be inferred from credential issuance.

## Independent collaboration and execution paths

Ledger onboarding must work before, and independently of, Coordinator V2 host
runtime initialization or successful task execution. A blocked host bootstrap
must not prevent the new runtime from connecting to Alden for diagnosis.

The local coordination setup helper therefore cannot depend on the V2 staged
Node/tsx closure or its signed task-execution runtime being installed. Distribute
the helper through a reviewed, integrity-verifiable installation path compatible
with the destination's available execution environment. Do not use remote
download-and-evaluate commands, require latest-main pulls, or silently bypass the
destination's approved source pin. Helper availability and verification are part
of onboarding acceptance, not a prerequisite left for the founder to troubleshoot.

Reports from another runtime distinguish measured local facts from proposed root
causes. Compare exact approved/local source bytes before recommending a launcher
patch or publication. A connection does not validate a reported host-runtime fix.

## Authority and identity

- Alden prepares and cancels invitations using his existing delegated
  `coordination:runtime:admin` authority. Founder approval is the human confirmation
  for installing a credential on a particular runtime, not a new policy approval.
- Policy versions, operator grants, source publication, and runtime-release
  publication keep their existing founder-only boundaries.
- Each installation has its own immutable runtime ID, key, credential, capabilities,
  and revocation state. No borrowing another runtime's credential.
- A hat describes the platform/runtime surface, not a model or a separate Luca.
  Provider/model/platform descriptions cannot assert identity or authority.
- Actors remain server-allowlisted. The onboarding UI selects registered actors,
  never accepts arbitrary authority-bearing actor strings. New hats must first
  satisfy the existing actor-onboarding procedure: schema/auth/client/catalog/tool
  completeness and tests. Antigravity uses `luca-antigravity`; Cursor and OpenAI
  runtime surfaces must receive explicit attributed registry entries if distinct
  hats are required, never be silently aliased to Antigravity or Gemini.
- Client adapters and enrollment are transport-neutral; adding a compatible runtime
  does not require another credential-delivery design. Do not advertise a client as
  supported before its identity wiring and connection adapter actually work.
- Invitations for Luca hats default to existing standard Luca capabilities.
  A capability list must be valid for the selected actor and cannot create new
  administrative authority or substitute for an operator grant.

## User and client journey

1. Alden prepares an invitation with an existing actor, unique runtime ID, display
   name, requested capabilities, optional provider/model, and client transport.
   The tool returns only a non-bearer invitation reference, expiry, safe scope,
   and setup instructions. It does not register or mint a broker secret.
2. A reviewed setup helper is installed and started on the destination runtime.
   Its command arguments contain only endpoint and non-secret invitation reference.
   HTTPS and server identity verification are mandatory outside isolated tests.
3. The helper generates and durably protects a private proof key before submitting
   its public key and bounded metadata. It never overwrites an existing key or
   changes a runtime binding implicitly.
4. The helper displays a matching verification code and public-key fingerprint,
   and opens an authenticated founder approval page. The founder verifies the
   actor, runtime ID, capabilities, expiry, requesting party, and fingerprint/code.
   Possession of the invitation URL is not authorization. If another request used
   the invitation, the founder must approve only the matching local request.
5. Approval or denial is an explicit CSRF-protected, same-origin POST. Viewing the
   page is read-only. Browser responses contain no bootstrap, access token, or
   private key. A denial or cancellation cannot be reversed by the helper.
6. The helper obtains a fresh short-lived challenge for the approved request and
   signs a versioned, canonical, domain-separated payload binding endpoint,
   invitation/request ID, actor, runtime ID, fingerprint, and nonce.
7. The server atomically verifies the signature and approval, consumes the exact
   nonce, creates the runtime registration/key binding, and mints its broker
   credential. The plaintext credential goes only in the non-cacheable proof
   response to the signing helper. No secret passes through a model or browser.
8. The helper writes the credential directly to its scoped secure store and prints
   only success/failure, actor/runtime, expiry, and safe next-step information.
   It then makes an authenticated identity/ledger read and offers the existing
   canonical inbox acknowledgement operation for the actual handoff.
9. After a proven connection, Alden and that runtime use their own identities to
   collaborate directly. Source/runtime publication and V2 execution are separate.

## Server architecture and durable state

Use new provider-neutral enrollment records, not Coordinator V2 host tables.
Reuse the existing broker's runtime registration, credential hashing, renewal,
revocation, and audit mechanisms. Keep existing host tokens, namespaces, tables,
DPAPI files, source pins, and launcher behavior untouched.

Separate durable concerns:

- Invitations: immutable actor/runtime/capability scope, preparer, timestamps,
  expiry, cancellation, and completion linkage; no bearer credential.
- Requests/enrollments: invitation linkage, exact submitted public key/fingerprint,
  verification code binding, founder decision, decision timestamps, durable
  enrolled-key binding, and final registration reference.
- Challenges: request/enrollment linkage, nonce hash, expiry, purpose, consumption;
  issuance and recovery proofs cannot share a challenge purpose.

Lifecycle states are explicit: prepared, requested, approved, denied, cancelled,
expired, enrolled, and revoked. Connected and acknowledged are separately evidenced
operational facts rather than assumed terminal enrollment states.

Use the broker's transaction/advisory-lock conventions for scope, challenge,
registration, credential issuance, audit, and runtime revocation ordering.
Extract or add a narrowly scoped transaction-aware internal minting function;
do not call public register/exchange endpoints in a partially committed ceremony.
Existing one-time bootstrap APIs remain legacy/operator compatibility paths;
new onboarding tools, pages, and setup instructions must not call or expose them.

Alden may cancel pending invitations; founder may approve, deny, or cancel a
specific pending request. Completing an invitation and revoking an enrolled
runtime must invalidate all remaining pending proof attempts for that scope.
Duplicate runtime IDs and attempts to alter immutable bindings fail explicitly.

All public request/challenge/proof endpoints have bounded payloads, rate limits,
finite expiry, generic safe errors, and no enumeration of other pending requests.
No GET creates a challenge or otherwise mutates state. Challenges are requested
with POST. Public invitation knowledge alone cannot approve, enroll, recover,
revoke, or alter scope. Founder approval must bind the displayed local fingerprint
and code, not just an invitation ID.

## Recovery and ongoing credentials

Consume each challenge only once; replays and concurrent proofs cannot create
multiple registrations or resurrect revoked credentials.

If a successful HTTP response is lost or secure-store writing fails, the client
keeps its protected proof key and uses a fresh recovery challenge. That key can
prove possession for the same approved enrollment and rotate a replacement token,
without exposing the old token, reusing a challenge, registering a second runtime,
or asking the founder to approve the same device again.

Ordinary renewal uses the existing broker lifecycle. Expired access credentials
can be recovered through the approved-key protocol. Recovery is denied when the
enrollment, invitation completion, or runtime has been revoked/disabled. A lost
proof key requires an explicit new enrollment/reauthorization decision; no reset,
cross-runtime fallback, or silently weakened verification.

## Secure credential custody and adapters

Credential and key store entries are scoped by verified endpoint, actor, runtime ID,
and purpose. Writes are atomic; failures are explicit. Never use repository files,
shared `.env`, shell profiles, process arguments, browser localStorage, MCP JSON
bearer headers, or the existing plaintext temporary CLI cache as the secure store.

Native custody adapters:

- Windows: DPAPI CurrentUser, restrictive ownership/ACL/reparse checks, a new
  coordination-only namespace separate from Coordinator V2 and historical Gate 3.
- macOS: OS Keychain adapter.
- Linux: Secret Service adapter where available.
- Hosted/process consumers: an explicit runtime-restricted secret-store adapter,
  supplied by the hosting integration. No claim that a local helper can configure
  an arbitrary hosted service without an authorized adapter.

Native adapters must be implemented and verified before being labelled supported.
An absent/unavailable secure store stops setup explicitly; no plaintext downgrade.
The common protocol and injected store interface remain testable independently.
OS encryption does not protect against a malicious process running as the same
user, live process memory, or a client intentionally exposing its own credential.

Client transport adapters:

- Antigravity/Cursor and compatible IDEs: a local stdio MCP bridge reads/renews the
  runtime credential internally and forwards to existing Streamable HTTP ledger
  MCP. Client JSON contains only executable/args/non-secret scoped IDs. MCP stdout
  is protocol-only; diagnostics are bounded and secret-free on stderr.
- OpenAI SDK/remote-MCP consumers: an enrolled launcher/client adapter reads the
  scoped credential internally and supplies the supported authorization header.
  No token-print/export command or static secret-bearing generated configuration.
- CLI/HTTP consumers: actor client receives a secure-store credential provider,
  retains server-derived actor/runtime checks, and persists renewal in that store.

Client instructions must specify which actual process receives credentials and
how connection/renewal/recovery works. Do not promise native IDE or hosted secret
facilities that are not implemented. Automatic launch is fixed-action, not an
arbitrary-command execution feature. Installer/setup approval stays local.

## Founder UI and Alden tools

Provide a founder-only runtime onboarding view, linked from the admin surface,
for pending requests, bounded metadata, approval/denial/cancellation, active
registrations, expiry, connection evidence, and revocation with explicit impact.
The view must not fetch plaintext credentials. Read-only status is available to
authorized coordination participants without leaking other actors' private state.

Add non-secret prepare/list/status/cancel onboarding operations for Alden.
Teach the procedure through reviewed tool wording and the established catalog
indexing path. Do not remove existing compatibility tools or rephrase unrelated
system instructions. Tool descriptions must clearly distinguish prepared,
approved, enrolled, authenticated, acknowledged, and executed.

## Verification and delivery

- Pure tests: scope validation, signature canonicalization/domain separation,
  client/store isolation, safe output/configuration, unsupported-store failures,
  expired/corrupt state, interrupted writes, recovery, transport forwarding.
- Disposable PostgreSQL tests: unauthorized preparation/approval, CSRF/origin,
  wrong key, wrong actor/runtime/endpoint, expiration, cancellation/denial,
  concurrent proof, single consumption, atomic registration/minting, lost-response
  recovery, cross-runtime revocation and preservation of unrelated rows.
- One browser pass on the critical founder-approval journey after implementation.
  No credentials in rendered HTML, approval API responses, logs, or stored audit.
- A real Windows smoke must verify DPAPI and Antigravity connection; Linux-based
  contract tests are not evidence of a real Windows run. Verify Cursor/OpenAI
  adapters independently before claiming those concrete clients connected.
- Schema through reviewed Drizzle artifacts and the disposable Neon branch gate
  before the shared database; no startup DDL and no production fixtures.
- Typecheck and targeted hermetic tests, restart dev once, inspect logs/preview,
  and existing system-health verification. Preserve current Windows source pin.
- Record canonical documentation and independent review in shared-spec. Source and
  runtime publication remain separate approved operations; no automatic publish.

## Out of scope

Changing Coordinator V2 task execution, rewriting host enrollment, relaxing TLS,
deleting DPAPI identities, fixing unrelated Windows runtime failures, publishing
source/runtime releases, broadening founder-only policy authority, or claiming
every arbitrary client is connected merely because it speaks MCP.