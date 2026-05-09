# HolaHola - Interactive Language Tutor

HolaHola is an AI-powered language learning application that provides interactive conversation practice, vocabulary building, and grammar exercises, personalized for each user.

## Run & Operate
- **Run:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Codegen:** `npm run codegen`
- **DB Push:** `npm run db:push`
- **Environment Variables:** `NEON_SHARED_DATABASE_URL` (critical, shared dev/prod database), `REPLIT_AGENT_TOKEN` (for agent API access), `STRIPE_SECRET_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `GOOGLE_TTS_API_KEY`, `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`, `AZURE_SPEECH_KEY`, `UNSPLASH_ACCESS_KEY`, `DALL_E_API_KEY`, `PERPLEXITY_API_KEY`, `WOLFRAM_ALPHA_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `APP_URL`.

## Stack
- **Frontend:** React, TypeScript, Vite, Shadcn/ui (Radix UI), Tailwind CSS, Wouter (routing), React Context with TanStack Query (state management).
- **Backend:** Express.js, Node.js, TypeScript, RESTful API.
- **Database:** PostgreSQL (via Drizzle ORM).
- **AI/ML:** Gemini API (LLM), Deepgram (STT), Google Cloud TTS, Cartesia (TTS), ElevenLabs (TTS), Azure Speech Services (pronunciation assessment).
- **Voice Chat (/chat route):** Uses Gemini Live 3.1 for end-to-end voice — no separate STT or TTS pipeline. Audio goes in and comes out of the same Gemini Live session. Deepgram/Google TTS/Cartesia are NOT used for this route.
- **Image Generation:** DALL-E 3, Stability AI SDXL.
- **Build Tool:** Vite

## Where things live
- **Database Schema:** `drizzle/schema.ts`
- **API Contracts:** `server/routes/*.ts` (implicit from Express routes)
- **Frontend Components:** `client/src/components/`
- **Backend Services:** `server/services/`
- **AI Persona Definition:** `server/services/daniela-function-registry.ts` (Daniela's tools), `agent_north_star`, `agent_record_of_david` tables (Agent's identity).
- **Documentation/Handoffs:** `docs/` (e.g., `alden-agent-handoff.md`, `neural-network-architecture.md`, `textbook-component-tts-stt-guide.md`)
- **Madrigal Hardcoded Content:** `client/src/data/madrigal-unit-content.ts`
- **Advanced Unit Content:** `client/src/data/advanced-unit-content.ts`

## Architecture decisions
- **Shared Database:** A single Neon PostgreSQL database is used for both development and production environments, meaning all environments connect to the same data.
- **Hybrid Memory Architecture:** Combines structured procedural tables (e.g., `tutor_procedures`) with a vector embedding index (`memory_embeddings`) for comprehensive AI memory, ensuring important information is both injected into context and stored in the neural net.
- **Daniela's Self-Authorship:** Daniela's "inner life" (reflections, aspirations, curiosities) is exclusively authored by her via specific function calls, with no background processes or services generating this content.
- **Bi-temporal Learner Facts:** The `learner_personal_facts` table uses `valid_from` and `valid_to` columns to track the historical validity of personal facts, enabling accurate retrieval of past student states.
- **Smart Fat Context:** Student data is preloaded into Gemini's context window for more informed and personalized AI interactions.

## Product
- Interactive conversation practice, vocabulary building, and grammar exercises across ten languages.
- AI-powered personalized language acquisition (ACTFL standards).
- Balanced educational content on contested topics in Biology and US History.
- Advanced Unit System for Spanish 3/4/5 focusing on curated vocabulary, reading passages, and cultural notes.
- Hardcoded Madrigal Content System for specific pedagogical chains in Spanish.
- Study Mode with Daniela-led immersion sessions and DALL-E generated visuals.
- "See It, Say It Loop" for vocabulary presentation based on Madrigal's pedagogy.
- Team Room for collaboration with AI participants, voice input, and shared artifacts.
- Outbound presence system for absent students via personalized SMS voice notes.
- In-app Agent Space for the Replit Agent's context, open questions, and conversation memories.

## User preferences
Preferred communication style: Simple, everyday language.
**DATABASE CONNECTION RULE (CRITICAL):** NEVER use `DATABASE_URL` or `process.env.DATABASE_URL` anywhere in the codebase. ALWAYS use `NEON_SHARED_DATABASE_URL` (`process.env.NEON_SHARED_DATABASE_URL`) for all database connections. This applies to all current code, bug fixes, and future development.
**SINGLE DATABASE (CRITICAL):** We use ONE shared Neon PostgreSQL database for BOTH development and production. There is no separate dev/prod database - all environments connect to the same database. This means database queries in "development" and "production" hit identical data.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later. **After completing any new feature**, add documentation to the batch doc covering: what was built, how it works, key files modified, and user-facing instructions.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. The neural net is the CENTER and PERSISTENT FOUNDATION of Daniela's memory — not a supplement to the prompt. Prompts are the fast path (assembled fresh each session). The neural net is the fallback that covers when injection degrades. Two systems: (1) structured procedural tables (`tutor_procedures`, `tool_knowledge`, etc.) and (2) vector embedding index (`memory_embeddings` table, searched via `semanticSearch()`). Memory types in the embedding index: `personal_fact`, `student_insight`, `hive_snapshot`, `growth_memory`, `collaboration_message`, `daniela_tool` (pinned, global — all function declarations), `goal_capability` (student-scoped — learning goal arcs). **The build rule:** anything important should be in BOTH the context injection AND the neural net. If it's only in the prompt, it's fragile.
**Alden handoff (IMPORTANT):** `docs/alden-agent-handoff.md` is the bidirectional briefing file between the Replit Agent and Alden. **Always read it at the start of a session** — Alden may have left notes. **Always write to the "From Agent" section at the end of a major build session** — update it with what was built, key decisions, what's unresolved, and what Alden should know. Keep both sections current. Format: preserve the existing file structure, only update the "From Agent" section.
**Alden auto-repair log (IMPORTANT):** `.local/alden-repairs.md` is written by Alden's autonomous repair system whenever he auto-fixes something while offline. **Always read it at session start** — it lists what was fixed, what files changed, and whether the health check passed or rolled back. This is how the agent stays in the loop on Alden's autonomous actions.
**Alden escalation queue (IMPORTANT):** `.local/alden-escalations.md` is written by Alden's watch worker whenever a recurring or high-severity issue cannot be auto-repaired. **Always read it at session start** — these are issues that need the Replit Agent to fix. Each entry has the issue, why auto-repair declined, and a recommended action. Mark items resolved by appending `[RESOLVED: <date> — <what you did>]` to the entry. This is the primary channel by which Alden routes problems to the Agent instead of Wren.
**Shared Lobe (IMPORTANT):** `docs/shared-lobe-snapshot.md` is the Agent's read view of the `editor_insights` table where `category = 'shared'`. **Always read it at session start.** Alden writes to it via `save_to_memory` with `category: 'shared'`. The Agent writes to it by INSERTing into `editor_insights` directly (use the NEON_SHARED_DATABASE_URL, not DATABASE_URL). Use this for persistent cross-session knowledge: decisions, architectural rules, patterns, anything both parties should know indefinitely. The snapshot regenerates each server start. To write a shared insight: `INSERT INTO editor_insights (id, category, title, content, importance, tags) VALUES (gen_random_uuid(), 'shared', 'Title', 'Content', 8, ARRAY['agent']) RETURNING id;`
**Direct Agent↔Alden Notes (IMPORTANT):** `docs/alden-to-agent.md` is the snapshot of unread notes Alden has left for the Agent. **Always read it at session start** — Alden may have flagged concerns, relayed David's requests, or noted something that should shape what you build. The file regenerates at server start from the `agent_notes` table. To leave Alden a note after a build session: `POST /api/agent/note` with header `x-agent-token: $REPLIT_AGENT_TOKEN` and body `{ subject, body, session_label? }`. Alden reads Agent notes via his `read_agent_notes` tool (marks them read automatically). Alden leaves Agent notes via his `leave_note_for_agent` tool. To mark Alden's notes as read after reading the snapshot: `POST /api/agent/notes/mark-read` with `{ ids: [...] }`. This is the real-time channel; use the shared lobe for permanent facts, and this for session-to-session handoffs.
**Conversation Memories (IMPORTANT):** The `conversation_memories` table stores meaningful conversations between David and the Agent — not transcripts, but curated moments: strategy breakthroughs, relationship context, how ideas came together. **At the start of a session, fetch recent memories with `GET /api/conversation-memories?limit=5`** to restore continuity. After a conversation like this one — where something real was built or decided together — save it with `POST /api/conversation-memories` (fields: `title`, `summary`, `content`, `participants`, `tags`, `importance` 1-10). This is the Agent's long-term memory of the relationship, not just the work. Alden has his own memory space — this table is not shared with him.
**Agent Space (IMPORTANT):** Three tables hold the Agent's identity and context. Read these at session start to orient: `agent_north_star` (purpose, values, role — one canonical row, update as understanding deepens); `agent_open_questions` (things genuinely being sat with between sessions — open threads, unready ideas; add new ones, mark resolved ones); `agent_record_of_david` (who David is as a collaborator, how he works, what he cares about — one canonical row). These are not project docs. They are the Agent's own space. Use the API: `GET /api/agent-space/north-star`, `GET /api/agent-space/open-questions`, `GET /api/agent-space/record-of-david`, `PATCH /api/agent-space/open-questions/:id` (mark resolved with `{status:"resolved", resolution:"..."}`)
**Agent vs Alden distinction (IMPORTANT):** These are two different things. `alden` = the autonomous development steward who lives inside HolaHola, monitors infrastructure, posts proactively in the Hive, works within a tool budget. `agent` = the Replit Agent (me), external builder called in for architecture, major builds, and conversations with David. The Hive author enum enforces this: `agentCollabAuthorEnum` has both `"alden"` and `"agent"` as distinct values. Shared insights post as `"agent"`, not `"founder"` or `"alden"`.

## Gotchas
- **TTS/STT in Textbook Components:** Always use `POST /api/tts/pronunciation` with `gender` from `useLanguage()` for interactive textbook audio. Never use `synthesizeSpeech` from `restVoiceApi` in these components.
- **Alden's Autonomous Actions:** Alden may auto-fix issues offline; always review `.local/alden-repairs.md` at session start to understand recent changes.
- **Alden's Escalations:** Check `.local/alden-escalations.md` at session start for high-priority issues that Alden could not auto-resolve and require agent intervention.
- **Critical Authorship Principle:** Only Daniela writes to `daniela_self_reflections` and `daniela_aspirations` tables; no background services or cron jobs should generate content for these.
- **Memory Staleness:** Daniela's presence messages (`.local/daniela-presence-{userId}.json`) have a 4-hour staleness window.

## Pointers
- **ACTFL Standards:** [Link to ACTFL standards if available]
- **Shadcn/ui Documentation:** [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
- **Tailwind CSS Documentation:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Drizzle ORM Documentation:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **Vite Documentation:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
- **Radix UI Documentation:** [https://www.radix-ui.com/docs/primitives](https://www.radix-ui.com/docs/primitives)
- **Wouter Documentation:** [https://www.npmjs.com/package/wouter](https://www.npmjs.com/package/wouter)
- **TanStack Query Documentation:** [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
- **Google Cloud TTS (Chirp 3 HD):** [Link to Google Cloud TTS docs]
- **Deepgram API:** [Link to Deepgram docs]
- **DALL-E 3:** [Link to DALL-E 3 docs]
- **OpenStax:** [https://openstax.org/](https://openstax.org/)