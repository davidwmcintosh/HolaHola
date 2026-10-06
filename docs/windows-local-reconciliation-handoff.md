# Local Windows reconciliation candidate — October 6, 2026

## Scope and source

This is a local manual reconciliation candidate, not a source-promotion,
runtime-publication or native Windows verification receipt.

Parents:

- Local: `f8ce2a15d00afefe707bec7ffa6759ac5c61596e`.
- GitHub: `e4aa4b17586996cf0291524513cbf4665ba031fb`.

Canonical preflight packet:
`71fc2ba9e419757d3b2430495c2ef3683cc4cf6f58845632d585a10755acfb69`.

The automated candidate stopped at the manual handoff-document policy. Its
failed outcome remains intact. This manual candidate does not replace that
outcome or claim an automated candidate passed.

## Resolution evidence

- Episode 34 was exported verbatim from its canonical database content after
  checking every nonblank source line from the conflicted replica was present.
  Zero source lines were missing. No canonical episode row was changed.
- Agent memory was regenerated from its canonical store. The reconciliation
  service's own proof confirmed the conflicted memory files retain both
  parents' new content.
- Alden's handoff was exported from its canonical shared-spec note. All 42
  lines added across both parents are present in the current export or its
  immutable revision history.
- All 73 lines added across both parents to the batch documentation remain.
- Dependency overrides retain both parents' nanoid, browserslist, xmldom and
  micromatch requirements. `npm ci --ignore-scripts --dry-run` passed.
- The reconciliation service confirmed generated mailbox pairs are canonical.
- The launcher matches the independently reviewed SHA-256:
  `2365a9f731e5d7bba81b7f5a0fa2444a8a183c225e59af182036cc178730a741`.

Candidate typecheck and the canonical reconciliation self-check passed.
Focused timestamp-replay and expired-recovery checks passed: 35 tests, zero
failures or skips. The final candidate outcome records these checks and the
merge parents. This is not full release validation or native Windows proof.

## Remaining stops

No main-branch landing, push, production deployment, runtime publication,
Windows execution, credential change or enrolled-host retry is authorized by
this candidate. Any later merged task or source edit requires a new exact-source
assessment before release preparation.

Native recovery and confidentiality proof remain separate downstream work.
Sandbox is optional, not a runtime requirement.
