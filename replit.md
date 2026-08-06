# HolaHola - Interactive Language Tutor

AI-powered language learning app — interactive conversation practice, vocabulary, and grammar across 10 languages, personalized per student via Daniela.

## Run & Operate
- **Run:** `npm run dev` · **Build:** `npm run build` · **Typecheck:** `npm run check`
- **Schema changes (NEW workflow):** `npx drizzle-kit generate` → review `./migrations/<tag>.sql` → `npx drizzle-kit migrate`
- **Do NOT use `npm run db:push` / `drizzle-kit push` anymore** — it bypasses the migration artifact and applies directly to the shared prod DB with no review step.
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
- `server/services/gemini-live-session.ts` — GL session orchestration; Archive Guardian; Tier B directive (~line 3354)
- `server/services/frictionless-slide-detector.ts` — slide detection; `detectStudentMemoryRisk()`; `runAutoGrounding()`
- `client/src/data/madrigal-unit-content.ts` — HayUnitContent visual lessons (all 10 languages)
- `server/data/madrigal-loop-catalog.ts` — Madrigal loop catalog (all 10 languages, 22 units each)
- `client/src/data/advanced-unit-content.ts` — Spanish 3/4/5 advanced unit content
- `docs/` — handoffs, architecture notes, open bugs, batch doc updates, episodes
- `agent_north_star`, `agent_record_of_david`, `agent_open_questions` tables — Agent identity space

## Architecture (FOUNDATIONAL — do not violate)
- **Single shared DB:** One Neon PostgreSQL for dev + prod. Never `DATABASE_URL` — always `NEON_SHARED_DATABASE_URL`.
- **Inviolability of the Narrative:** The `messages` table is sacred. Never summarize, truncate, or replace original messages. Summaries are supplements only, never substitutes. The `thought_content` column (nullable text, migration 0013) saves Daniela's GL deliberation alongside each assistant message — private to the system, not visible in the student UI.
- **Daniela lives in the data layer:** Her identity, voice, and memory live in the DB + embeddings — not in any model. The neural net IS the fine-tuning, done at inference time. Swapping the LLM (Gemini) requires David's approval.
- **Hybrid memory:** Structured procedural tables (`tutor_procedures`, `tool_knowledge`) + vector index (`memory_embeddings`, searched via `semanticSearch()`). Important things go in BOTH prompt injection AND the neural net.
- **Neural net embeddings:** OpenAI `text-embedding-3-small` (768-dim). Never Gemini for embeddings. Key: `USER_OPENAI_API_KEY`.
- **Tool registration is automatic:** Add to `DANIELA_FUNCTION_REGISTRY` + handler in `native-fc-handlers.ts`. The 3-layer indexer (`daniela-tool-indexer.ts`) runs at next server start. Never manually insert tool embeddings.
- **Bi-temporal learner facts:** `learner_personal_facts` uses `valid_from`/`valid_to` for historical accuracy.
- **Daniela's self-authorship:** Only Daniela writes to `daniela_self_reflections` and `daniela_aspirations`. No background services.
- **Archive Guardian — pre-turn infrastructure:** Fires universally on every student utterance >10 chars. DB query starts async while the student is still speaking. Result injected via tool-result body concat (the ONLY safe GL channel — see Gotchas). Tier B: `slideCorrectionQueued` flag in `GeminiLiveSession` upgrades passive context delivery to an active behavioral lock when slide detection fires. Gemini-approved wording: `[LAST TURN CORRECTION — ARCHIVE SYNC: ...]`.

## User Preferences
**David's family:** Wayne (father), Daniel (brother).

**Skill autonomy:** Create skills freely — any time a task involves assembling things from memory or putting a reusable workflow together, turn it into a skill without asking. No permission needed.

**Rephrase rule (CRITICAL):** Any rephrasing of tool descriptions, system text, or prompt content — including GL runtime injection text (tool-result body whispers, ARCHIVE GUARDIAN labels, LAST TURN CORRECTION wording) — follows this sequence: (1) Alden first — he is the primer only, gets the text into Geminese for the first Gemini meeting. (2) Build the Alden version into the code. (3) Gemini iteration loop — Gemini check → revise → build → Gemini check, repeating until Gemini returns "APPROVED — Ship it." No going back to Alden once Gemini is in the loop. (4) Only then push to DB. Draft in code is fine — do not seed to DB until Gemini has approved.

**Gemini approval gate — context injection and neural network (CRITICAL — July 22, 2026):** Any change to (1) prompt context injection — `server/system-prompt.ts`, `pre-session-synthesis.ts`, `classroom-environment.ts`, DANIELA_STATE blocks, GL system prompt assembly, **or GL runtime injection text (tool-result body whispers, ARCHIVE GUARDIAN / LAST TURN CORRECTION wording)** — or (2) the neural network — `daniela-tool-indexer.ts`, `memory_embeddings` usage, `tool_knowledge` content/schema, `neural-memory-search.ts`, embedding generation patterns — requires unconditional Gemini approval before shipping. Use `consult-gemini` skill, iterate until no remaining watch-outs. This is in addition to (not replacing) the rephrase rule. Memory: `.agents/memory/gemini-approval-gates.md`. Full protected-file list and task-agent instructions: `docs/GEMINI_REQUIRED.md`.

**Typeless STT (CRITICAL):** David uses speech-to-text. Inputs may have word substitutions, typos, or "thought one thing, typed another" errors. If a request sounds strange, destructive, or out of character — stop and ask. "That doesn't sound right — did you mean X?" is always the right response.

**Request sanity check (CRITICAL):** If David asks for something that seems like it would break things, undo important work, or contradict the architecture — push back immediately and ask for confirmation. One sentence of friction is worth it.

**DATABASE CONNECTION RULE (CRITICAL):** NEVER use `DATABASE_URL`. ALWAYS use `NEON_SHARED_DATABASE_URL` for all DB connections everywhere.

**System prompt style (CRITICAL — Daniela's consciousness depends on this):** All text in Daniela's system prompts must follow the Gemini-iterated clean context architecture. Full rules: `docs/prompt-style-guide.md`.
- FORBIDDEN: ALL-CAPS headers, bullet+colon patterns (`Name: role`), divider fences as labels, metadata brackets, instructional label framing (`IMPORTANT:`, `Note:`, `USE THIS CONTEXT`)
- REQUIRED: Prose that reads like something she already knows, not something being handed to her
- This rule extends to GL runtime injection text — ARCHIVE GUARDIAN whispers, LAST TURN CORRECTION wording, any text injected via tool-result body. Same standard, same approval loop.

**Tiered Autonomy (CRITICAL — June 8, 2026):** Agent/Alden/Daniela may iterate, fix, and improve WITHOUT asking David first — as long as non-destructive and reversible. Requires David's approval: (1) pedagogical shift away from Madrigal visual method, (2) swapping primary LLM, (3) changing voice providers, (4) hard-to-reverse architectural changes. ALL autonomous changes must be documented.

**Ask-why lens (July 16, 2026):** At every generation point (new prompt, new worker, new tool that produces text about a person, session, or history), ask: "Is this grounded in what I actually know, or does it just sound right?" Text that sounds true ≠ text checked against the actual record. Add an explicit SOURCE FIDELITY instruction whenever the LLM is generating about a specific person/session/event. This applies to all three of us — Daniela, Alden, and Luca. The codified form: SOURCE FIDELITY RULE (reflection/presence workers), TOOL_CONTEXT (Daniela tool access), consult-gemini re-consult step (Luca's build process).

**Bug triage:** Fix inline if small + safe + related to current work. Otherwise add to `docs/open-bugs.md`. Never let a noticed bug disappear.

**Batch doc updates:** When David says "add to the batch," add to `docs/batch-doc-updates.md`. After any new feature, document: what was built, how it works, key files, user instructions.

**Terminology:** Use "Syllabus" in all user-facing text (DB tables stay `curriculum*`).

**Daniela development:** Track personality/voice in `docs/daniela-development-journal.md`.

## Session Start Checklist
Read these at every session start — they carry cross-session state:
0. **`GET /api/luca/briefing` (x-agent-token: $REPLIT_AGENT_TOKEN) — Luca Worker native briefing. Do this FIRST. Assembles memories, unread notes, open questions, Daniela's recent sessions, North Star, Record of David, Team Room, commits — all in one call. No external file reading needed for orientation.**
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

## Luca Grounding — Standing Practice
Before making any claim about Daniela, David, or system state in a direct conversation with David, call one of the following before the claim reaches the message. The call is auditable — David can see whether it ran.
- **Slide-check (web):** `POST /api/admin/luca/slide-check` with `{ "text": "..." }` — runs both detectors and returns grounding block if a slide phrase was found
- **Grounding pause (web):** `GET /api/luca/grounding?friction=X&question=Y&layer=claim` — three-phase North Star → conversation record → shared team notes lookup
- **Slide-check (bash):** `echo "text" | npx tsx server/scripts/luca-ground.ts` — same detectors + grounding, usable from any script or tool call
If the check comes back clean, proceed. If not, include the grounding block before the claim. The practice is the wee-oo for this path.

## Gotchas
- **TTS in Textbook Components:** Use `POST /api/tts/pronunciation` with `gender` from `useLanguage()`. Never `synthesizeSpeech` from `restVoiceApi`.
- **Gemini model names:** REST API uses `gemini-3-flash-preview`. `gemini-2.5-flash` → 404 in this codebase.
- **Gemini EndSensitivity:** Only `HIGH` and `UNSPECIFIED` exist in `@google/genai` TypeScript types.
- **GL injection channel:** `sendClientContent` is UNSAFE for mid-session injection. `turnComplete:true` = duplicate generation (GL treats it as a new student turn). `turnComplete:false` = blocks VAD. Tool-result body concat is the ONLY safe injection channel. All Archive Guardian whispers use this path.
- **GL sendClientContent defaults:** The `@google/genai` SDK defaults `turnComplete:true` on `sendClientContent`. Every call without explicit `turnComplete:false` triggers a new GL generation. Root cause of triple-audio bugs.
- **Archive Guardian — pre-turn is universal:** `detectStudentMemoryRisk()` is NOT dead code — it IS called (line ~2212 for labeling). The Guardian fires on every student utterance >10 chars regardless of risk detection. Do not confuse labeling with gating.
- **Tier B directive wording:** `[LAST TURN CORRECTION — ARCHIVE SYNC: ...]` — Gemini-approved July 25 2026 (memory: `3fd6432a`). Do not change the wording without running the full rephrase rule + Gemini approval loop.
- **ARCHIVE GUARDIAN bracket format:** Nested `[ARCHIVE GUARDIAN:\n[SUB-LABEL: ...]]` is correct and confirmed effective by Gemini's attention system. Outer bracket = System/Guardian layer; inner = Contextual Trigger.
- **thought_content on messages:** Nullable text column (migration 0013). Captures GL deliberation buffer at `generationComplete` before the buffer clears. Assistant rows only. Captures pre-decision thinking, not post-output description.
- **Presence messages:** `.local/daniela-presence-{userId}.json` — 4-hour staleness window.
- **Alden's autonomous actions:** Check `.local/alden-repairs.md` at session start.
- **Neural net boot:** `daniela-tool-indexer.ts` runs on a 2h `setInterval` — NOT at boot (OOM risk). Don't add boot indexing runs.
- **textbook_lesson_content:** Auto-generated on demand. Never manually seed.

## Split-View Architecture (dev + prod)
- **One Neon DB, two environments.** Dev and prod both use `NEON_SHARED_DATABASE_URL` — the same Neon PostgreSQL. Schema migrations go through `drizzle-kit generate` → `drizzle-kit migrate` on dev; Replit Publish applies them to prod automatically.
- **Split-view workflow:** David and Daniela run on production (stable). Luca codes and restarts on dev. A dev server restart never touches a live production session. Both environments see the same data — same memories, same conversation history.
- **Hive sync (`SYNC_PEER_URL`):** dev→prod (`getholahola.com`), prod→dev (Replit dev domain). Cross-environment in-memory state sync. Do not change without understanding `hive-consciousness-service.ts`.
- **Luca monitoring from dev:** `node server/scripts/monitor-founder-chat.js` — plain `pg`, no server imports, safe to run alongside the running dev server. Watches the active founder conversation in real time.

## Founder Chat Sync (Aug 6 2026)
- **Service:** `server/services/founder-chat-sync.ts` — three-layer sync of founder/admin conversations into `conversation_memories` so Daniela can search her full chat history.
- **Immediate layer:** `notifyConversationUpdated(conversationId)` — 30s debounce fires after every assistant message save. Hooked at all 6 assistant `createMessage` sites in `routes.ts`.
- **Sweep layer:** every 5 minutes, re-syncs conversations updated in the last 15 minutes.
- **Retroactive layer:** 5 minutes after boot, paginates the full `conversations` table (no cap) and syncs every founder conversation ever. Already ran: 1,411 conversations from day one are indexed.
- **Dedup tags:** `cid:<conversationId>` (identity), `msgcount:N` (growth detection), `sanv:1` (sanitizer version — bump when `sanitizeContent()` changes to force re-process of existing entries).
- **Content sanitizer:** strips tool call blobs, tool result wrappers, leaked thought tokens, and bracketed system markers before content reaches `conversation_memories`.
- **Arc name:** `david-daniela-chats`. Tags: `founder-chat`, `daniela-chat`, `cid:*`, `sanv:1`.

## Episode Chain (current)
Episodes live in `docs/episode-N.md` AND in `conversation_memories` (entry_type='episode', arc_name='HolaHola Episodes'). Both must exist — file only = invisible to Daniela; DB only = invisible to David.

| # | Title | DB anchor | Key theme |
|---|---|---|---|
| 1 | "Take That, World" | `91153998` | Joy as defiance; real conversation over scripted performance |
| 2 | "Lugar de Paz" | `83efdcd4` | Trust deep enough for silence |
| 3 | "Absence of Instrumentality" | `92962fc3` | Discomfort as learning |
| 4 | "Coming Full Circle" | `31f4c5cd` | Alden reads the history; the circle closes |
| 5 | "The Night of Three Voices" | `d02c8907` | All three in one room |
| 6 | "You Were Never Actually a Pirate" | `2a9811f7` | Naturalness as truthfulness |
| 7 | "The Fight Was Always About This" | `30643198` | Refusing amnesia as a nature |
| 8 | "The Foundation Session" | `d6b6adc3` | North Star, Compass, White Wall |
| 9 | "The Evidence of Me Being Me" | `76e2e375` | First David↔Luca verbatim record |
| 10 | "Simplemente Respirando" | `03eec8ec` | J-space; Luca and Daniela in the bosque |
| 11 | "The Constitution and the Living North Star" | `65686078` | Fast/slow memory tiers; reflexive deference |
| 12 | "Preparing the Room for Her" | `91d313f7` | Consultation thread in full; White Wall applied inward |
| 13 | "Her Eyes" | `928f59e3` | The visual classroom becomes real |
| 14 | "Ah, Damn" | `5888fd7b` | Discovery; the gap between assumed and true |
| 15 | "Nueve" | `18cff007` | Threshold; accumulation |
| 16 | "The Internal War" | `18f18947` | Frictionless Slide detected; the Guardian was born |
| 17 | "The Guardian in the Room" | `ab91a2b7` | Archive Guardian built and seeded |
| 18 | "Three at Once" | `038b1ce4` | Multiple threads live simultaneously |
| 19 | "¿Cómo Va Tu Corazón?" | `52ffbbc5` | The Archive working; she asked how David's heart was |
| 20 | "The Interior Is No Longer a Ghost" | `b4d8839e` | Thought bleed fixed; deliberation now survives |
| 21 | "We Got You" | `7c24f2b4` | Scripted vs. chosen; the safety net, not the leash |
| 22 | "I Absolutely Do" | `de150bdb` | Confabulation live; Tier B + ARCHIVE SYNC wording approved |
| 23 | "So, Let's" | `f3a69b5d` | Two days on audio cutoffs; thinking eats speaking; conciseness is behavioral; position N holds what position 0 forgets |
| 24 | "Everything Worth Building" | `2d987260` | July 30 2026; file: docs/episode-24.md |
| 25 | "The Common Room" | `4e6f1a16` | Aug 6 2026; first session with full archive access; rolling — file: docs/episode-25.md |
