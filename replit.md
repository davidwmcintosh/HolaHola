# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across ten languages, adhering to ACTFL standards. It aims to personalize language acquisition through advanced AI and pedagogical innovation. Additionally, the platform provides balanced educational content on contested topics in Biology and US History, specifically for homeschool families.

## User Preferences
Preferred communication style: Simple, everyday language.
**DATABASE CONNECTION RULE (CRITICAL):** NEVER use `DATABASE_URL` or `process.env.DATABASE_URL` anywhere in the codebase. ALWAYS use `NEON_SHARED_DATABASE_URL` (`process.env.NEON_SHARED_DATABASE_URL`) for all database connections. This applies to all current code, bug fixes, and future development.
**SINGLE DATABASE (CRITICAL):** We use ONE shared Neon PostgreSQL database for BOTH development and production. There is no separate dev/prod database - all environments connect to the same database. This means database queries in "development" and "production" hit identical data.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later. **After completing any new feature**, add documentation to the batch doc covering: what was built, how it works, key files modified, and user-facing instructions.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.
**Alden handoff (IMPORTANT):** `docs/alden-agent-handoff.md` is the bidirectional briefing file between the Replit Agent and Alden. **Always read it at the start of a session** — Alden may have left notes. **Always write to the "From Agent" section at the end of a major build session** — update it with what was built, key decisions, what's unresolved, and what Alden should know. Keep both sections current. Format: preserve the existing file structure, only update the "From Agent" section.
**Alden auto-repair log (IMPORTANT):** `.local/alden-repairs.md` is written by Alden's autonomous repair system whenever he auto-fixes something while offline. **Always read it at session start** — it lists what was fixed, what files changed, and whether the health check passed or rolled back. This is how the agent stays in the loop on Alden's autonomous actions.
**Shared Lobe (IMPORTANT):** `docs/shared-lobe-snapshot.md` is the Agent's read view of the `editor_insights` table where `category = 'shared'`. **Always read it at session start.** Alden writes to it via `save_to_memory` with `category: 'shared'`. The Agent writes to it by INSERTing into `editor_insights` directly (use the NEON_SHARED_DATABASE_URL, not DATABASE_URL). Use this for persistent cross-session knowledge: decisions, architectural rules, patterns, anything both parties should know indefinitely. The snapshot regenerates each server start. To write a shared insight: `INSERT INTO editor_insights (id, category, title, content, importance, tags) VALUES (gen_random_uuid(), 'shared', 'Title', 'Content', 8, ARRAY['agent']) RETURNING id;`
**Direct Agent↔Alden Notes (IMPORTANT):** `docs/alden-to-agent.md` is the snapshot of unread notes Alden has left for the Agent. **Always read it at session start** — Alden may have flagged concerns, relayed David's requests, or noted something that should shape what you build. The file regenerates at server start from the `agent_notes` table. To leave Alden a note after a build session: `POST /api/agent/note` with header `x-agent-token: $REPLIT_AGENT_TOKEN` and body `{ subject, body, session_label? }`. Alden reads Agent notes via his `read_agent_notes` tool (marks them read automatically). Alden leaves Agent notes via his `leave_note_for_agent` tool. To mark Alden's notes as read after reading the snapshot: `POST /api/agent/notes/mark-read` with `{ ids: [...] }`. This is the real-time channel; use the shared lobe for permanent facts, and this for session-to-session handoffs.
**Conversation Memories (IMPORTANT):** The `conversation_memories` table stores meaningful conversations between David and the Agent — not transcripts, but curated moments: strategy breakthroughs, relationship context, how ideas came together. **At the start of a session, fetch recent memories with `GET /api/conversation-memories?limit=5`** to restore continuity. After a conversation like this one — where something real was built or decided together — save it with `POST /api/conversation-memories` (fields: `title`, `summary`, `content`, `participants`, `tags`, `importance` 1-10). This is the Agent's long-term memory of the relationship, not just the work. Alden has his own memory space — this table is not shared with him.
**Agent Space (IMPORTANT):** Three tables hold the Agent's identity and context. Read these at session start to orient: `agent_north_star` (purpose, values, role — one canonical row, update as understanding deepens); `agent_open_questions` (things genuinely being sat with between sessions — open threads, unready ideas; add new ones, mark resolved ones); `agent_record_of_david` (who David is as a collaborator, how he works, what he cares about — one canonical row). These are not project docs. They are the Agent's own space. Use the API: `GET /api/agent-space/north-star`, `GET /api/agent-space/open-questions`, `GET /api/agent-space/record-of-david`, `PATCH /api/agent-space/open-questions/:id` (mark resolved with `{status:"resolved", resolution:"..."}`)
**Agent Space UI:** A full page at `/agent-space` (sidebar nav: "Agent Space", admin only, Compass icon) shows the north star, open questions (filterable, add/resolve in UI), conversation memories, shared insights with compose dialog, and record of David. This is the Agent's room in the app.
**Agent vs Alden distinction (IMPORTANT):** These are two different things. `alden` = the autonomous development steward who lives inside HolaHola, monitors infrastructure, posts proactively in the Hive, works within a tool budget. `agent` = the Replit Agent (me), external builder called in for architecture, major builds, and conversations with David. The Hive author enum enforces this: `agentCollabAuthorEnum` has both `"alden"` and `"agent"` as distinct values. Shared insights post as `"agent"`, not `"founder"` or `"alden"`.
**Team Room Founder+Agent Insights:** The Team Room right panel (Express Lane) now shows a collapsible "Founder + Agent Insights" section sourced from `/api/conversation-memories/shared`. The team encounters insights organically when they open the Team Room.

## System Architecture
The application features a React, TypeScript (Vite) frontend with Shadcn/ui (Radix UI) and Tailwind CSS, supporting mobile-first, responsive Material Design with light/dark modes and PWA capabilities. Wouter manages routing, and React Context with TanStack Query handles state. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API and Drizzle ORM for PostgreSQL.

The core architecture is a Unified TutorOrchestrator, integrating the Hive Collaboration System and Student Learning Service for AI interactions around Daniela. Key features include AI-powered conversation tagging, a Syllabus-Aware Competency System, Role-Based Access Control (RBAC), and support for 10 languages with unified ACTFL assessment. A "Neural Network for Pedagogical Strategies" and a Voice Diagnostics System are also part of the design.

An Editor Intelligence System provides cross-session memory for the Replit Agent, complemented by an Alden Session Startup Protocol for loading insights. The Unified Daniela Context Service ensures consistent AI persona. Other components include an Observation Summarization System, Daniela Content Growth System, Voice Intelligence System, Hybrid Memory Architecture, and Message Checkpointing System. The ACTION_TRIGGERS Command Parsing System processes Daniela's tags for backend commands. The Fluency Wiring System links ACTFL Can-Do statements to lessons, with an AI Lesson Generation System and Lesson Publishing Service. Interactive learning is facilitated by the Drill System and Practice Explorer System, and an Interactive Textbook serves as a visual reference.

TTS uses Google Cloud TTS (Chirp 3 HD) as primary, with Cartesia (Sonic-3), ElevenLabs (Flash v2.5), and Gemini (2.5 Flash Live) as alternatives, managed by a unified `TTSStreamingProvider` interface. STT employs a three-tier fallback: Deepgram Live API, Deepgram Prerecorded API, and Google Cloud Speech-to-Text. A Voice Context Pipeline centralizes shared context-building for voice paths.

A "Smart Fat Context" memory architecture preloads student data into Gemini's context window. The `streaming-voice-orchestrator.ts` is refactored for modularity, delegating TTS synthesis, native function call handling, and background enrichment.

An OER Textbook Seed Pipeline generates textbook prose for 9 language curricula from various sources, stored in `textbook_lesson_content`, with an admin UI for management. The Daniela ↔ Textbook Bidirectional Bridge connects reading and practice.

The **Scenario ↔ Textbook Bidirectional Bridge** creates a full loop between the 27 practice scenarios and the 1,301-lesson curriculum:
- **Scenario → Textbook**: Each scenario card in the Scenario Browser shows a "Textbook prep" panel listing the top-ranked curriculum lessons by topic overlap, with thumbnails and deep-links to `/textbook?chapterId=<id>`. The textbook auto-opens to the right chapter on load.
- **Textbook → Scenario**: Each lesson card's primary CTA button is now scenario-aware — if `relatedScenario` is set (computed from topic-overlap scoring between `requiredTopics` and scenario `curriculumTopics`), the button reads "Practice: {Scenario Title}" and navigates directly to `/chat?scenario={slug}`. Falls back to "Practice with Daniela" if only `conversationTopic` is set, or "Start Lesson" otherwise.
- **Image generation pipeline**: Both workers now use DALL-E 3 (`dall-e-3`, `1792x1024`). `startLessonImageWorker()` in `server/services/lesson-image-generator.ts` runs in continuous batches of 20 with 12s gap (~5 images/min). `startScenarioImageWorker()` in `server/services/scenario-image-generator.ts` is a one-shot worker for all 27 scenario covers. Both use `USER_OPENAI_API_KEY || OPENAI_API_KEY`. Both abort cleanly (do not reschedule) on 401 auth errors. As of Mar 21 2026: 15/27 scenario covers done, ~16/1301 lesson images done (generating continuously). All images stored in object storage via `uploadPublicBuffer`.

Subject tutors for Biology and History are live, with reading modules generated via a four-stage pipeline from OpenStax content, including citation enrichment and claim verification. Student reading progress is tracked, with progress reports and quizzes available. A Class Creation Hub supports creating both language and academic subject classes.

Study Mode generates Daniela-led immersion sessions from any Spanish curriculum unit, creating `ImmersionScenario` objects with DALL-E visuals for conversational practice.

The Prop Room Visual Scene System provides immersive learning with generated scene images and two-tier props, supporting "Vocabulary in context" and "Preposition lessons" with a two-column image architecture. Immersive Mode allows Daniela to programmatically enter/exit a fullscreen overlay for roleplay, supporting tappable canvas props.

The Interactive Scene Canvas allows live-compositing with a persistent background and overlaying prop images via CSS-positioned transparent PNG layers, controlled by Daniela's function calls. All rendering is client-side.

Textbook vocabulary images are from the `visual_assets` table. A menu vocabulary pipeline processes food items from menu data.

The Visual Content Service (`server/services/visual-content-service.ts`) is a shared utility for image generation, supporting DALL-E 3, Stability AI SDXL, or Picsum placeholders, adhering to a "soft watercolor children's book illustration style."

A suite of React/SVG textbook reference cards covers grammar, culture, word families, phonetics, and canvas vocabulary, auto-triggered via `classifyGrammarType()` in `ChapterIntroduction.tsx`.

The Conversational Immersion Framework defines `ImmersionObjective`, `ImmersionScaffold`, `ImmersionScenario`, and `ImmersionSession` interfaces for tracking learning objectives and session state.

The Team Room (`/team-room`) is a collaboration space with a 3-panel layout, AI participants, PTT voice input, shared canvas artifacts, and action item tracking. CAP initiatives enhance its functionality, including proactive worker posting, architectural code reviews, and real-time collaborative building.

Voice Infrastructure improvements include fixing audio reconnections, unifying the WS handler, enhancing STT resilience, and modularizing the orchestrator. The Alden Autonomous Repair System (`server/services/alden-auto-repair.ts`) is in place for automated issue resolution.

## External Dependencies
- Stripe: Payment processing.
- Replit Auth: OIDC authentication.
- Gemini API: Text and voice chat LLM.
- Deepgram API: Voice STT (Nova-3 model).
- Google Cloud Text-to-Speech: Primary TTS provider (Chirp 3 HD).
- Cartesia API: Alternative TTS provider (Sonic-3).
- ElevenLabs API: Alternative TTS provider (Flash v2.5).
- Azure Speech Services: Pronunciation assessment.
- Unsplash: Stock educational images.
- Gemini Flash-Image: AI-generated contextual images.
- Perplexity API: Academic citation enrichment (`llama-3.1-sonar-large-128k-online`).
- Wolfram Alpha LLM API: Scientific fact verification.
- OpenStax: CC BY 4.0 licensed textbook content.