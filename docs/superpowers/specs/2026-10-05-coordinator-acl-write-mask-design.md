# Coordinator V2 ACL write-mask correction

Date: 2026-10-05
Status: Design for independent and founder review; no implementation or rollout authorized by this record alone.

## Evidence and goal

LITTLENEMO credential recovery completed, but runtime initialization stopped at
`acl_write_unsafe`. A bounded native ACL probe found one untrusted Allow rule
granting `ReadAndExecute, Synchronize` and three trusted FullControl rules.
The current write mask includes FullControl and Modify, which include read
rights. Consequently a read-only rule can trigger the write rejection.

Allow that read-only rule without allowing untrusted mutation. Prepare only a
local correction and its tests; do not change the Windows host's ACLs.

## Alternatives

1. Correct the permission mask: selected; preserves legitimate read access and
   rejects the actual mutating rights.
2. Remove the native read-only ACE: rejected; changes the host rather than
   correcting the classifier.
3. Skip the guard: rejected; removes a protected integrity boundary.

## Exact correction

Change only the unsafe write mask in `Assert-SidAcl` to the bitwise union of
these primitive FileSystemRights values:

- WriteData
- AppendData
- WriteExtendedAttributes
- DeleteSubdirectoriesAndFiles
- WriteAttributes
- Delete
- ChangePermissions
- TakeOwnership

Do not include FullControl, Modify, or other composite grants in the mask.
FullControl and Modify ACEs still fail for untrusted principals because they
contain the primitive mutating bits.

Keep the current owner allowlist, trusted-writer SID allowlist, both rejection
branches and error codes, all call sites, and conservative Deny/InheritOnly
handling. Keep reparse, owner, source, signature, manifest, freshness, and DPAPI
checks unchanged. Do not change the separate HTTP-factory ACL predicate or
introduce any policy, credential, schema, session, or publication behavior.

Read-only access to encrypted DPAPI material does not grant decryption authority;
DPAPI CurrentUser remains the confidentiality boundary. Untrusted modification
of that material and its containers remains prohibited. No path-specific bypass
or new exception is introduced.

## Tests and verification

Add a focused PowerShell ACL test script, invoked by the existing
`scripts/test-hola-coordinator-reauthorization.ps1` Windows entrypoint.
The existing GitHub `test-windows-powershell` job executes that entrypoint
using Windows PowerShell, not PowerShell 7.

Execute the real guard with native ACL fixtures in an owned disposable
directory. Establish explicit trusted permissions before introducing test ACEs.
Use a synthetic nonmember SID so mutation and denial fixtures do not grant or
deny access to the test runner. Clean up only the created fixture tree.
Never touch a checkout's real ACL, enrolled host state, or credentials.

Cover:

- untrusted ReadAndExecute plus Synchronize, and individual read-only rights;
- each of the eight primitive mutating rights, separately;
- untrusted Write, Modify, FullControl, and mixed read/write grants;
- trusted FullControl and preserved owner rejection;
- preserved conservative treatment of mutating Deny/InheritOnly rules;
- the same classifier for disposable directory and file paths.

Owner-rejection cases may use native security descriptors in memory without
changing a real fixture's owner. Label those cases accurately, not as real
ownership changes. Verify unchanged reparse and unrelated custody code through
the existing contract checks.

Add regression detection for both directions: reintroducing FullControl in the
mask must fail the read-only case; omitting a mutating bit must fail its
rejection case. Local source/contract checks are supplementary, not native
Windows evidence.

Run focused local contract tests, typecheck, and required system-health checks
after implementation. Real Windows PowerShell 5.1 CI evidence remains required
before claiming native acceptance.

## Review and publication gates

The founder approved preparing the narrow correction for review. This written
design still requires founder review before implementation. Independent review
must be recorded against this exact immutable shared-spec revision.

Implementation, if approved, remains local-only until reviewed validation and
fresh exact-source GitHub-to-Render publication. Stop for founder source and
runtime publication; do not reuse old release receipts for changed bytes.
Only afterward may the host fast-forward to the newly approved source and retry
runtime initialization. No coordinator session is part of this correction.
