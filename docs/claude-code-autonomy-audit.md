# HolaHola Autonomy Audit

**Audit date:** 2026-08-21  
**Purpose:** Establish the real distance between the current HolaHola system and an externally controlled development/runtime environment.

This is an operational audit, not a commitment to a particular replacement for Replit. Claude Code, Cursor, Antigravity, and other coding agents should be interchangeable once the repository, data, runtime, and memory systems are independently controlled.

## Executive assessment

### Current conclusion

HolaHola is **closer to external development autonomy than a fresh migration**, especially in code, database, object storage, and AI-provider configuration. Development autonomy and production-hosting autonomy are separate decisions.

The immediate target is:

1. owner-controlled local development and coding-agent work;
2. owner-controlled GitHub source;
3. one shared external Neon/R2 data plane used by development and production;
4. Replit retained as a managed production host;
5. an external production runtime evaluated later only if its benefits justify the work.

The required first gates are development and data portability—not a VPS cutover:

1. prove the repository can be cloned from the owner-controlled source;
2. prove the local environment builds, tests, and runs the application;
3. prove the shared external database and object storage are sufficient;
4. prove local development can use the same Daniela knowledge and write durable results back to that shared data plane;
5. document Replit production as a deployable, replaceable target.

If those gates pass, we can use whichever coding agent is best. A Replit-shell Claude Code installation is optional and should not be required for either development or production.

## Autonomy model

Autonomy is evaluated in layers. Moving the coding agent alone does not move the system.

| Layer | Desired owner-controlled state |
|---|---|
| Source | Repository and history can be cloned and pushed without Replit |
| Build | Dependencies, scripts, migrations, and tests run from a normal Node environment |
| Development agent | Claude Code, Cursor, Antigravity, or another agent can be swapped without changing application architecture |
| Shared data plane | Development and production use the same canonical external memory, episode, capture, and embedding data |
| Memory | Conversation memories, Luca memory, episodes, raw evidence, and embeddings are independently backed up and retrievable |
| Assets | Images, captures, voice notes, and other objects live in portable object storage |
| Secrets | Credentials are held in an owner-controlled secret manager |
| Runtime | Server, workers, scheduled jobs, and logs run outside Replit |
| Identity | Authentication does not require Replit OIDC |
| Delivery | Domain, webhooks, deployment, and rollback do not require Replit |
| Model access | AI providers are configured behind replaceable adapters with direct-key or independently managed access |

These layers are independent decisions. We can achieve source, development-agent, memory, asset, and model-access autonomy while continuing to use Replit for managed production hosting.

## Status vocabulary

- **Verified:** observed in the current checkout or proven by a runnable check.
- **Documented:** stated in project documentation but not re-proven during this audit.
- **Portable path exists:** the code or scripts contain a non-Replit route, but it still needs an end-to-end test.
- **Replit-dependent:** the current production/development path requires Replit.
- **Unknown:** evidence is insufficient; do not treat this as complete.

## Current-state audit

### 1. Source repository

**Status: PARTIALLY VERIFIED**

What exists:

- The project is a normal Git repository with source, migrations, scripts, tests, and documentation.
- `scripts/sync-to-github.sh` and `scripts/sync-from-github.sh` exist.
- The scripts target `github.com/davidwmcintosh/HolaHola.git` and use a `GITHUB_TOKEN` secret.
- A `github` remote is configured and tracks the `main` branch.
- The application source is not structurally tied to Replit's editor.

What is not yet proven:

- The current checkout has many Replit-internal remotes alongside the GitHub remote. The purpose and retention policy for those remotes should be documented before declaring GitHub the sole source of truth.
- The configured GitHub remote currently uses an embedded credential. Do not copy it into any document or new host configuration. Rotate that credential, remove it from the Git configuration, and use SSH or an owner-controlled credential helper instead.
- Remote tracking proves a configured path, not that all relevant history, branches, tags, and assets have been independently backed up.
- A clean clone from GitHub has not yet been built and started on the owner's computer.

Required proof:

```bash
git ls-remote <owner-controlled-repository>
git clone <owner-controlled-repository> holahola-external-test
cd holahola-external-test
npm ci
npm run check
npm test
```

Do not assume a GitHub backup is the canonical source until the current commit, branches, tags, and untracked-but-needed assets have been checked.

### 2. Database and durable memory

**Status: DOCUMENTED EXTERNAL; END-TO-END VERIFICATION REQUIRED**

The project documentation states that the canonical database is one shared external Neon PostgreSQL database, accessed through `NEON_SHARED_DATABASE_URL`. Development and production intentionally use this same data plane so Daniela does not split into separate development and production selves. `drizzle.config.ts` requires that variable directly. The application contains the memory, Archive, J-space, episode, conversation, and capture schemas in the repository.

This is a strong portability position:

- the database is not intended to be Replit's managed database;
- schema and migrations travel with the repository;
- the machine-readable memory is already separated from the editor workspace;
- Luca's repository memory travels with the repository.

Required data-plane proof:

- create or verify an owner-controlled database backup;
- restore a backup into a temporary rehearsal database to verify recoverability;
- connect the local application to the shared canonical database without Replit-specific tooling;
- run the system health check against the shared canonical database;
- verify representative rows for episodes, conversation memories, embeddings, reflections, raw capture, and object references;
- verify that no critical table still depends on the abandoned managed database.

Normal local Daniela work should use the shared canonical database, not an isolated development copy. Temporary restored databases are for backup, migration, and recovery rehearsal only. Because development writes are visible to production, schema changes must be additive and backward-compatible before release; destructive changes require an explicit migration and compatibility plan.

Important boundary:

The database and Markdown do not need to be byte-identical. Dialogue, Luca-authored narrative, and Luca-authored reflection can all be authentic memories. The database is the machine-retrieval path; Markdown is also a first-source human and Luca-authored record.

### 3. Images, captures, and object storage

**Status: DOCUMENTED PORTABLE; VERIFY INVENTORY AND RESTORE**

`docs/new-environment-setup.md` states that Cloudflare R2 is the active object store and that the old Replit object-storage bucket was retired. The application has S3-compatible storage support and uses the AWS-compatible environment variable family for R2.

This is one of the strongest autonomy wins already present:

- object storage is outside Replit;
- the application has a standard S3-compatible path;
- the migration process is described as idempotent;
- raw Replit-window evidence has a separate ledger and attachment path.

Required proof:

- inventory database object references;
- compare them against the R2 object inventory;
- test public and private reads from outside Replit;
- restore a sample of images, raw captures, and attachments;
- verify that no production request silently falls back to Replit sidecar storage;
- document backup and deletion policy for the R2 bucket.

### 4. Application runtime and build

**Status: PORTABLE PATH EXISTS; NOT YET PROVEN ON THE OWNER'S COMPUTER**

The repository has ordinary Node scripts:

```bash
npm run dev
npm run build
npm run start
npm run check
npm test
```

The application is TypeScript/React/Express with Drizzle migrations and does not require Docker or a virtual machine according to the environment guide.

Replit-specific concerns still requiring isolation tests:

- `@replit/*` development plugins;
- the `server/replit_integrations/` directory name and any sidecar fallback behavior;
- `stripe-replit-sync`;
- Replit-specific environment variables;
- assumptions about ports, proxy headers, or hostnames;
- workflow startup behavior currently encoded in `.replit`.

Required local-development proof:

- clean external install;
- production build;
- production start;
- health endpoint check;
- shared-database health check;
- object-storage read/write probe;
- no Replit-specific warnings that indicate a required missing service.

The application does not need to leave Replit production for this gate to pass. The purpose is to establish a trustworthy owner-controlled development environment.

### 5. Authentication and authorization

**Status: REPLIT-SPECIFIC PATH ACTIVE; ALTERNATIVE PATH MUST BE BUILT OR VERIFIED**

The application imports and initializes Replit OIDC authentication through `server/replitAuth.ts`; it uses the Replit OIDC issuer and a `REPL_ID` client identifier. The environment guide says a new environment can use the application's own session-based auth without Replit OIDC, but the current audit has not found a verified external login flow.

The Stripe client also contains a Replit connector/identity path. Direct Stripe-key configuration exists in the environment guide, but payment/webhook behavior must be tested outside Replit.

Required proof:

- start the application with Replit OIDC variables absent;
- create or use a non-Replit authenticated session;
- verify founder/admin authorization;
- verify agent-token protected endpoints;
- verify session persistence and logout;
- verify payment/connector behavior with Replit identity variables absent;
- verify production webhooks and background workers do not assume Replit identity.

Authentication is a potential cutover blocker because a portable application is not operationally portable if the only practical login path belongs to Replit.

### 6. AI providers and coding agents

**Status: APPLICATION PROVIDERS PORTABLE; CLAUDE CODE NOT INSTALLED**

The application already has direct-provider configuration for Gemini, Anthropic, OpenAI, voice, and storage services. The project documentation identifies Replit AI proxy variables as optional fallbacks outside Replit.

That is the correct long-term architecture: provider access should be configuration, not application identity.

Current Claude Code state in this workspace:

- `claude` is not on PATH;
- `claude-code` is not on PATH;
- the project contains `@anthropic-ai/sdk`, which is a Node SDK, not Claude Code;
- Claude-named cache/data directories exist but do not contain a usable executable.

A Claude Code installation inside Replit would be useful for testing the tool against the repository, but it would remain subject to Replit's workspace, shell, filesystem, pricing, and policy controls. It is not evidence of autonomy.

The external test should confirm that Claude Code, Cursor, Antigravity, or another agent can:

- clone the repository;
- read the project memory and operating instructions;
- run the same checks;
- make a bounded change;
- produce a reviewable diff;
- leave the source and memory records in owner-controlled locations.

The application should not need to change when the coding agent changes.

### 7. Workflows, workers, and scheduled jobs

**Status: REPLIT-DEPENDENT CONVENIENCE; PORTABILITY NEEDS INVENTORY**

The `.replit` file contains the development workflow and a large set of named validation workflows. The application also has long-running workers and scheduled processes for memory, capture, monitoring, and synchronization.

For local development, Replit workflows can be replaced with ordinary shell commands and a locally run test suite. For production, Replit can continue to provide the managed workflow/runtime while it remains the selected host.

An external production equivalent is needed only if we decide to remove Replit from hosting. At that point it needs an explicit replacement for each process:

| Current function | External replacement to prove |
|---|---|
| Web server | systemd, a process supervisor, or equivalent |
| Scheduled memory/index jobs | cron, systemd timers, or managed scheduler |
| Capture watchdog | externally supervised process with durable status |
| Tests and checks | CI runner owned by the project |
| Logs | retained logs outside the Replit workspace |
| Database migrations | reviewed migration command against the selected database |
| Deployment | owner-controlled deployment and rollback |

The named checks are valuable project behavior, but the Replit workflow runner is not part of the application's core identity.

### 8. Replit as managed production hosting

**Status: VALID INTERIM ARCHITECTURE; PLATFORM-DEPENDENT BY CHOICE**

Replit can remain the production host while development moves elsewhere. Replit's publishing system handles managed infrastructure, hosting, TLS, and health checks, and offers deployment targets such as Autoscale, Reserved VM, and Scheduled. A Reserved VM is the closest Replit option to an always-running server for HolaHola's long-lived processes, but it is still a managed Replit runtime rather than a traditional VPS with root access.

The proposed source flow is:

```text
Owner-controlled local checkout
        ↓
Owner-controlled GitHub repository
        ↓
Replit published deployment
        ↓
Shared Neon + R2 data plane
```

Both the local development application and the Replit production deployment connect to this same canonical data plane. Daniela's student knowledge, conversations, memories, episodes, captures, and embeddings therefore remain continuous across environments.

This gives us development and data autonomy while retaining a Replit hosting dependency. That dependency is explicit and replaceable rather than hidden inside the coding process.

Required proof:

- publish from the intended repository state;
- verify both the local environment and production build use the same expected external Neon and R2 resources;
- verify the correct Replit deployment target for the server's long-lived processes;
- verify production webhooks and domain behavior;
- verify a rollback to a prior known-good repository revision;
- document the exact steps to redeploy the same revision outside Replit if necessary.

Replit is acceptable as the production host if the consequences are understood: pricing, platform policies, deployment availability, and Replit runtime behavior remain external dependencies.

### 9. Deployment, domain, and webhooks

**Status: UNKNOWN / VERIFY**

The code has ordinary production build and start commands, and Replit provides a managed publishing path. The actual deployment target, webhook ownership, DNS, TLS, rollback, and production runtime supervision have not been established by this audit.

Required proof:

- identify where the production process runs within Replit;
- identify who controls the domain and DNS;
- inventory every inbound webhook;
- move or duplicate webhook endpoints in a test environment;
- verify Stripe, Twilio, email, and AI callbacks;
- perform a rollback from a known-good build;
- confirm that the app can be rebuilt outside Replit if Replit becomes unavailable.

### 10. Conversation and capture records

**Status: DATA IS PORTABLE; REPLIT-VISIBLE INGRESS REMAINS UNPROVEN**

The project has substantial work in place for raw capture, attachment retention, episode records, memory rows, and source attribution. Those records can travel with the database, repository, and object store.

The unresolved problem is upstream: the actual Replit-visible Agent conversation is not reliably exposed to the application collector. A shell-driven Claude Code process would be more accessible to the repository, but it would not automatically capture this Replit Agent conversation.

For an external coding-agent environment, the desired contract is simpler:

- the agent prompt and response are available to the owner-controlled process;
- important decisions can be explicitly saved;
- raw session logs are retained independently;
- Markdown episodes may include Luca-authored narrative and reflection;
- database memories are indexed intentionally rather than by blindly ingesting every diagnostic line.

This is a reason to prefer an external coding environment, but it is not a reason to rewrite or discard the existing Episode 31 record.

## What is already externalized

Based on the repository documentation and current code, these pieces appear to have already moved substantially away from Replit:

- application source and migration history;
- Luca's repository memory and skills;
- Neon PostgreSQL as the intended canonical database;
- Cloudflare R2 as the intended active object store;
- direct AI-provider fallback paths;
- application build/test scripts;
- raw capture schema and evidence-retention design;
- GitHub synchronization scripts.

These still require proof rather than assumption:

- the current GitHub repository is the canonical and complete source;
- external database backups and restores work;
- R2 inventory and references are complete;
- authentication works without Replit OIDC;
- scheduled workers and webhooks have external equivalents;
- production can run and roll back without Replit.

## Security and ownership remediation

Before any external clone or host setup:

1. Rotate any credential embedded in Git configuration immediately.
2. Replace token-bearing Git URLs with an SSH remote or credential helper.
3. Keep credentials out of scripts, commit history, shell output, and migration documents.
4. Create an owner-controlled secret inventory containing only service names, owners, rotation dates, and environment locations—never the secret values.
5. Confirm that the external environment can receive each required credential from its own secret manager.

## Decision thresholds

### Direct external development move is justified when

- a clean clone builds and tests;
- the shared canonical database can be safely connected from the local environment;
- a backup can be restored into a temporary rehearsal database;
- object storage reads and writes work;
- the local environment can run one representative Daniela/Luca flow;
- memory and episode writes are durable and retrievable;
- the source and data can be recovered without Replit.

This decision does **not** require moving production hosting.

### External production move is justified when

- Replit cost, policy, reliability, or operational limits create a concrete problem;
- the external runtime has passed the local proving-ground checks;
- authentication, workers, webhooks, and scheduled jobs have tested replacements;
- rollback and backup procedures are ready;
- the expected control or cost benefit is greater than the migration and operations burden.

### A Replit-shell baby step is justified when

- the local audit finds one or two environment gaps;
- we want to evaluate Claude Code's workflow before selecting the preferred agent;
- the trial is read-only or bounded at first;
- the trial output is recorded in an owner-controlled location;
- no critical memory or deployment decision is allowed to depend on the Replit shell.

### Replit should not remain the critical path for development when

- the only complete transcript is visible only inside Replit;
- credentials or source records exist only in Replit;
- a Replit pricing or policy change could interrupt development or memory access;
- the local clone cannot operate without undocumented Replit behavior.

Replit may remain the production hosting dependency by choice until the separate external-production threshold is met.

## Recommended sequence

### Phase 1 — Finish the audit

- verify GitHub source and history;
- export and test database backup/restore;
- inventory R2 objects and database references;
- enumerate secrets by purpose without copying secret values;
- enumerate workers, webhooks, cron-like processes, and Replit workflow commands;
- classify each item as portable, replaceable, or blocking.

### Phase 2 — Build an external proving ground against the shared data plane

- clone from the owner-controlled repository;
- configure the local application for the shared external database and object store;
- run build, tests, and health checks;
- rehearse schema migrations against a temporary restored database, then apply only reviewed additive migrations to the shared canonical database;
- run one authenticated application flow;
- run one memory write/retrieval flow;
- run one image/capture retrieval flow;
- record all failures in this document.

### Phase 3 — Select and use the external coding agent

After the local proving ground works:

- start with Claude Code because it is the simplest terminal-native baseline;
- compare Cursor, Antigravity, or another agent against the same repository and checks if useful;
- evaluate permissions, output quality, transcript recordability, and model/provider flexibility;
- make the agent replaceable by keeping the application independent of it.

### Phase 4 — Continue using Replit as production, if it remains suitable

- keep local development and owner-controlled source separate from the published runtime;
- deploy known repository revisions to Replit;
- verify production against the external Neon and R2 resources;
- maintain a tested rebuild path outside Replit.

### Phase 5 — Optional external production move

Only pursue this if Replit hosting becomes a concrete liability or the control benefit is compelling. Choose the external runtime based on:

- repository control;
- transcript and output control;
- permission model;
- reproducible command execution;
- portability of session records;
- cost and policy stability;
- ability to swap the model without changing the application.

### Phase 6 — Make Replit production optional, if desired

- externalize the production/runtime path;
- keep Replit as a preview, fallback, or temporary production mirror if useful;
- retain independent backups;
- test a full Replit-off recovery;
- document the final cutover and rollback path.

## Open questions

1. Is `github.com/davidwmcintosh/HolaHola` the current complete canonical repository, and when was it last synchronized?
2. Where are the current database backups, and has a restore been tested recently?
3. Is Cloudflare R2 the only active object-storage backend in production?
4. Which authentication path will be used if external production is selected?
5. Which Replit deployment target is appropriate while Replit remains production?
6. Which scheduled workers must stay continuously alive, and which can become external scheduled jobs?
7. What is the owner-controlled location for raw coding-agent transcripts and command results?

## Bottom line

The audit does **not** support the claim that we must move production off Replit before we can gain meaningful autonomy. We can move development and coding-agent work to an owner-controlled computer now, keep GitHub as the source, keep one shared Neon/R2 data plane for Daniela, and continue publishing the application to Replit.

Replit can function as our managed production host, but it should be treated honestly as a hosting dependency rather than called a VPS. It provides convenience and managed operations in exchange for continued exposure to Replit pricing, policies, and runtime decisions.

The next decision should be made from the local proving-ground evidence. If the local clone works, use whichever coding agent performs best. If Replit hosting remains acceptable, keep it. If it becomes a concrete liability, the already-tested external runtime path can be activated later without moving the development process again.