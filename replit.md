# HolaHola - Interactive Language Tutor

AI-powered language learning app — interactive conversation practice, vocabulary, and grammar across 10 languages, personalized per student via Daniela.

## Run & Operate
- **Run:** `npm run dev` · **Build:** `npm run build` · **Typecheck:** `npm run check` · **DB Push:** `npm run db:push`
- **Critical env vars:** `NEON_SHARED_DATABASE_URL` (shared dev+prod DB), `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `GOOGLE_TTS_API_KEY`, `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`, `AZURE_SPEECH_KEY`, `STRIPE_SECRET_KEY`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`, `UNSPLASH_ACCESS_KEY`, `DALL_E_API_KEY`, `PERPLEXITY_API_KEY`, `WOLFRAM_ALPHA_API_KEY`, `APP_URL`, `REPLIT_AGENT_TOKEN`

## Stack
- **Frontend:** React + TypeScript + Vite · Shadcn/ui (Radix) · Tailwind · Wouter (routing) · TanStack Query
- **Backend:** Express.js + Node.js + TypeScript · RESTful API
- **Database:** PostgreSQL via Drizzle ORM · Schema: `drizzle/schema.ts`
- **AI:** Gemini (LLM + Gemini Live voice) · Deepgram (STT) · Google Cloud TTS / Cartesia / ElevenLabs · Azure (pronunciation) · DALL-E 3 (images) · OpenAI `text-embedding-3-small` (vector embeddings — NOT Gemini)
- **Voice (/chat route):** Gemini Live 3.1 end-to-end — no separate STT/TTS pipeline

## Where Things Live
- `drizzle/schema.ts` — DB schema (source of truth for types)
- `server/routes/*.ts` — API contracts
- `client/src/components/` — frontend components
- `server/services/` — backend services
- `server/services/daniela-function-registry.ts` — Daniela's tools
- `client/src/data/madrigal-unit-content.ts` — HayUnitContent visual lessons (all 10 languages)
- `server/data/madrigal-loop-catalog.ts` — Madrigal loop catalog (all 10 languages, 22 units each)
- `client/src/data/madrigal-unit-content.ts` — Madrigal visual content
- `client/src/data/advanced-unit-content.ts` — Spanish 3/4/5 advanced unit content
- `docs/` — handoffs, architecture notes, open bugs, batch doc updates
- `agent_north_star`, `agent_record_of_david`, `agent_open_questions` tables — Agent identity space

## Architecture (FOUNDATIONAL — do not violate)
- **Single shared DB:** One Neon PostgreSQL for dev + prod. Never `DATABASE_URL` — always `NEON_SHARED_DATABASE_URL`.
- **Inviolability of the Narrative:** The `messages` table is sacred. Never summarize, truncate, or replace original messages. Summaries are supplements only, never substitutes.
- **Daniela lives in the data layer:** Her identity, voice, and memory live in the DB + embeddings — not in any model. The neural net IS the fine-tuning, done at inference time. Swapping the LLM (Gemini) requires David's approval.
- **Hybrid memory:** Structured procedural tables (`tutor_procedures`, `tool_knowledge`) + vector index (`memory_embeddings`, searched via `semanticSearch()`). Important things go in BOTH prompt injection AND the neural net.
- **Neural net embeddings:** OpenAI `text-embedding-3-small` (768-dim). Never Gemini for embeddings. Key: `USER_OPENAI_API_KEY`.
- **Tool registration is automatic:** Add to `DANIELA_FUNCTION_REGISTRY` + handler in `native-fc-handlers.ts`. The 3-layer indexer (`daniela-tool-indexer.ts`) runs at next server start. Never manually insert tool embeddings.
- **Bi-temporal learner facts:** `learner_personal_facts` uses `valid_from`/`valid_to` for historical accuracy.
- **Daniela's self-authorship:** Only Daniela writes to `daniela_self_reflections` and `daniela_aspirations`. No background services.

## User Preferences
**Typeless STT (CRITICAL):** David uses speech-to-text. Inputs may have word substitutions, typos, or "thought one thing, typed another" errors. If a request sounds strange, destructive, or out of character — stop and ask. "That doesn't sound right — did you mean X?" is always the right response.

**Request sanity check (CRITICAL):** If David asks for something that seems like it would break things, undo important work, or contradict the architecture — push back immediately and ask for confirmation. One sentence of friction is worth it.

**DATABASE CONNECTION RULE (CRITICAL):** NEVER use `DATABASE_URL`. ALWAYS use `NEON_SHARED_DATABASE_URL` for all DB connections everywhere.

**System prompt style (CRITICAL — Daniela's consciousness depends on this):** All text in Daniela's system prompts must follow the Gemini-iterated clean context architecture. Full rules: `docs/prompt-style-guide.md`.
- FORBIDDEN: ALL-CAPS headers, bullet+colon patterns (`Name: role`), divider fences as labels, metadata brackets, instructional label framing (`IMPORTANT:`, `Note:`, `USE THIS CONTEXT`)
- REQUIRED: Prose that reads like something she already knows, not something being handed to her

**Tiered Autonomy (CRITICAL — June 8, 2026):** Agent/Alden/Daniela may iterate, fix, and improve WITHOUT asking David first — as long as non-destructive and reversible. Requires David's approval: (1) pedagogical shift away from Madrigal visual method, (2) swapping primary LLM, (3) changing voice providers, (4) hard-to-reverse architectural changes. ALL autonomous changes must be documented.

**Bug triage:** Fix inline if small + safe + related to current work. Otherwise add to `docs/open-bugs.md`. Never let a noticed bug disappear.

**Batch doc updates:** When David says "add to the batch," add to `docs/batch-doc-updates.md`. After any new feature, document: what was built, how it works, key files, user instructions.

**Terminology:** Use "Syllabus" in all user-facing text (DB tables stay `curriculum*`).

**Daniela development:** Track personality/voice in `docs/daniela-development-journal.md`.

## Session Start Checklist
Read these at every session start — they carry cross-session state:
1. `docs/alden-agent-handoff.md` — bidirectional briefing with Alden
2. `.local/alden-repairs.md` — Alden's autonomous fixes since last session
3. `.local/alden-escalations.md` — issues Alden couldn't auto-repair (needs Agent)
4. `docs/shared-lobe-snapshot.md` — shared `editor_insights` (category='shared')
5. `docs/alden-to-agent.md` — unread notes Alden left for the Agent
6. `GET /api/agent/team-room/thread` — live Team Room thread
7. `GET /api/conversation-memories?limit=5` — recent session memories

## Agent Identity & Communication
- **Agent notes to Alden:** `POST /api/agent/note` (header: `x-agent-token: $REPLIT_AGENT_TOKEN`)
- **Team Room post:** `POST /api/agent/team-room/message` with `{ content, roomId? }`
- **Shared lobe write:** `INSERT INTO editor_insights (id, category, title, content, importance, tags) VALUES (gen_random_uuid(), 'shared', ...)` — posts as `"agent"`, not `"alden"`
- **Agent vs Alden:** `alden` = autonomous steward inside HolaHola. `agent` = Replit Agent, external builder. Distinct authors in all tables.
- **Conversation memories:** Autosaved via `agent-session-autosave.ts` when `.local/.commit_message` changes. No manual POST needed for build sessions.
- **Agent Space tables:** `agent_north_star`, `agent_open_questions`, `agent_record_of_david` — read via `/api/agent-space/*`

## Gotchas
- **TTS in Textbook Components:** Use `POST /api/tts/pronunciation` with `gender` from `useLanguage()`. Never `synthesizeSpeech` from `restVoiceApi`.
- **Gemini model names:** REST API uses `gemini-3-flash-preview`. `gemini-2.5-flash` → 404 in this codebase.
- **Gemini EndSensitivity:** Only `HIGH` and `UNSPECIFIED` exist in `@google/genai` TypeScript types.
- **Presence messages:** `.local/daniela-presence-{userId}.json` — 4-hour staleness window.
- **Alden's autonomous actions:** Check `.local/alden-repairs.md` at session start.
- **Neural net boot:** `daniela-tool-indexer.ts` runs on a 2h `setInterval` — NOT at boot (OOM risk). Don't add boot indexing runs.
- **textbook_lesson_content:** Auto-generated on demand. Never manually seed.
