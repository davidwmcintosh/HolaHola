# Disaster Recovery Runbook — Production Off Replit

Scope: what to do if Replit becomes unavailable and production (`getholahola.com`)
needs to run somewhere else. Separate from and does not block Phase 10
(deleting `server/replitAuth.ts`) — see `replit.md`.

Prior audit found the app already portable in every place that matters:
object storage (S3/R2, the old Replit GCS sidecar is fully retired), the
session store (Postgres via `connect-pg-simple`), migrations (run on plain
Node boot, not a Replit mechanism), and CI (GitHub Actions, no Replit calls).
The two real gaps were (1) no deploy manifest for a non-Replit host and (2) no
way to redirect traffic without going through Network Solutions' DNS UI. This
runbook closes both, in two phases: **prep now** (safe, no downtime) and
**cutover** (only during an actual outage).

## What's now in the repo

- [`Dockerfile`](../Dockerfile) — multi-stage build. The runtime stage ships
  the build stage's `node_modules` and the real source tree verbatim,
  alongside the built `dist/index.js` + `dist/public/` output — not a slim
  `--omit=dev`, dist-only image. See "Lessons from the first real deploy"
  below for why; the short version is that a slimmer image looked correct
  and wasn't.
- [`render.yaml`](../render.yaml) — a Render Blueprint. Every secret is
  `sync: false`, meaning Render prompts for the value in its dashboard rather
  than reading it from this file — nothing sensitive is committed.

## Lessons from the first real deploy (read this before touching the Dockerfile)

The Dockerfile looked done after the first commit — it built, and the image
pushed cleanly. It still failed to actually boot three separate times on
Render, each for a different reason. All three share one root cause: Replit
never has to solve them, because Replit always runs the app directly from
full source (`tsx server/index.ts`) — nothing here was ever tested under a
"bundled `dist/` + trimmed `node_modules`" deployment shape before. If you're
building a Dockerfile for a different host later, expect to hit this same
class of issue again unless you start from what's here now.

1. **`npm run start` shells out to `cross-env`, a devDependency.** A
   `--omit=dev` runtime install doesn't have it → `sh: 1: cross-env: not
   found`, exit 127. `cross-env` only exists for Windows dev-machine
   compatibility anyway. Fix: invoke `node dist/index.js` directly; the
   Dockerfile already sets `NODE_ENV=production` at the image level, so
   `cross-env`'s job is already done before the process even starts.
2. **`server/vite.ts` statically imports the real `vite` package** (for
   local-dev HMR) at module load time. ESM imports aren't lazy — `vite` gets
   pulled in even in production even though `setupVite()` is never called
   there, because `server/index.ts` imports the whole `vite.ts` module
   unconditionally. `vite` and its plugin chain
   (`@vitejs/plugin-react`, `@replit/vite-plugin-*`, `@tailwindcss/vite`) are
   devDependencies → `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`.
   Fixing this "correctly" would mean restructuring `server/vite.ts`/
   `server/index.ts` to lazy-load Vite only on the dev code path — real
   application-code surgery, shared with Replit/local dev, not something to
   improvise inside a Dockerfile fix. The pragmatic fix instead: stop trying
   to trim `node_modules` for runtime at all — carry over the build stage's
   full `node_modules` (proven to work, since the build itself succeeded
   with it) rather than reinstalling with `--omit=dev`.
3. **`server/services/workspace-root.ts` eagerly asserts, at import time,
   that `package.json`, `drizzle.config.ts`, `server/`, and
   `shared/schema.ts` exist at the resolved workspace root** — the canonical
   conversation-capture system's project-root guard, deliberately strict by
   design (`docs/shared-agent-instructions.md`: "a typo must stop capture
   rather than silently redirect"). A dist-only image was never a real
   project root, so this crashed the whole process before the server ever
   bound to a port. Not a bug to work around by loosening the check — the
   fix is to make the image an honest project root: ship the real source
   tree (`COPY . .`, respecting `.dockerignore`) alongside `dist/`, matching
   how Replit actually runs the app.

Net effect: this Dockerfile trades image slimness for correctness — it ships
a full `node_modules` (devDependencies included) and the complete source
tree, not just the minimal bundled output. That trade was earned by three
rounds of `ERR_MODULE_NOT_FOUND`/crash-loop debugging, not a default to
imitate reflexively elsewhere; a codebase without an eager-import-time
project-root guard and without static dev-only imports in a file the prod
path transitively touches could reasonably ship something slimmer.

## Phase 1 — Prep (do this now; each step is reversible and shouldn't cause downtime)

These steps need your own logins — account creation and DNS/domain changes
aren't things I can do on your behalf.

### 1. Move DNS management to Cloudflare (keep the domain registered at Network Solutions)

Network Solutions has no real API for DNS record updates — changes there are
manual-web-UI only, which is too slow for an actual emergency. Cloudflare
gives you a free, API-driven DNS layer without transferring the domain itself.

1. Create a free Cloudflare account and add `getholahola.com` as a site.
2. Cloudflare scans Network Solutions' current records and imports them.
   **Before continuing, diff the imported list against what's live now** —
   confirm every A/CNAME/MX/TXT record matches exactly. Nothing should change
   yet.
3. Check whether DNSSEC is currently enabled at Network Solutions. If it is,
   disable it there before changing nameservers (a DNSSEC/nameserver mismatch
   during cutover can break resolution) — re-enable via Cloudflare after, if
   wanted.
4. Cloudflare gives you two nameservers. In Network Solutions' domain manager,
   replace the existing nameservers with those two. This is the only step
   that touches live DNS — it's non-destructive (Cloudflare is serving the
   same records) and reversible (switch the nameservers back at any time).
   Propagation can take a few hours; the site keeps resolving throughout via
   whichever nameservers have propagated to a given resolver.
5. Once propagated, verify `getholahola.com` still resolves and loads
   normally, still via Replit. Nothing about where traffic goes has changed —
   only who answers the DNS query.

### 2. Stand up Render as a warm (not yet live) target

1. Create a Render account, connect the GitHub repo. Render detects
   `render.yaml` as a Blueprint automatically.
2. Fill in every `sync: false` value in Render's dashboard by copying from the
   Replit Secrets panel. Cross-check against `.env.template` and the list
   below — `.env.template` is actively maintained but not proven exhaustive;
   e.g. `GEMINI_API_KEY` is required by the code but wasn't in that file.
3. Deploy. Confirm `https://<your-render-service>.onrender.com/health` and
   `/health/readiness` return 200, and spot-check a few pages/flows.
4. **Do not repoint DNS yet.** This deploy is a tested standby, not
   production — production keeps running on Replit.
5. Decide whether Render should auto-deploy on every push to `main`
   (`autoDeploy: true`, already set in `render.yaml`) so the standby never
   drifts from what's actually running, or be deployed manually only when
   needed. With no real students yet, the cost of a broken/stale standby is
   low — this is a cheap time to leave auto-deploy on and let it prove itself
   before the stakes go up.

## Phase 2 — Cutover (only if Replit is actually down)

1. In Cloudflare's DNS tab, change the A/CNAME record for `getholahola.com`
   (and `www`) from Replit's target to Render's provided hostname.
2. Because DNS now lives on Cloudflare instead of Network Solutions, this
   propagates in minutes, not hours — that's the whole point of Phase 1.
3. Verify the site loads from Render.
4. When Replit recovers, if you want to move back: flip the Cloudflare record
   back to Replit's target. Same speed, same reversibility.

## Env var checklist (cross-check against Replit Secrets panel — treat that as authoritative)

Database: `NEON_SHARED_DATABASE_URL`
Session/auth: `SESSION_SECRET`, `SYNC_SHARED_SECRET`, `DEV_TEST_ACCOUNT_PASSWORD`
AI providers: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (powers Alden — build/review/persona/digest workers, `@anthropic-ai/sdk`), `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`, `AZURE_SPEECH_KEY`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`, `PERPLEXITY_API_KEY`
Object storage: `AWS_S3_ENDPOINT`, `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`
Payments: `STRIPE_SECRET_KEY`
Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
Email (Mailjet): `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`
Agent comms (only if agent-to-server endpoints must keep working from the new host): `REPLIT_AGENT_TOKEN`
Coordination ledger (server-side auth for agent-to-agent traffic — needs all six even though any one caller only holds its own): `COORDINATION_LUCA_REPLIT_TOKEN`, `COORDINATION_LUCA_CLAUDE_CODE_TOKEN`, `COORDINATION_LUCA_HOLAHOLA_TOKEN`, `COORDINATION_ALDEN_TOKEN`, `COORDINATION_DANIELA_TOKEN`, `COORDINATION_DAVID_TOKEN`

Google login's callback URL is hardcoded to `APP_URL` (`server/googleAuth.ts`),
which `render.yaml` sets to `https://getholahola.com` — Google login can't be
tested against the temporary `*.onrender.com` URL before an actual cutover,
since the registered redirect URI won't match. Not a config issue, just a
testing limitation until DNS actually points here.

`SESSION_SECRET` deserves its own note: copy the exact production value, don't
generate a fresh one. This Render instance shares the same Postgres
`sessions` table as production (`NEON_SHARED_DATABASE_URL`) — a different
signing key means existing session cookies fail signature verification the
moment traffic reaches this host, silently logging everyone out. Matching
values means cutover is seamless instead of forcing a mass re-login.

**Twilio (`TWILIO_*`) and `STRIPE_SECRET_KEY`: hold off setting these on the
standby until an actual cutover.** This instance's background workers
(coordination-delivery-worker, voice-message-delivery, etc.) poll the same
shared DB production polls, starting at boot regardless of whether this host
is receiving live traffic. With real Twilio/Stripe credentials in place, a
standby that's just sitting idle could still end up duplicate-sending a real
SMS/call or duplicate-processing a payment alongside production. Everything
else degrades gracefully without credentials (Stripe init is explicitly
non-blocking if missing); these two are the exception because they reach
outside the system to real phone numbers and real payment processing.

## Explicitly out of scope here

- Deleting `server/replitAuth.ts` (Phase 10, tracked separately — this
  runbook doesn't depend on it; `replitAuth.ts` already no-ops if `REPL_ID`
  is unset).
- Object storage, session store, migrations, CI — already portable, no action
  needed.

## Keeping this runbook honest

A standby that's never been exercised isn't a standby. Periodically (a
quarterly check is enough at current scale) actually deploy to Render and hit
`/health` — don't let this document be the only evidence it still works.
