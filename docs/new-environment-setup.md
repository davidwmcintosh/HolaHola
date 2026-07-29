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

### AI — Secondary (features degrade gracefully without these)
```
AI_INTEGRATIONS_OPENAI_API_KEY=...         # OpenAI via Replit integration proxy (pronunciation)
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_ANTHROPIC_API_KEY=...      # Anthropic via Replit integration proxy
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_INTEGRATIONS_GEMINI_API_KEY=...         # Gemini via Replit integration proxy
AI_INTEGRATIONS_GEMINI_BASE_URL=...
```

> **Note:** If the `AI_INTEGRATIONS_*` proxy isn't available outside Replit, use the direct keys above instead. The codebase has fallbacks.

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

### Object Storage ⚠️ (See Section 5)
```
DEFAULT_OBJECT_STORAGE_BUCKET_ID=...        # Primary bucket (currently Replit Object Storage)
PUBLIC_OBJECT_SEARCH_PATHS=...              # Comma-separated paths for public assets
PRIVATE_OBJECT_DIR=...                      # Directory for private uploads
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

## Step 5 — Object Storage Migration ⚠️

This is the one genuine Replit dependency. Object storage is used for:
- Student/scene **images** (`server/services/image-storage.ts`)
- **Voice notes** for SMS delivery (`server/services/voice-message-delivery.ts`)
- **Public assets** (Madrigal scan images, curriculum visuals)

The core service lives at `server/replit_integrations/object_storage/objectStorage.ts`.

### Option A — Keep Using Replit Object Storage
If David still has a Replit account (even without the full agent environment), the Replit Object Storage bucket remains accessible. Set the three `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR` env vars and nothing changes.

### Option B — Migrate to S3-Compatible Storage (Google Cloud Storage, AWS S3, Cloudflare R2)

The `objectStorage.ts` wrapper already uses `@google-cloud/storage` internally. To migrate:

1. Create a new GCS bucket (or S3/R2 equivalent)
2. Copy existing assets from the Replit bucket to the new bucket
3. Update `objectStorage.ts` to point at the new provider
4. Update the three env vars

This is a ~2 hour task. The code change is in one file. The asset copy is the longest part.

> **For now:** If you're just moving environments but keeping a Replit account, Option A costs nothing and takes 5 minutes.

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
| Object storage (images, voice notes) | ⚠️ Replit-hosted. Needs migration if Replit is fully removed. |
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
