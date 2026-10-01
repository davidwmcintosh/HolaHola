# Runtime onboarding client setup

This runbook covers the local onboarding helper, native credential custody,
stdio MCP bridge, enrolled coordination checks, and the OpenAI Responses SDK
adapter. It does not change Coordinator V2 or provision/approve invitations.

## Implementation boundary

The executable source entry point is
`server/scripts/runtime-onboarding-cli.ts`. It has exactly four actions:
`setup`, `status`, `mcp`, and `sdk`. It does not accept shell commands, provide
a token-print/export action, or use Coordinator V2's staged Node/tsx closure.
The standalone distribution is the canonical package from
`scripts/build-runtime-onboarding-package.mjs`: a Node.js 20+ bundle at
`bin/holahola-onboarding.mjs`, the Windows DPAPI adapter at
`scripts/runtime-onboarding-native-store.ps1`, and its package/readme/manifest.
The builder bundles SDK dependencies and the package runs with ordinary Node;
no dependency installation is required.

## Release and verification status

The backend, founder UI, native helper, HTTP-MCP, and OpenAI SDK are implemented
in the source tree. The corrected full disposable gate `kc5EhlOi` exited 0
with `READY_TO_PROMOTE`; it ran 177 CI commands plus formal PostgreSQL and data
operation proofs. Reviewed migration 0064 was applied with
`npx drizzle-kit migrate` on the verified UNPOOLED shared target. Its hash is
registered once in `drizzle.__drizzle_migrations`, and all three onboarding
tables are present. This shared schema affects both environments; it is not an
application/source/runtime publication.

The gate preceded a backend-only route-order follow-up and was not rerun after
that fix. Moving onboarding route registration to after `await setupAuth` and
`await setupGoogleAuth`, before `coordPolicy`, resolved the live anonymous
onboarding/admin GET hang. The follow-up passed 3/3 AST/Passport checks, the
existing route test passed 1/1, whole-project typecheck passed, and the checks
are wired to CI. The schema is unchanged; no second migration is needed.
Gemini review `119fb593-4dff-47d6-8115-ec9535ba13a7` approved this narrow
startup-order scope.

After the second development restart, startup readiness returned root 200
(111 ms), anonymous admin 401 (142 ms), and an own Replit legacy-token Alden
read 403 (45 ms), expected under the Alden/David allowlist; there was no
impersonation. A screenshot showed the healthy public landing and expected auth
response. An actual founder-cookie/API view was not tested; the previous
fixture-based founder browser pass had no second tester.

Latest source verification also passed 13 targeted runtime/SDK/restricted
tests, two response-log tests, and the full project typecheck. The helper at
`/tmp/runtime-onboarding-dev.KL0vBf/package` remains a verified development
package (manifest 5/5, reproducibility passed once, `sourceDirty=true`,
`release=false`). Backend route source is not bundled, so the route-order fix
did not require a package rebuild. This is not a final/released helper or a
claim of live-device support. Real native-platform, client, provider, and
native OS tests remain pending; no onboarding invitation or scoped onboarding
credential has been issued, and no production code or runtime has been
published. The development
public endpoint is configured through `COORDINATION_PUBLIC_ENDPOINT` only.

The public Fetch credential-return guard now canonicalizes case, encoding,
decoded separators, and dot segments before store or network access. The
global logging policy canonicalizes backslashes and URL paths, then applies
bounded eight-pass decoding with fail-closed handling before sensitive-family
omission. The two malformed-source tests assert zero store/fetch calls; other
denied-source tests assert zero fetch calls; the compiled smoke asserted zero
store and fetch calls for 19 denied routes. A read-only near-expiry mock made
one SDK call with no renewal or network access. These results do not establish
proxy or unshown-handler reachability.

The Windows, macOS, and Linux native-store adapters are present. The Linux
`flock` mixed-XDG fixture has been verified; real Windows DPAPI/ACL, macOS
Keychain, Linux Secret Service, and concrete client/device smoke tests have
not. Do not describe any of those live platforms or clients as verified or
supported based only on source and fake-endpoint tests. Native follow-up and
downstream founder publication remain blocked; the known Windows count issue
is unresolved.

This client implements the following onboarding API contract:

- `POST /api/coordination/onboarding/requests`
- `POST /api/coordination/onboarding/requests/:id/status`
- `POST /api/coordination/onboarding/requests/:id/challenge`
- `POST /api/coordination/onboarding/requests/:id/prove`
- Existing broker renewal: `POST /api/coordination/credentials/renew`
- Existing stateless Streamable HTTP MCP: `POST /api/mcp/coordination`

Request responses include the request ID, server-derived actor and runtime ID,
`verificationCode`, key `fingerprint`, fixed
`/admin/runtime-onboarding?request=<encoded-id>` approval path, state, and
expiry. Status responses also include the capability list. The key fingerprint
format used by this client is
`SHA256:` followed by unpadded base64 SHA-256 of the DER-encoded RSA SPKI key.
Challenge `payload` is the exact canonical JSON string signed by the client;
its decoded object must bind `version: 1`, domain
`holahola-coordination-runtime-onboarding`, endpoint origin, actor, runtime ID,
invitation ID, request ID, fingerprint, nonce and `purpose`. The client signs
the exact returned UTF-8 payload bytes rather than rebuilding or normalizing
them. Proof credentials must include server-derived actor/runtime ID,
capabilities and expiry.

The approved deployment must include the corresponding server-side onboarding
routes, actor registry entries, invitation preparation, and founder approval.
In particular, the server must allowlist `luca-cursor` and
`luca-openai-agents` before those actor IDs are usable. Verify server
availability before enrollment; a client build is not evidence that an actor
was enrolled or connected. Do not use real invitation references or
credentials in automated tests.

## Build and integrity-pin the helper

Build only from the exact source tree and source revision approved for the
destination. Do not pull latest main as a setup step and do not use remote
download-and-evaluate commands (`curl | sh`, `irm | iex`, or equivalents).

From the reviewed clean checkout, build the canonical package into a new
protected staging directory:

```sh
node scripts/build-runtime-onboarding-package.mjs \
  --release \
  --output /secure/staging/runtime-onboarding
```

The builder rejects a release from a dirty source tree, bundles with the
already-present esbuild dependency, targets Node 20, and writes an SHA-256
manifest for the package files plus its source revision. Verify that source
revision against the independently approved source pin and verify the manifest
and files against an independently trusted release record after transfer. A
manifest shipped alongside an untrusted download is not itself a trust anchor.
The builder does not publish or approve an artifact.

For local repository development only, the source entry can be run with the
repository's pinned `tsx` dependency:

```sh
npx tsx server/scripts/runtime-onboarding-cli.ts status \
  --endpoint https://coordination.example \
  --actor luca-cursor \
  --runtime-id cursor-workstation-01
```

For an independently runnable install, use the verified
`bin/holahola-onboarding.mjs` package entry and ordinary Node.js 20 or later:

```sh
node /approved/install/bin/holahola-onboarding.mjs status \
  --endpoint https://coordination.example \
  --actor luca-cursor \
  --runtime-id cursor-workstation-01
```

Replace the illustrative endpoint and scope values with values supplied by the
authorized invitation procedure. The helper requires an HTTPS origin outside
isolated injected-fetch tests. Endpoint, actor, runtime ID, and credential
purpose form separate secure-store scopes; changing any scope does not reuse
another installation's key or access token.

## Setup and founder approval

Start setup with the exact non-secret invitation reference and immutable scope:

```sh
node /approved/install/bin/holahola-onboarding.mjs setup \
  --endpoint https://coordination.example \
  --actor luca-cursor \
  --runtime-id cursor-workstation-01 \
  --invitation-id <non-secret-invitation-reference>
```

Before sending a request, the helper generates an RSA proof key and atomically
claims the stable attempt identity in the native secure store. This cross-process
first-write preserves the same winning key if multiple setup processes race. The
private key remains protected in the OS store. It submits only the invitation
reference and public SPKI key. Its output is limited to
request ID, actor/runtime, state, verification code, public-key fingerprint,
approval path, capabilities, expiry, and whether a credential was saved. It
never prints the access credential or private key.

The founder reviews and approves the exact request in the authenticated
approval UI, checking actor, runtime, capabilities, verification code and key
fingerprint. Viewing that UI is not approval. Re-run the exact same setup
command after approval. It resumes the stored key and request, obtains a fresh
purpose-bound challenge, signs the canonical payload, and writes the issued
credential directly to the same scoped secure store. It does not issue another
key or change the request binding.

For a single resumable command, append `--wait`. Setup prints the verification
code/reference before opening the fixed approval URL with the OS browser
launcher, polls every five seconds for at most ten minutes, and proceeds when
approval is visible. At timeout it reports `pendingApproval: true` and
`connected: false`; rerun the same setup command later. If no browser launcher
is available, use the printed approval path in an authenticated browser.
Approval is still an explicit founder action.

If a request response is lost before its request ID can be saved, setup retains
the exact same protected key and invitation and retries that request. The
server contract returns the existing request only when the invitation and
public-key fingerprint match exactly; a different key remains a conflict. The
client regression test simulates the server committing the request and dropping
the first response, then verifies that a same-key retry resumes its request ID.
Do not change the key or runtime scope.

Check safe server state at any time:

```sh
node /approved/install/bin/holahola-onboarding.mjs status \
  --endpoint https://coordination.example \
  --actor luca-cursor \
  --runtime-id cursor-workstation-01
```

Denied, cancelled, expired, or revoked states are not retried or silently
overridden. A lost proof response or failed secure-store write retains the
original protected key and attempt; rerun setup to obtain a fresh recovery
challenge for the same enrolled request. Recovery after the original invitation
expires relies on the server allowing a `recover` challenge for that still
enrolled request; verify that server behavior before relying on post-expiry
recovery. A lost proof key requires explicit reauthorization.

## Credential stores

The helper has no plaintext or repository-file fallback:

- **Windows:** CurrentUser DPAPI with a new
  `%LOCALAPPDATA%\HolaHola\coordination-runtime-onboarding` namespace,
  restrictive owner-only ACLs, protected ACL inheritance, and reparse-point
  validation. This is separate from Coordinator V2 and Gate 3 storage.
  PowerShell receives secret values over stdin; command arguments contain only
  the fixed operation and adapter path.
- **macOS:** Generic passwords in the OS Keychain, accessed through the
  installed Swift toolchain and Security framework. Values go to the helper
  process over stdin, never argv.
- **Linux:** Secret Service via `secret-tool`; lookup/store data is scoped by a
  digest and values are supplied on stdin. A running Secret Service session is
  required. An exit-1 empty lookup is treated as a missing item only after a
  random non-secret store/lookup/clear health round-trip succeeds. Atomic
  first-write is serialized between processes with the `flock` utility (from
  util-linux) in a validated user-private runtime directory; inability to lock
  fails closed.
- **Hosted/process use:** `HostedRuntimeOnboardingStore` accepts an explicitly
  injected adapter only when it asserts `runtimeRestricted: true` and implements
  atomic `setIfAbsent`. The local CLI does not configure hosted secret services.

An unavailable native store, corrupt entry, unsafe Windows path/ACL, or failed
write stops the operation explicitly. There is no downgrade to files, `.env`,
shell profiles, process arguments, or printed credentials. OS encryption does
not protect against malicious code running as the same user, live process
memory inspection, or an enrolled client that intentionally discloses its own
credential.

## MCP stdio client

Generate non-secret client configuration from the installed executable:

```sh
node /approved/install/bin/holahola-onboarding.mjs mcp --print-config \
  --endpoint https://coordination.example \
  --actor luca-cursor \
  --runtime-id cursor-workstation-01
```

Merge the emitted JSON into the client's MCP configuration. The configuration
contains only the executable path and fixed `mcp` action plus endpoint, actor,
and runtime ID. It has no bearer header, token, private key, invitation, or
arbitrary command field. The IDE starts the verified helper executable. That
process reads/renews the scoped credential internally and forwards MCP JSON-RPC
to `/api/mcp/coordination` using an internal `Authorization: Bearer` header.
Protocol messages alone go to stdout; bounded, secret-free diagnostics go to
stderr.

Do not claim an IDE integration is connected merely because its configuration
was generated. Run the authenticated `sdk` action below and then verify the
actual client's connection independently.

## CLI authenticated coordination check (`sdk`)

The CLI `sdk` action is an authenticated read-only coordination check: it
confirms the actor identity from the coordination feed, initializes MCP, lists
registered tools, and calls `list_coordination_inbox` with a one-item limit.
It prints only actor/runtime and safe connection evidence; inbox contents are
not printed:

```sh
node /approved/install/bin/holahola-onboarding.mjs sdk \
  --endpoint https://coordination.example \
  --actor luca-openai-agents \
  --runtime-id openai-agent-local-01
```

It obtains the broker credential from the scoped secure store and renews it
through the existing broker renewal endpoint when needed. The isolated
fake-endpoint test needs no OpenAI user API key and does not call the OpenAI
platform API. REST coordination routes receive the supported
`x-coordination-token`; the MCP surface receives `Authorization: Bearer ...`.
The transport rejects other origins/paths. A separate OpenAI platform API key,
if required for model inference, remains the consumer's independent concern
and must never be substituted for or stored as a coordination credential.

The renewal exchange uses the existing broker API internally with
`x-coordination-token`; renewed credentials are persisted in the secure store.
The old credential is never printed or exported. Expired credentials use the
approved-key recovery challenge path.

### OpenAI Responses SDK adapter

The package also exports `createRuntimeOpenAIResponsesClient` from
`lib/runtime-onboarding-sdk.mjs`. It wraps an already-authorized OpenAI SDK
instance supplied by the host; it neither creates nor receives the host's
OpenAI API key. A caller uses the returned `responses.create(...)` method in
place of calling that SDK method directly:

```js
import OpenAI from "openai";
import {
  createNativeRuntimeOnboardingStore,
  createRuntimeOpenAIResponsesClient,
} from "/approved/install/lib/runtime-onboarding-sdk.mjs";

const sdk = new OpenAI(); // Configure its API key through the host's normal secret mechanism.
const store = createNativeRuntimeOnboardingStore();
const coordination = createRuntimeOpenAIResponsesClient({
  endpoint: "https://coordination.example",
  actor: "luca-openai-agents",
  runtimeId: "openai-agent-local-01",
  store,
  sdk,
});

const response = await coordination.responses.create({
  model: "your-configured-model",
  input: "Use the approved coordination tools if needed.",
});
```

The example's endpoint, actor, runtime, model, store, and SDK setup are
illustrative, not provisioned values. The caller must complete founder-approved
enrollment first and supply its own authorized SDK/store. The adapter obtains
the coordination credential only from that scoped store, renews/recoveries it
through the existing broker flow as permitted, and supplies it solely as the
fixed bearer header for the trusted `/api/mcp/coordination` remote MCP server.
It never returns, exports, or prints the coordination credential. User-supplied
MCP tools cannot replace the coordination tool; MCP approval is always
`require_approval: "always"`. `policy.allowedTools` can only narrow the remote
tool set; it cannot disable approval or grant broader authority. Calls still
depend on the actual OpenAI SDK and service being available; the hermetic tests
do not make a real OpenAI API call.

## Verification boundary

The focused server/client test files use isolated fixtures; the client and SDK
tests use fake endpoints/stores, and no test issues real credentials. The
package-builder test covers standalone output. These tests do not establish
live-device or live-provider compatibility:

```sh
npx tsx --test \
  server/services/runtime-onboarding.test.ts \
  server/services/runtime-onboarding-postgres.test.ts \
  server/services/runtime-onboarding-openai-sdk.test.ts \
  server/services/runtime-onboarding-restricted-credential.test.ts \
  server/scripts/runtime-onboarding-client.test.ts \
  server/routes/runtime-onboarding-routes.test.ts
node --test scripts/build-runtime-onboarding-package.test.mjs
```

They cover persist-before-request, interleaved setup/key winner preservation,
idempotent initial-request replay after a dropped response, durable-key
recovery after invitation expiry, Linux empty-store probing and cross-process
first-write, signature and challenge scope validation, secure-store
isolation/failure behavior, fixed MCP config, credential renewal, SDK transport
forwarding and OpenAI Responses tool/approval construction, backend routes and
durability invariants, and stdio protocol forwarding. These are commands for
the main verification pass; this document does not assert that the full suite
has passed. These tests do not perform enrollment or founder approval. Windows
DPAPI/ACL behavior, macOS Keychain access, Linux Secret Service availability,
and concrete Cursor/OpenAI clients require separate native-platform/client
smoke tests before they may be labelled verified.

The admin ledger-read badge is historical, server-derived evidence only: the
successful authenticated read routes (threads/inbox) record
`runtime_onboarding_ledger_read` for the matching enrolled actor/runtime. It is
not inferred from renewal, a client heartbeat, or `lastUsedAt`, and does not
prove a current connection. Inbox acknowledgement is a separate operation; it
does not authenticate the caller by itself and is not Coordinator V2 execution.