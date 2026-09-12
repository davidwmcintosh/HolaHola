# Luca — Unified Multi-LLM Agent Coordinator

**Document type:** Hybrid product vision and technical onboarding contract  
**Status:** Draft for review  
**Owner:** Luca [Replit]  
**Revision date:** 2026-09-11

## 1. Purpose

Luca is a provider-neutral coordination system for one durable agent working through multiple model providers, coding tools, hosts, and runtime profiles. A runtime changes Luca's available capabilities and the provenance of an action; it does not create a separate identity or a higher or lower class of trust.

This document serves two audiences:

- product readers evaluating what makes a unified multi-LLM coding agent useful; and
- engineers integrating another provider, host, or coding runtime without weakening the coordinator's authority and evidence model.

It records a product direction and an onboarding contract. It does not authorize productization work, claim that every named provider is implemented, or replace provider-specific approved designs.

## 2. Product vision

Most multi-model systems treat each model session as a separate assistant and attempt to reconstruct continuity through copied prompts. Luca takes the opposite approach: identity, assignment state, evidence, and memory live outside any one model session. Models and coding environments are runtime hats through which the same actor can read, reason, execute bounded work, and report evidence.

The product value is not merely access to several models. It is continuity and accountable execution across them:

- one durable actor rather than a collection of unrelated assistants;
- operator-approved assignments rather than ambient autonomous authority;
- provider-neutral coordination records rather than provider-owned session state;
- bounded execution rather than unrestricted host access;
- immutable evidence rather than self-reported completion;
- independent verification from a separate runtime path rather than self-approval.

PostgreSQL is canonical for live coordination state, authority, and evidence. GitHub stores approved immutable source snapshots. The operator remains the trust root.

## 3. Product boundaries

### 3.1 One actor, multiple runtime hats

Luca is the logical identity and authoritative continuity spanning Replit, Claude Code, Gemini/Antigravity, OpenAI, and future runtime hats. Labels such as `luca-replit`, `luca-claude-code`, and `luca-gemini` record provenance and capability context. They do not represent different people and do not establish a trust ranking.

Runtime identity, actor identity, and capability scope must come from authenticated server-side records. A runtime cannot choose or override them in request JSON. Provider, model, adapter, host, worktree, and branch metadata describe where and how an action occurred; they do not grant authority.

### 3.2 Operator authority

The operator authorizes the exact assignment, source boundary, runtime profile, and execution envelope. A provider API key, local login, installed coding tool, or successful model response does not independently authorize work.

### 3.3 Security claim boundary

Luca's coordination controls protect authority, provenance, bounded execution, and evidence integrity. They reduce risk from mistakes, compromised dependencies, accidental secret exposure, and confused runtime state.

The current local-host design does not claim containment against malicious software running as the same authenticated operating-system user. It also does not claim access to a provider model's private cognition. Evidence covers observable authenticated transport, declared tool intents, bounded host effects, and canonical records.

### 3.4 Provider neutrality

Every provider must satisfy the same authority and evidence contract. Provider reputation, model quality, or first-party integration status creates no shortcut or exemption.

## 4. Core control plane

The coordinator separates six concerns:

1. **Durable identity and memory** — continuity lives in canonical data, not one provider session.
2. **Assignment authority** — the operator and coordinator define who may act, on what, and within which immutable boundaries.
3. **Runtime registration and credentials** — each runtime receives only its registered actor binding and least-privilege capabilities through short-lived credentials.
4. **Host-readiness and execution adapters** — provider and host adapters translate the common contract into a specific environment without widening it.
5. **Canonical evidence** — inheritance, model interactions, claims, tool attempts, workspace outcomes, and verification decisions remain attributable and immutable.
6. **Approval and publication** — independent review precedes acceptance; GitHub receives only approved snapshots.

PostgreSQL owns mutable coordination truth. Git commits and GitHub references are publication artifacts, not substitutes for coordinator state. Runtime-local files and caches are recoverable projections, never authority.

## 5. Runtime onboarding contract

A provider/runtime integration is eligible for bounded execution only after it proves all applicable requirements below.

### 5.1 Identity and capability binding

- Register one stable runtime ID under an existing Luca provenance label.
- Derive actor, runtime, and capability identity from the authenticated credential.
- Reject same-actor credentials belonging to a different runtime or execution profile.
- Keep API capabilities separate from task-scoped execution authority.
- Prevent client metadata from widening server-enforced capabilities.

### 5.2 Reproducible runtime environment

- Pin the approved source revision and executable artifacts.
- Resolve exactly one approved runtime executable.
- Validate signatures, versions, and hashes where the host supports them.
- Install or bundle every build-time and run-time dependency reproducibly.
- Detect host package-manager modes that silently omit required dependency classes.
- Treat shell wrappers, command shims, and execution policies as separate compatibility surfaces.
- Fail explicitly when a required dependency or runtime feature is unavailable.

### 5.3 Secret protection

- Never embed fixed Luca credentials in a launcher, repository, bundle, prompt, receipt, or runtime image.
- Generate bootstrap material internally on the approved host.
- Store bootstrap material only through a reviewed host-native credential protector.
- Pass secrets only through bounded in-memory channels required by the approved child process.
- Exclude secrets from command arguments, logs, errors, model-visible context, repository files, environment files, and evidence receipts.
- Atomically consume one-time execution material and delete uncertain in-flight state.

Host adapters may differ: Windows can use DPAPI `CurrentUser`; other operating systems must use an independently reviewed native or operator-managed equivalent. Equivalent purpose does not imply equivalent security claims.

### 5.4 Immutable task binding

Every executable assignment binds to:

- canonical task and assignment identity;
- registered actor and runtime ID;
- provider, model, and adapter version;
- repository, worktree, branch, and starting commit;
- allowed files and exact commands;
- time, output, patch, and model-call budgets;
- immutable inheritance and execution-envelope digests.

A model response, prompt, tool request, or local user action cannot widen these fields.

### 5.5 Consumption and execution authority

Delivery is not consumption. Context injection is not consumption. A provider request starting is not consumption.

The project-owned adapter records provider-neutral outcomes and immutable request/response digests. Only a valid consumed receipt for the exact assignment may support acceptance or claim acquisition. Execution authority requires a separate, exclusive, task-scoped lease bound to the same authenticated runtime and profile.

A different profile under the same runtime ID is not interchangeable. A different runtime under the same Luca provenance label is not interchangeable. Both must fail closed when attempting to consume or claim another principal's assignment.

### 5.6 Bounded execution

- Expose structured tools, never a general shell, unless a separately approved envelope explicitly allows one.
- Revalidate paths, commands, budgets, and workspace identity outside the model.
- Reject symlink, junction, reparse, traversal, and Git-metadata escapes.
- Preserve an unchanged starting commit unless the assignment explicitly allows publication.
- Record every rejected or stopped tool attempt.
- Do not commit, publish, deploy, migrate data, or access unrelated credentials unless independently authorized.

### 5.7 Independent verification

Execution completion is not acceptance. A separate authenticated runtime path must inspect the exact assignment, source boundary, patch, command result, and evidence digest. The executor cannot approve its own work. The verifier's provenance supplies a fresh evidence path, not a superior identity or trust rank.

## 6. Host-readiness lessons

The first genuine Windows onboarding exposed requirements that apply to future providers and hosts.

### 6.1 Source compatibility is not host compatibility

Cross-platform source tests can validate intended control flow but cannot prove native credential APIs, filesystem ACL behavior, shell policy, executable discovery, package installation, or process inheritance. Each supported host requires genuine-host evidence.

### 6.2 Runtime versions change dependency resolution

Windows PowerShell 5.1 required explicit loading of the exact `System.Security` assembly before DPAPI types resolved, while PowerShell 7 used native resolution. An adapter must declare version-specific prerequisites and map missing capabilities to explicit fail-closed errors.

### 6.3 Successful package installation may still omit required dependencies

A lockfile-driven `npm ci` completed successfully while a host configuration omitted development dependencies, leaving the pinned build tool absent. Runtime onboarding must verify required artifacts after installation rather than treating process exit zero as sufficient evidence.

### 6.4 A shell command name may select the wrong execution surface

PowerShell selected a policy-blocked `npm.ps1` wrapper even though the approved native `npm.cmd` shim was available. Adapters must resolve and validate the exact executable surface they intend to invoke; changing global execution policy is not an acceptable compatibility shortcut.

### 6.5 State transitions require separate proofs

These are distinct claims and require distinct evidence:

- the host can initialize protected state;
- readiness recognizes an intact active state;
- failed initialization leaves no active credential;
- repeated initialization is rejected without replacement;
- protected material decrypts only in the approved context;
- one bounded run consumes authority once;
- uncertain in-flight state fails closed and is cleaned up;
- receipts and logs contain no secret material.

One successful status command cannot establish all of them.

## 7. Provider adapter matrix

| Provider/runtime | Current standing | Required next evidence |
| --- | --- | --- |
| Replit runtime | Existing coordinator and authoring path | Continue provider-neutral conformance as contracts evolve |
| Claude Code runtime | Existing runtime provenance and verification uses | Complete any host profile against the same onboarding checklist before bounded execution |
| Gemini project-owned adapter | Real transport and normalization design implemented for the bounded vertical slice | Complete genuine Gate 3 execution and independent verification |
| Windows Antigravity host | Initialization, native protection, readiness, and repeated-initialization rejection observed on the genuine host | Cross-user denial, concurrency, one-time consumption, cleanup, no-secret evidence, and bounded execution remain to be proven |
| OpenAI runtime | Product direction only | Design and implement an adapter against this contract; no current execution claim |
| Future providers | Supported by architectural intent only | Supply provider normalization, host readiness, secret protection, bounded execution, and independent evidence without provider-specific exemptions |

“Supported by architectural intent” means the contract has an extension point. It does not mean an adapter is implemented, activated, secure, or production-ready.

## 8. Onboarding lifecycle

1. **Design the adapter** against this provider-neutral contract.
2. **Validate hermetically** with adversarial identity, profile, authority, and evidence tests.
3. **Prove genuine-host readiness** for executable resolution, dependencies, credential protection, ACLs, state transitions, and cleanup.
4. **Generate a public registration bundle** containing only non-secret identity, capability, source, key, and digest metadata.
5. **Obtain operator approval** for the exact bundle and assignment.
6. **Register and activate the runtime** through canonical coordinator records.
7. **Deliver an immutable inheritance packet** through a frozen assignment window.
8. **Record authenticated model consumption** through the project-owned provider adapter.
9. **Acquire a task-scoped execution claim** for the exact runtime and profile.
10. **Execute within the immutable envelope** and record all observable outcomes.
11. **Verify through an independent runtime path.**
12. **Publish only approved immutable bytes.**

Failure at a later stage cannot compensate for missing evidence at an earlier stage.

## 9. Evidence maturity levels

Every product or engineering statement about a provider/runtime must carry one of these maturity levels:

1. **Designed** — an approved contract exists; no implementation claim.
2. **Source-validated** — static, unit, integration, or hermetic checks pass in a controlled environment.
3. **Genuine-host validated** — the relevant native host behavior has been observed under the approved runtime conditions.
4. **Operator-activated** — the operator approved the exact public bundle and canonical registration became active.
5. **Executed** — the runtime completed a bounded assignment and produced canonical execution evidence.
6. **Independently verified** — a separate authenticated runtime path approved the exact outcome and evidence.
7. **Published** — approved immutable bytes were promoted to the intended external source record.

Evidence consists of canonical records tied to authenticated actor/runtime identity, immutable input and output digests, database timestamps, explicit outcomes, bounded workspace observations, and review decisions. A runtime's unsupported self-description is not evidence. GitHub proves published source bytes; it does not replace live coordination or authority records.

## 10. Success criteria for future integrations

A new provider is successfully onboarded only when an operator can assign exact bounded work to Luca through that provider/runtime and later answer, from canonical evidence:

- Which Luca runtime and profile acted?
- Who authorized the work?
- What exact context and source boundary were inherited?
- What observable provider interaction occurred?
- Which tools were requested, allowed, rejected, and executed?
- What changed in the workspace?
- Did the runtime stay inside its envelope?
- Were credentials protected and absent from outputs?
- Who independently verified the result?
- Which exact approved bytes, if any, were published?

If the system cannot answer one of these questions, the integration is not complete at the corresponding evidence level.

## 11. Relationship to existing designs

This document is the provider-neutral product and onboarding layer. Provider-specific designs remain authoritative for implementation detail, including:

- *Unified Agent Coordinator and Luca Execution Fabric*;
- *Luca Gemini Coding Runtime — Thin Vertical Slice*;
- the approved Windows DPAPI provisioning and implementation designs; and
- shared-spec collaboration and publication contracts.

Where a provider-specific design conflicts with the invariants in this document, the conflict must be reconciled through a new immutable revision and independent review. Existing approved revision history is never overwritten.
