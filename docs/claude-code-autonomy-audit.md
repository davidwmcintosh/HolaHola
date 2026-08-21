# HolaHola Autonomy Audit

**Audit date:** 2026-08-21  
**Purpose:** Establish the real distance between the current HolaHola system and an externally controlled development/runtime environment.

This is an operational audit, not a commitment to a particular replacement for Replit. Claude Code, Cursor, Antigravity, and other coding agents should be interchangeable once the repository, data, runtime, and memory systems are independently controlled.

## Executive assessment

### Current conclusion

HolaHola is **closer to external portability than a fresh migration**, especially in code, database, object storage, and AI-provider configuration. It is **not yet proven operationally independent** because the current development and deployment workflow still has substantial Replit coupling.

The right next move is not to assume either “we are ready” or “we are far away.” It is to complete the verification gates in this document:

1. prove the repository can be cloned from the owner-controlled source;
2. prove the external database and object storage are sufficient;
3. prove the application builds and runs outside Replit;
4. prove authentication, workers, webhooks, and scheduled jobs have non-Replit paths;
5. prove memory and capture continue to work in the external environment.

If those gates pass, a direct external move is reasonable. If only the runtime gates fail, installing Claude Code inside Replit is a useful bounded experiment while the external environment is completed. It must not become the new system of record.

## Autonomy model

Autonomy is evaluated in layers. Moving the coding agent alone does not move the system.

| Layer | Desired owner-controlled state |
|---|---|
| Source | Repository and history can be cloned and pushed without Replit |
| Build | Dependencies, scripts, migrations, and tests run from a normal Node environment |
| Development agent | Claude Code, Cursor, Antigravity, or another agent can be swapped without changing application architecture |
| Memory | Conversation memories, Luca memory, episodes, raw evidence, and embeddings are independently backed up and retrievable |
| Assets | Images, captures, voice notes, and other objects live in portable object storage |
| Secrets | Credentials are held in an owner-controlled secret manager |
| Runtime | Server, workers, scheduled jobs, and logs run outside Replit |
| Identity | Authentication does not require Replit OIDC |
| Delivery | Domain, webhooks, deployment, and rollback do not require Replit |
| Model access | AI providers are configured behind replaceable adapters with direct-key or independently managed access |

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
- A clean clone from GitHub has not yet been built and started in an external environment.

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

The project documentation states that the canonical database is external Neon PostgreSQL, accessed through `NEON_SHARED_DATABASE_URL`. `drizzle.config.ts` requires that variable directly. The application contains the memory, Archive, J-space, episode, conversation, and capture schemas in the repository.

This is a strong portability position:

- the database is not intended to be Replit's managed database;
- schema and migrations travel with the repository;
- the machine-readable memory is already separated from the editor workspace;
- Luca's repository memory travels with the repository.

Required proof:

- create or verify an owner-controlled database backup;
- restore a backup into a test database;
- apply migrations without Replit-specific tooling;
- run the system health check against the test database;
- verify representative rows for episodes, conversation memories, embeddings, reflections, raw capture, and object references;
- verify that no critical table still depends on the abandoned managed database.

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

**Status: PORTABLE PATH EXISTS; NOT YET PROVEN OUTSIDE REPLIT**

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

Required proof:

- clean external install;
- production build;
- production start;
- health endpoint check;
- database migration/health check;
- object-storage read/write probe;
- no Replit-specific warnings that indicate a required missing service.

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

The external equivalent does not need to use Replit workflows. It does need an explicit replacement for each process:

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

### 8. Deployment, domain, and webhooks

**Status: UNKNOWN / VERIFY**

The code has ordinary production build and start commands, and the documentation identifies an external application URL. The actual deployment path, webhook ownership, DNS, TLS, rollback, and runtime supervision have not been established by this audit.

Required proof:

- identify where the production process runs;
- identify who controls the domain and DNS;
- inventory every inbound webhook;
- move or duplicate webhook endpoints in a test environment;
- verify Stripe, Twilio, email, and AI callbacks;
- perform a rollback from a known-good build;
- confirm that the app can remain available if Replit is unavailable.

### 9. Conversation and capture records

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

### Direct external move is justified when

- a clean clone builds and tests;
- the database can be restored or safely connected;
- object storage reads and writes work;
- authentication works without Replit OIDC;
- workers and webhooks have explicit replacements;
- the external environment can run one representative Daniela/Luca flow;
- memory and episode writes are durable and retrievable;
- Replit can be turned off without data loss.

### A Replit-shell baby step is justified when

- the external audit finds one or two operational gaps;
- we want to evaluate Claude Code's workflow before selecting the permanent host;
- the trial is read-only or bounded at first;
- the trial output is recorded outside Replit;
- no critical memory or deployment decision is allowed to depend on the Replit shell.

### Replit should not remain the critical path when

- the only complete transcript is visible only inside Replit;
- the only reliable deployment or worker scheduler is Replit;
- credentials or assets exist only in Replit;
- a Replit pricing or policy change could interrupt development or memory access;
- the external clone cannot operate without undocumented Replit behavior.

## Recommended sequence

### Phase 1 — Finish the audit

- verify GitHub source and history;
- export and test database backup/restore;
- inventory R2 objects and database references;
- enumerate secrets by purpose without copying secret values;
- enumerate workers, webhooks, cron-like processes, and Replit workflow commands;
- classify each item as portable, replaceable, or blocking.

### Phase 2 — Build an external proving ground

- clone from the owner-controlled repository;
- configure a test database and object store;
- run build, tests, migrations, and health checks;
- run one authenticated application flow;
- run one memory write/retrieval flow;
- run one image/capture retrieval flow;
- record all failures in this document.

### Phase 3 — Optional Claude Code trial in Replit

Only after the audit baseline is recorded:

- install Claude Code through the supported package path;
- run a read-only repository analysis;
- run a bounded test change on a branch or checkpoint;
- compare its workflow, permissions, output quality, and recordability;
- do not treat the Replit installation as the destination.

### Phase 4 — Select the permanent agent and host

Choose Claude Code, Cursor, Antigravity, or another tool based on:

- repository control;
- transcript and output control;
- permission model;
- reproducible command execution;
- portability of session records;
- cost and policy stability;
- ability to swap the model without changing the application.

### Phase 5 — Make Replit optional

- externalize the production/runtime path;
- keep Replit as a preview or temporary mirror if useful;
- retain independent backups;
- test a full Replit-off recovery;
- document the final cutover and rollback path.

## Open questions

1. Is `github.com/davidwmcintosh/HolaHola` the current complete canonical repository, and when was it last synchronized?
2. Where are the current database backups, and has a restore been tested recently?
3. Is Cloudflare R2 the only active object-storage backend in production?
4. Which authentication path will be used outside Replit?
5. Where will production run after Replit is optional?
6. Which scheduled workers must stay continuously alive, and which can become external scheduled jobs?
7. What is the owner-controlled location for raw coding-agent transcripts and command results?

## Bottom line

The audit does **not** support the claim that we must spend weeks rebuilding HolaHola outside Replit. The repository already contains a portability foundation, and the database/object-storage work appears to have removed two of the largest migration risks.

It also does **not** support the claim that installing Claude Code in the Replit shell would make us autonomous. That would be a useful experiment inside the current boundary, not a removal of the boundary.

The next decision should be made from the Phase 1 and Phase 2 evidence. If those pass, go external directly. If they expose manageable runtime gaps, use the Replit-shell trial while closing them. Either way, the permanent goal is the same: Replit becomes optional, and coding agents become interchangeable.