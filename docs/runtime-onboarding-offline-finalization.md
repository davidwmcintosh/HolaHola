# Offline Windows package finalization

This is a separate, operator-invoked verification/finalization step, not a
signing feature or release approval. The unsigned builder remains unsigned.
No acquisition, signing, trust-store change, execution-policy change, archive,
transfer, smoke invocation, enrollment or publication is performed.

## Design and review boundary

The finalizer runs from an independently reviewed tooling checkout, never from
the downloaded package. An independently delivered approval document is pinned
by its exact SHA-256 on the command line. It approves only finalization of one
staged package: original unsigned manifest, exact original helper, source
revision/development flags, every post-signing file, signer subject/certificate
SHA-256, and timestamp policy. Approval must come from an authorized person;
the tool cannot establish human authorization from JSON alone.

Only the helper may differ from the original manifest. Its unsigned executable
prefix must be byte-identical to the independently pinned original helper;
only one appended terminal Authenticode comment block is allowed. No newline,
BOM, trailing whitespace or executable-text normalization is accepted. If a
signing tool rewrites the prefix, stop and prepare/review a new unsigned build.
The historical pilot's normalized comparison is not this stricter proof.

Windows verification uses WinVerifyTrust with cache-only URL retrieval and
whole-chain revocation checking (excluding the trusted root). A missing cached
revocation result fails closed: this offline operation never fetches fresh
CRLs or establishes fresh online revocation evidence. Any separately authorized
cache preparation is outside this tool. Windows validates the embedded
signature, chain and any timestamp. Timestamp attributes must agree with a
successful Windows trust-provider countersigner/chain result; an ignored bad
timestamp is not accepted merely because the current signature is valid.
The embedded CMS signer certificate is
independently pinned. Timestamp presence is determined from countersignature
attributes, not a signature-looking comment. `required` requires a timestamp
and successful native validation; `absent-internal-pilot` requires no timestamp
and is explicitly bounded by signer validity. Neither mode proves publisher
approval for unattended PowerShell execution or expiry-safe distribution.

The package must contain exactly the five builder payloads plus manifest.json.
No runner, approval JSON, certificate or receipt is put in that directory.
Reject extra files/directories, unsafe manifest paths, duplicates, symlinks,
reparse points and hard links. Finalization preserves original provenance and
adds the pinned unsigned manifest and approval identities to the final
manifest. Only manifest.json is replaced, after successful checks and a second
complete file snapshot; payload bytes, download marks, ACLs and timestamps are
not rewritten. Operator-exclusive staging is required; rehashing detects
observed changes, not a malicious process racing every filesystem operation.

Verification is read-only, requires an independently delivered final manifest
SHA-256 and repeats every check. It never repairs a stale manifest. Receipts on
stdout contain final manifest/file hashes; independently approve and deliver
them before separately authorized packaging/transfer. A receipt from the same
untrusted download is not a trust anchor. ZIP hashes and runner pins remain
separate obligations under docs/runtime-onboarding-clients.md.

Hermetic tests inject a synthetic native-verification result only through the
library API; the CLI has no fixture, bypass or imported-evidence mode. Tests
must prove stale hashes, altered helper logic even with updated pins, mismatched
signer, unsigned helper, unsafe file sets and observed mid-probe mutation fail.
They do not constitute native Windows signing/download evidence.

## Operator inputs and commands

Use independently trusted Node.js 20+ and an independently reviewed checkout
of these tools on native Windows. Keep the tooling outside the package. The
PowerShell probe must itself be runnable under existing policy; there is no
Bypass, unblocking, online lookup or policy-change fallback.

1. Build to a **new/empty** directory with
   `node scripts/build-runtime-onboarding-package.mjs --output <staging>`.
   Keep its manifest and unsigned helper as external baseline files before any
   separately authorized signing. The builder refuses any nonempty destination.
   Its `--release` flag proves only a clean checkout, not release authorization.
2. Independently approve the original manifest/source flags and helper, and
   separately authorize external signing of the exact staged helper. This tool
   neither carries out nor authorizes that operation.
3. Independently verify/approve the signed helper pin, unchanged payload pins,
   signer identity and timestamp policy. Obtain the approval JSON below from
   that independent channel along with its exact SHA-256. Do **not** generate
   approval by blindly trusting a staged package's own files.
4. After separate finalization authorization, invoke:

   ```text
   node scripts/finalize-runtime-onboarding-package.mjs finalize --package <staging> --approval <external-approval.json> --approval-sha256 <independent-approval-hash> --unsigned-manifest <external-original-manifest.json> --unsigned-helper <external-original-helper.ps1>
   ```

   Capture stdout's receipt outside staging. Independently approve/deliver its
   final manifest and payload hashes; no archive or transfer is produced.
5. Read-only verification, with the independently supplied final manifest pin:

   ```text
   node scripts/finalize-runtime-onboarding-package.mjs verify --package <staging> --approval <external-approval.json> --approval-sha256 <independent-approval-hash> --unsigned-manifest <external-original-manifest.json> --unsigned-helper <external-original-helper.ps1> --manifest-sha256 <independent-final-manifest-hash>
   ```

Both commands return nonzero on refusal; no receipt means no verified outcome.
`verify` never repairs a manifest. `finalize` refuses an already-finalized
package: use verification, or start a separately approved new build. Never
re-sign, normalize or change a payload after finalization.

The approval's exact schema is below. Angle-bracket values are explanatory
placeholders, **not usable pins or authorization**. All hashes must be lowercase
64-character SHA-256; file byte counts must be actual positive integers. All
five file entries are mandatory and unique. `sourceDirty` and `release` must
match the pinned original exactly; a development build cannot become a release.

```json
{
  "format": "holahola-runtime-onboarding-finalization-approval/v1",
  "approvalId": "<independent operator approval reference>",
  "unsignedManifestSha256": "<original manifest SHA-256>",
  "sourceRevision": "<original 40-character source revision>",
  "sourceDirty": true,
  "release": false,
  "files": [
    { "path": "bin/holahola-onboarding.mjs", "bytes": 1, "sha256": "<unchanged CLI hash>" },
    { "path": "lib/runtime-onboarding-sdk.mjs", "bytes": 1, "sha256": "<unchanged SDK hash>" },
    { "path": "scripts/runtime-onboarding-native-store.ps1", "bytes": 1, "sha256": "<externally signed helper hash>" },
    { "path": "package.json", "bytes": 1, "sha256": "<unchanged metadata hash>" },
    { "path": "README.txt", "bytes": 1, "sha256": "<unchanged README hash>" }
  ],
  "signer": {
    "subject": "<exact Windows certificate Subject>",
    "certificateSha256": "<SHA-256 of raw DER signer certificate>",
    "timestampPolicy": "required"
  }
}
```

Use `absent-internal-pilot` only with explicit approval for an untimestamped
bounded internal pilot, never as an automatic retry when a required timestamp
fails. This tool never supplies a historical pilot's pins as defaults. The
receipt is a verification result, not authority to sign, install trust, privately
transfer, run a native smoke or publish. Approval JSON and retained baselines
are external verification inputs, not distributable package payloads.