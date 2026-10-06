# Expired bootstrap recovery — design approval record

## Exact independently reviewed design

- Path: `docs/superpowers/specs/2026-10-05-runtime-expired-bootstrap-recovery-design.md`
- Shared-spec document: `7273cc9e-41a9-4bed-bc4b-39f7b8b8316d`
- Immutable revision: `689752d8-ea91-47a0-b3eb-30c94a8c4b90`
- SHA-256: `91d134fb93348d92ab13145bd6dafb85990fe4fa2f73a07e7c2abe1e4590f29c`
- Independent review: `38fc6a1f-abd8-4ee9-845a-a59d2feed160`
- Reviewer / decision actor: `alden`
- Decision: unconditional approval, stored at `2026-10-06T05:47:07.261Z`.

The author read back the durable review and document records and verified
revision/hash binding before exporting the unchanged approved design. Review
approval is not inferred from a consultation response.

## Founder policy approval

On October 5, 2026 (America/Denver), the founder answered:

> Question: Do you approve the reviewed expired-response recovery policy?
>
> Which recovery policy do you approve?: Approve bounded automatic recovery
> (recommended) (raw: "approve_bounded_recovery")
>
> Additional comments: (not provided)

The question identified the design by filename and explicitly limited approval
to policy, not implementation or Windows execution. The preceding explanation
stated that a well-formed but signature-invalid expired response could trigger
one new authenticated issue request, but could not authorize installation.

This approval accepts the exact reviewed policy: DPAPI evidence retention,
one durable successor per expired generation, bounded rotation, independently
proved installed baseline, unchanged fresh-install checks, and fresh
exact-source plus runtime founder-only publication gates before any changed
launcher is exercised on Windows.

## Delivery and remaining stops

Task 1707 delivers the design only. No launcher/service/schema changes, runtime
issuance, production runtime/host-record repairs, Windows execution, or
coordinator sessions were performed for this task.

Typecheck passed. Native Windows fixtures, disposable PostgreSQL tests, and
mutation checks are specified, not implemented or claimed as passing.
Implementation requires a separately authorized task and implementation
review. Fresh exact-source and runtime publication, synthetic native Windows
validation, and separately authorized enrolled-host retry remain outstanding.
Nothing in this approval permits credential clearing, operator-supplied
replacement request keys, expiry renewal, or trust/ACL/policy relaxation.

## Scope attribution for completion review

The first completion review compared a broader history that included existing
executable timestamp-repair work and a package edit. Those are not changes
made or authorized by this design task. Do not remove or approve them as part
of this deliverable.

Verified from the actual Git history:

- `2dae75811dd426cc8f56db2aea270b2aa83cf181`, committed at
  `2026-10-06T03:33:25Z`, contains the executable timestamp repair, helper,
  replay/PostgreSQL tests, and CI wiring. All six files in that commit are
  unchanged between that commit and this task's design-delivery commit.
- `55811bc0bd1e45956c20af3162430371ecd18ad4`, committed at
  `2026-10-06T05:36:05Z`, contains the unrelated `package.json` edit. It is
  already the shared `main-repl/main` baseline and is not changed by this task.
  This receipt makes no correctness claim about its duplicate `overrides` key.
- The design export was committed at `2026-10-06T05:48:25Z`; the approval
  receipt and DB-generated memory-policy addition at `2026-10-06T05:51:21Z`.
  From the shared baseline above to that design delivery, changes are the
  design, this receipt, the memory topic, and shared-spec review-generated
  mailbox metadata. There are no executable or package changes.
- `scripts/hola-coordinator.ps1` is unchanged throughout these commits.

These commit references are scope evidence, not source/runtime publication
receipts, authorization for the earlier implementation, or deployment proof.
Review this task's design-only changes against the verified shared baseline;
the separate executable repair retains its own review/publication obligations.
