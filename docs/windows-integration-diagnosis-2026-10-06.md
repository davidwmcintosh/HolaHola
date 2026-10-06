# Windows integration diagnosis — October 6, 2026

## Scope

Founder authorized Luca to lead the investigation in the main workspace.
Publication, native Windows execution, credential changes and enrolled-host
retry remain behind their existing separate approval stops.

## Stored manifest evidence

Two read-only transactions queried the application's existing Neon database.
No issue, release, host, credential or acknowledgement row was changed.

Nine existing bootstrap issues were inspected. Reconstructing their manifests
from current issue, release, host and artifact metadata produced these results:

| Reconstruction | Matches stored manifest digest |
| --- | --- |
| Preserve both timestamp millisecond values | 0 of 9 |
| Truncate issuedAt only | 0 of 9 |
| Truncate expiresAt only | 0 of 9 |
| Truncate both timestamps to whole seconds | 9 of 9 |

All nine inspected issues were expired. Request keys, credentials, proofs,
private keys and host identifying values were not printed or saved here.

The deployed release uses `new Date(String(value))`. At initial creation,
JavaScript Date values lose milliseconds through this string round-trip.
The application's actual Drizzle/Neon raw-query adapter was separately checked
inside a read-only transaction: it returns persisted timestamp values as
strings, retaining milliseconds. Thus replay reconstructs different timestamp
bytes than issuance, despite representing the same database records.

Plain node-postgres returns Date objects for those columns; using that driver
alone masks the replay mismatch. Its round-trip result is not a substitute for
checking the application's actual adapter.

The existing compatibility selector accepts a whole-second reconstruction only
when its complete digest equals the original stored digest. This supports the
existing timestamp repair, not fuzzy canonicalization, renewed expiry, changed
historical evidence or another authentication patch.

Limitation: the captured Windows request was not explicitly mapped to an issue
using its private persisted request key during this investigation. The same
timestamp-only mismatch was reproduced across all nine inspected issues; this
is not a new execution of the captured Windows request.

## Source and release evidence

Live production `/health/release` reported build-authoritative commit
`912016b987260f105c030431b4aebd511ee3d815`.

Main workspace:
`504db93f5ce8f957bd1aa322e8b0be93dcf6c540`.

A fresh authenticated GitHub API read returned:
`e4aa4b17586996cf0291524513cbf4665ba031fb`.

Those exact local/GitHub commits have five local-only and twenty GitHub-only
commits. The old `origin/main` tracking reference did not represent live GitHub.
The tracked worktree was clean before investigation.

Canonical source reconciliation preflight and inspection succeeded for packet
`ae7fadfa2c95dbe0a15c21b1b2af7d4a4c5fe8a4fbd198619c582e66c3a55afa`.
Preflight reported no findings; inspection included all 25 unique commits.
This is inspection evidence, not a validated merged candidate or release
approval. No candidate landing, merge, push or publication occurred.

Ambient SSH access initially blocked read-only inspection through a host-key
prompt, including partial-clone hydration. A process-only HTTPS URL rewrite,
the established GitHub App authentication path, and disabled interactive
prompts allowed canonical inspection. No persistent remote/configuration or
SSH trust setting was changed.

## Next bounded sequence

1. Preserve both source histories and review candidate reconciliation.
2. Reconcile locally through the canonical procedure; verify Windows launcher
   bindings and generated canonical records, without bundling unrelated work.
3. Settle exact source before fresh release validation and founder approval.
4. Publish source/application and matching runtime only at the separate
   founder-authorized stops.
5. Run the authorized disposable native recovery/confidentiality proof.
6. Retry the enrolled host only with separate authorization.

Windows Sandbox is an optional disposable validation environment, never a
product/runtime requirement. A clean sandbox does not inherit host credentials,
certificate trust, revocation caches or host-installed LLMs; tests must account
for these differences without weakening security checks.
