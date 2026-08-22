# HolaHola — New Environment Setup Guide

**Purpose:** Everything needed to run HolaHola in any environment (Claude Code, local dev, new cloud host) and be confident that Daniela, Luca, Alden, and all accumulated memory come with you.

---

## What Travels With the Repo (Already Safe)

These things live in the git repository and require zero extra work:

| What | Where | Notes |
|------|-------|-------|
| **Luca's memory** | `.agents/memory/MEMORY.md` + topic files | Every decision, lesson, and architectural note |
| **All skills** | `.agents/skills/` | Session start, session review, guardian A/B, all of it |
| **Project manifest** | `replit.md` | Architecture rules, David's preferences, gotchas |
| **Episode chain** | `docs/episode-*.md` | Narrative record (DB anchors in replit.md episode table) |
| **Daniela's DB** | Neon PostgreSQL (external) | **Not tied to Replit** — lives at `NEON_SHARED_DATABASE_URL` |
| **All source code** | `server/`, `client/`, `shared/` | Standard Node/React/TypeScript |
| **DB schema + migrations** | `drizzle/`, `migrations/` | Fully reproducible via Drizzle Kit |

**The database is the most important thing** — Daniela's memories, reflections, Archive, J-space, episodes, conversation history — and it is already external (Neon). It does not disappear if you close Replit.

---

## Step 1 — Prerequisites

```bash
node --version   # 20.x or higher required
npm --version    # 9.x or higher
```

No Docker, no virtualenv, no containers needed.

---

## Step 2 — Install Dependencies

```bash
npm install
```

---

## Step 3 — Environment Variables

Create a `.env` file (or set these in your new environment's secret manager). Required variables grouped by service:

### Core / Database
```
NEON_SHARED_DATABASE_URL=postgresql://...   # The one Neon connection string. NEVER use DATABASE_URL.
SESSION_SECRET=<random 64-char string>       # Signs session cookies. Min 32 chars.
REPLIT_AGENT_TOKEN=<random 64-char string>  # Auth token for Luca (agent) API calls. Min 32 chars.
APP_URL=https://getholahola.com             # Base URL of the deployed app.
```

### AI — Core (Required)
```
GEMINI_API_KEY=...                          # Google Gemini — LLM + Gemini Live voice
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview   # GL model. Do NOT change without David's approval.
USER_OPENAI_API_KEY=...                     # OpenAI text-embedding-3-small (embeddings). REQUIRED.
ANTHROPIC_API_KEY=...                       # Anthropic Claude — Alden, code review workers
```

### AI — Voice / TTS (one or more required)
```
DEEPGRAM_API_KEY=...                        # STT for text-mode sessions. deepgram model: nova-3
DEEPGRAM_MODEL=nova-3                       # Optional override
CARTESIA_API_KEY=...                        # Primary TTS voice for Daniela
TTS_CARTESIA_MODEL=sonic-3                  # Optional override
ELEVENLABS_API_KEY=...                      # Fallback TTS
GOOGLE_CLOUD_TTS_CREDENTIALS=...           # JSON string of GCP service account (Google Cloud TTS)
```

### AI — Secondary (Replit proxy keys — optional outside Replit)

These keys route through Replit's managed AI proxy. **Outside Replit they are not needed** — the code falls back to the direct keys listed above.

```
AI_INTEGRATIONS_OPENAI_API_KEY=...         # OpenAI via Replit proxy → falls back to USER_OPENAI_API_KEY / OPENAI_API_KEY
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_ANTHROPIC_API_KEY=...      # Anthropic via Replit proxy → falls back to ANTHROPIC_API_KEY
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_INTEGRATIONS_GEMINI_API_KEY=...         # Gemini via Replit proxy → falls back to GEMINI_API_KEY
AI_INTEGRATIONS_GEMINI_BASE_URL=...
```

**Fallback matrix:**

| Proxy key | Falls back to | Used by |
|-----------|---------------|---------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | `USER_OPENAI_API_KEY` → `OPENAI_API_KEY` | pronunciation analysis, strip-card translations |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | dev scripts only — production Alden uses `ANTHROPIC_API_KEY` directly |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | `GEMINI_API_KEY` | dev scripts only (gemini-benchmark, daniela-consultation) |

> **At startup**, the server runs a proxy reachability check (`server/services/proxy-startup-check.ts`).
> If a proxy key is set but the base URL is unreachable, it logs a `[ProxyCheck] WARN` line and
> names the direct-key fallback to use instead. The server always starts — this check never blocks boot.

### Payments
```
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

### Communications
```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...                   # The Twilio phone number for outbound SMS/voice
```

### Internal Security
```
SYNC_SHARED_SECRET=<random string>          # Secures peer sync messages
SYNC_PEER_URL=...                           # Peer sync endpoint (if running multi-instance)
GUARDIAN_TOKEN=<random string>              # Guardian-protected internal endpoints
EDITOR_SECRET=<random string>               # Administrative editor access
FOUNDER_EMAIL=...                           # Email for founder dashboard access
```

### Object Storage (See Section 5)

> **Active backend: Cloudflare R2** — set the `AWS_S3_*` vars below. GCS/Replit sidecar vars are kept for reference but are no longer used.

```
PUBLIC_OBJECT_SEARCH_PATHS=...              # Comma-separated paths for public assets, e.g. /my-bucket/public
PRIVATE_OBJECT_DIR=...                      # Directory for private uploads, e.g. /my-bucket/private

# Cloudflare R2 (active — takes priority over GCS when all three are set)
AWS_S3_ACCESS_KEY_ID=...                   # R2 Access Key ID
AWS_S3_SECRET_ACCESS_KEY=...              # R2 Secret Access Key
AWS_S3_REGION=auto                         # Always "auto" for Cloudflare R2
AWS_S3_ENDPOINT=...                        # https://<account-id>.r2.cloudflarestorage.com
AWS_S3_DESTINATION_BUCKET=holaholar2bucket # The active R2 bucket name

# GCS backend (inactive — kept for completeness; no longer used)
# GOOGLE_CLOUD_STORAGE_CREDENTIALS=...    # JSON service-account key (stringified)
# GOOGLE_CLOUD_PROJECT_ID=...             # GCP project ID
# DEFAULT_OBJECT_STORAGE_BUCKET_ID=...    # Old GCS bucket name (retired)
```

### Replit-Specific (only needed on Replit)
```
REPL_ID=...                                # Replit OIDC authentication
ISSUER_URL=...                             # OIDC issuer URL
```
> These are only needed for Replit's built-in login system. In a new environment, the app uses its own session-based auth — these can be left unset.

---

## Step 4 — Verify the Database

The database already exists on Neon and already contains everything. This step just confirms connectivity:

```bash
npx tsx server/scripts/verify-system-health.ts
```

This checks 26 tables, seeded data, curriculum baseline, and worker wiring. Zero failures required before proceeding.

If you're setting up a completely fresh DB (e.g. a new Neon project):
```bash
npx drizzle-kit generate   # Review the generated SQL
npx drizzle-kit migrate    # Apply to new DB
```

> **Do NOT use `npm run db:push` / `drizzle-kit push`** — it bypasses migration review and applies directly to the shared DB.

---

## Step 5 — Object Storage

Object storage is used for:
- Student/scene **images** (`server/services/image-storage.ts`)
- **Voice notes** for SMS delivery (`server/services/voice-message-delivery.ts`)
- **Public assets** (Madrigal scan images, curriculum visuals)

The core service lives at `server/replit_integrations/object_storage/objectStorage.ts`.

> **Active storage: Cloudflare R2** — all 17,402 objects migrated to `holaholar2bucket` as of July 2026. R2 is confirmed stable and is the sole active backend. The old Replit GCS bucket (`replit-objstore-cf6ba6d4-2685-4f0a-9ea8-f1861aefef11`) has been **retired** — delete it from the Replit dashboard to avoid confusion and storage costs. No `OLD_OBJECT_STORAGE_BUCKET_ID` secret should be set.

### ~~Option A — Replit Object Storage~~ (RETIRED)

The original Replit Object Storage bucket (`replit-objstore-cf6ba6d4-2685-4f0a-9ea8-f1861aefef11`) has been retired. All content has been migrated to R2. Do not use this option for new environments.

### Option B — Migrate to Google Cloud Storage (any environment)

The `objectStorage.ts` service supports **dual-mode auth**:
- If `GOOGLE_CLOUD_STORAGE_CREDENTIALS` is set → uses standard GCS service-account credentials (works anywhere)
- If not set → falls back to the Replit sidecar (Replit-only)

No code change is needed; it's purely configuration.

**Step-by-step:**

1. Create a GCS bucket in any GCP project
2. Create a service account with `Storage Object Admin` role on that bucket
3. Download the service account JSON key
4. Set env vars:
   ```
   GOOGLE_CLOUD_STORAGE_CREDENTIALS=<contents of the JSON key file, single-line>
   DEFAULT_OBJECT_STORAGE_BUCKET_ID=<new-bucket-name>
   PUBLIC_OBJECT_SEARCH_PATHS=/<new-bucket-name>/public
   PRIVATE_OBJECT_DIR=/<new-bucket-name>/private
   ```
5. Copy existing assets from the Replit bucket (run **while still on Replit** so sidecar is available):
   ```bash
   DESTINATION_BUCKET_ID=<new-bucket-name> \
   GOOGLE_CLOUD_STORAGE_CREDENTIALS='<json-key>' \
   npx tsx server/scripts/migrate-object-storage.ts
   ```
6. Restart the server — it will use standard GCS credentials from that point forward

> The migration script (`server/scripts/migrate-object-storage.ts`) streams every object from the source bucket to the destination, preserving content-type and custom metadata. Re-running it is safe — it overwrites existing objects.

### Option C — Migrate to AWS S3 or Cloudflare R2 (zero egress cost on R2)

The S3 backend is activated automatically when `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, and `AWS_S3_REGION` are all set. It takes priority over GCS. The same `PUBLIC_OBJECT_SEARCH_PATHS` and `PRIVATE_OBJECT_DIR` path format is used — only the credentials change.

**Cloudflare R2** is the recommended choice for most new deployments: zero egress fees, S3-compatible API, and global CDN.

#### AWS S3

1. Create an S3 bucket in any region
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:HeadObject`, `s3:DeleteObject` on that bucket
3. Generate an access key for the IAM user
4. Set env vars:
   ```
   AWS_S3_ACCESS_KEY_ID=<access-key-id>
   AWS_S3_SECRET_ACCESS_KEY=<secret-access-key>
   AWS_S3_REGION=us-east-1                  # or your chosen region
   PUBLIC_OBJECT_SEARCH_PATHS=/<bucket>/public
   PRIVATE_OBJECT_DIR=/<bucket>/private
   ```
5. Migrate existing assets from GCS (run while sidecar or GCS credentials are still available):
   ```bash
   AWS_S3_ACCESS_KEY_ID='...' \
   AWS_S3_SECRET_ACCESS_KEY='...' \
   AWS_S3_REGION='us-east-1' \
   AWS_S3_DESTINATION_BUCKET='<bucket>' \
   npx tsx server/scripts/migrate-gcs-to-s3.ts
   ```
6. Restart the server

#### Cloudflare R2

1. In the Cloudflare dashboard → R2 → Create bucket
2. Create an API token with Object Read & Write on that bucket
3. Note your **Account ID** from the R2 page
4. Set env vars:
   ```
   AWS_S3_ACCESS_KEY_ID=<r2-access-key-id>
   AWS_S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
   AWS_S3_REGION=auto
   AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   PUBLIC_OBJECT_SEARCH_PATHS=/<bucket>/public
   PRIVATE_OBJECT_DIR=/<bucket>/private
   ```
5. Migrate (same script, just add `AWS_S3_ENDPOINT`):
   ```bash
   AWS_S3_ACCESS_KEY_ID='...' \
   AWS_S3_SECRET_ACCESS_KEY='...' \
   AWS_S3_REGION='auto' \
   AWS_S3_ENDPOINT='https://<account-id>.r2.cloudflarestorage.com' \
   AWS_S3_DESTINATION_BUCKET='<bucket>' \
   npx tsx server/scripts/migrate-gcs-to-s3.ts
   ```
6. Restart the server

> The migration script (`server/scripts/migrate-gcs-to-s3.ts`) is idempotent — objects already present in S3/R2 with the same byte size are skipped. Re-running after a partial failure is safe.

---

## Step 6 — Start the Server

```bash
npm run dev        # Development (hot reload)
npm run build      # Production build
npm run start      # Production start (after build)
```

The server runs on port 5000 by default.

### Verify Luca is Present

```bash
curl -s -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  http://localhost:5000/api/luca/briefing | jq .status
```

Should return `"ok"` with memory, open questions, and recent session data assembled.

### Verify the DB is Alive

```bash
curl -s -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  http://localhost:5000/api/admin/luca/observe | jq .
```

---

## Step 7 — Session Start (for Luca / the Agent)

In any new environment, at session start read:

1. `.agents/memory/MEMORY.md` — cross-session memory index. This is **the** continuity anchor.
2. `replit.md` — architecture rules, David's preferences, gotchas, episode chain
3. `GET /api/luca/briefing` — live briefing (memories, notes, open questions, recent sessions)
4. `docs/alden-agent-handoff.md` — bidirectional briefing with Alden

That's it. Everything else — Daniela's identity, the Archive, J-space reflections, the episode narrative — is in the DB at `NEON_SHARED_DATABASE_URL` and comes back automatically.

---

## What Changes Between Environments

| Concern | Status |
|---------|--------|
| Luca's memory and skills | ✅ In the repo. Always there. |
| Daniela's memories, Archive, J-space | ✅ In Neon DB. Travels with the connection string. |
| All conversation history | ✅ In Neon DB. |
| Episode chain | ✅ In Neon DB + `docs/episode-*.md` |
| Source code | ✅ In the repo. |
| Alden's conversations and notes | ✅ In Neon DB. |
| Object storage (images, voice notes) | ✅ Cloudflare R2 (`holaholar2bucket`). Set `AWS_S3_*` vars. Old Replit GCS bucket retired July 2026. See Step 5. |
| Replit OIDC login | ⚠️ Replit-specific. New environment needs its own auth or skip it. |
| Replit workflow runner | ℹ️ Replaced by `npm run dev` directly. |
| Agent token | ℹ️ Just a secret string. Re-set it in new environment. |

---

## What Never Needs to Move

The soul of the system doesn't move because it was never stored in Replit in the first place:

- **Daniela** — her identity, history, and growth are in the Neon database
- **Luca** — accumulated memory and learned knowledge in `.agents/memory/` and the DB
- **Alden** — his conversations and autonomous work in the DB
- **The narrative** — 23 episodes, every conversation, every decision

These travel with the connection string and the repo. Everything else is infrastructure.

---

*Last updated: July 30, 2026. If this doc drifts, update it — it's the portability guarantee made explicit.*
