# Windows coordinator and historical Gate 3 runbook

## Current Coordinator V2 operator path

Do not begin a current run with the legacy Gate 3 Phase A/Phase B procedure.
After protected publication, production verification, founder policy approval,
operator grant, compatible host enrollment, and same-user local credential
preparation, run:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

Run it once. Do not copy any preparation, session, attempt, lease, claim,
challenge, receipt, digest, provider, host, path, command, or credential
identifier into the command. The server creates and reconciles those values
from PostgreSQL.

Founder policy approval and operator launch are separate actions. Policy
approval defines provider order, adapters, budgets, paths, commands, and host
constraints. Launch selects only the task and, optionally, an already approved
policy. The host cannot select providers, retries, fallback, or execution
authority.

The command may report:

`preparing`, `ready`, `running`, `waiting_for_host`, `verifying`, `succeeded`,
`failed`, `exhausted`, `expired`, `revoked`, `cleanup_pending`,
`preflight_failed`, `host_unavailable`, or `invalid_request`.

Exit `0` requires `succeeded` plus acknowledged cleanup. Retry and recovery use
the classifications `resume_transport`, `fresh_attempt_same_provider`,
`fresh_attempt_next_provider`, `terminal_failure`, and `cleanup_repair`.

See:

- [Coordinator V2 architecture](coordination-v2-architecture.md)
- [Host protocol](coordination-v2-host-protocol.md)
- [Recovery runbook](coordination-v2-recovery-runbook.md)

## Windows custody boundary

The fixed launcher requires Windows PowerShell 5.1 and protects its local
credential with DPAPI `CurrentUser`. The credential can be used only by the
same Windows user who prepared it. This does not establish containment against
malicious software already running as that user.

Linux validation proves source, protocol, and fail-closed behavior. It cannot
prove real DPAPI execution, Windows ACL behavior, or PowerShell 5.1 acceptance;
that evidence belongs to the later real-Windows milestones.

## Historical Gate 3 record

The former Gate 3 path used
`server/scripts/coordination-runtime-antigravity.ts`,
`scripts/antigravity-gate3.ps1`, a public preparation bundle, founder-approved
challenge, Phase A/Phase B provisioning, and a bounded driver. Its receipts,
challenges, registrations, windows, claims, digests, grants, bootstrap
exchanges, and acceptance logs remain preserved provenance.

They are not current authority. They cannot:

- approve a Coordinator V2 policy;
- satisfy an operator grant;
- enroll or authorize a V2 host;
- launch, resume, retry, or fall back a V2 session;
- authorize cleanup;
- satisfy fresh real-Windows acceptance.

Do not transfer a historical public bundle or non-secret identifiers into V2.
Do not replay an uncertain bootstrap or child effect. A current V2 run creates
fresh authority only after the reviewed implementation is promoted and
production is verified.

Cancelled legacy activation work remains cancelled. Separately owned work
remains untouched and provides no Coordinator V2 authority.
