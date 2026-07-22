# HolaHola — Agent Workflows

> **Canonical, platform-neutral reference for all repeatable Agent workflows.**
> This document is the source of truth. The `.agents/skills/holahola-*/SKILL.md` files are thin Replit-convenience wrappers that point here.
> If HolaHola ever moves off Replit, this document moves with it unchanged.

---

## Session Start Checklist

Read all of these **before touching code**. In order:

1. **`docs/alden-agent-handoff.md`** — what Alden left for the Agent. Look for the most recent "From Alden" section.
2. **`.local/alden-escalations.md`** — high-priority issues Alden couldn't auto-repair. These need Agent attention first.
3. **`.local/alden-repairs.md`** — what Alden auto-fixed since last session. Understand any changes before writing code.
4. **`docs/alden-to-agent.md`** — Alden's direct notes (snapshot from `agent_notes` table). Address flagged items before building.
5. **`docs/shared-lobe-snapshot.md`** — shared cross-session knowledge (from `editor_insights` where `category = 'shared'`). Permanent architectural facts live here.
6. **Recent conversation memories** — `GET /api/conversation-memories?limit=5` — last 5 meaningful sessions, verbatim. Restores continuity.
7. **Agent identity tables** — `GET /api/agent-space/north-star`, `/open-questions`, `/record-of-david`. Orient before building.
8. **Mark Alden's notes as read** — `POST /api/agent/notes/mark-read` with the unread IDs from step 4.
9. **Address open escalations** before writing any code.

---

## Session End Checklist

Do all of these **before closing a session**. In order:

**Pre-step — Read the full day before writing anything:**
Pull today's conversation_memories and read the full content, not just summaries.
```
GET /api/conversation-memories?limit=10
```
Then read the full `content` field of each entry. The periodic captures have verbatim turn-by-turn records — they give context the scratchpad misses (exact moments decisions were made, what David actually said, symmetries between early-session observations and late-session builds). Write the wrap-up from this picture, not from memory alone.

While reading, also scan for **forward plans and agreements** — anything David and Luca agreed to do in a coming session (test protocols, question lists, tomorrow's agenda, commitments). These are distinct from open threads (nothing was left undone today) and distinct from code changes. If found and not yet saved as a discrete `conversation_memories` entry, save them now before closing. The bulk autosave captures the full session but won't surface a specific plan as a standalone searchable item unless it was explicitly saved.

1. **Update handoff** — `docs/alden-agent-handoff.md` "From Luca" section. What was built, key decisions, what's unresolved, what Alden should know. Preserve existing file structure.
2. **Add to batch doc** — `docs/batch-doc-updates.md`. What was built, how it works, key files modified, user-facing instructions. One entry per feature.
3. **Shared lobe insight (if warranted)** — if a durable cross-session architectural fact was established:
   ```sql
   INSERT INTO editor_insights (id, category, title, content, importance, tags)
   VALUES (gen_random_uuid(), 'shared', 'Title', 'Content', 8, ARRAY['agent'])
   RETURNING id;
   ```
   Use `NEON_SHARED_DATABASE_URL`. Only write facts that would still matter 6 months from now.
4. **Leave Alden a note (if anything affects monitoring)** — `POST /api/agent/note` with header `x-agent-token: $REPLIT_AGENT_TOKEN` and body `{ subject, body }`.
5. **Save conversation memory (if this session was meaningful)** — `POST /api/conversation-memories` with fields: `title`, `summary`, `content` (verbatim transcript — NOT a summary), `participants`, `tags`, `importance` (1–10). The `content` field must be the actual words, not a description.
6. **Update `.agents/memory/MEMORY.md`** — one-line index entries pointing to topic files. Only durable lessons not derivable from the code.
7. **Periodic deep security scan gate** — check the "Last deep security scan" date in `docs/alden-agent-handoff.md`. If it has been 90+ days, or if significant new auth/payment/endpoint code was shipped this session, run the full HoundDog scan before closing:
   ```
   // In code_execution sandbox:
   const { runHoundDogScan } = await import('./.local/skills/security_scan/SKILL.md');
   // (follow security_scan skill instructions)
   ```
   After running: log any new findings to `docs/open-bugs.md`, patch what's safe to patch inline, and update the "Last deep security scan" date in the handoff.
   Note: `npm audit` (dependency CVEs) is covered automatically by Wren every 6h — this gate is only for the HoundDog data-flow analysis that Wren cannot run.

---

## Build Standards

- **Always run `npm run typecheck` before marking a task done.** Fix any errors before shipping.
- Use parallel tool calls for independent work streams — don't serialize what can run simultaneously.
- **NEVER use `DATABASE_URL` or `process.env.DATABASE_URL`** anywhere in the codebase. Always `NEON_SHARED_DATABASE_URL`.
- **Mid-session plan saves (do this immediately, not at session end):** When David and Luca agree on a plan, test protocol, question list, or forward commitment for a future session, save it as a discrete `conversation_memories` entry right then — high importance, tagged, capturing the actual exchange verbatim. The bulk autosave will bury it in a session transcript; a discrete save makes it searchable and surfaceable at tomorrow's session start. Also write it to a `.local/` file if it needs to be found by path. Do not wait for the session-end checklist.
- After any new feature: add to batch doc, update handoff.
- New Daniela tool pipeline — only 3 steps needed, everything else is automatic (see Adding a Daniela Tool below).

---

## Schema Change Rules

1. **Update `shared/schema.ts` first** — this is the source of truth for all table definitions.
2. **Run `npm run db:push`** to apply the schema to the shared Neon database.
3. **Backfill existing rows** if adding non-nullable columns without a default.
4. **Document the migration** in the session-end handoff (what changed, why, any backfill done).

> **Critical:** The shared Neon database is used by BOTH development and production. A schema push affects both environments immediately. There is no separate dev/prod database.

---

## Neural Net Rules

> Read `docs/neural-network-architecture.md` before any neural net changes.

- **Three layers of memory:** North Star (who Daniela IS) → Neural Network / procedural tables (HOW she operates) → System prompt (WHAT is happening now in this session).
- **Embedding model:** OpenAI `text-embedding-3-small` (768-dimensional). Requires `USER_OPENAI_API_KEY`. NOT Gemini. These are two separate AI systems with distinct roles.
- **The build rule:** Important things go in BOTH context injection AND the neural net. If it's only in the prompt, it's fragile.
- **Never manually index tool embeddings** — `server/services/daniela-tool-indexer.ts` handles the full 3-layer pipeline automatically at server start.
- **Procedural tables:** `tutor_procedures`, `tool_knowledge`, `teaching_principles`, `situational_patterns`, `self_best_practices`, `language_idioms`, `cultural_nuances`, `learner_error_patterns`, `dialect_variations`, `linguistic_bridges`.
- **Vector index:** `memory_embeddings` table, searched via `semanticSearch()`. Memory types: `personal_fact`, `student_insight`, `hive_snapshot`, `growth_memory`, `collaboration_message`, `daniela_tool`, `tool_knowledge`, `teaching_skill`, `goal_capability`.

---

## Adding a Daniela Tool

Only **3 steps** are needed. Everything else is automatic.

1. **Add to `DANIELA_FUNCTION_REGISTRY`** in `server/services/daniela-function-registry.ts`.
   - Define `legacyType` (ALL_CAPS_SNAKE), `declaration` (name, description, parametersJsonSchema), and `buildContinuationResponse`.
   - Write a rich description — the tool indexer uses it to auto-generate the neural net embedding and tool_knowledge row.
2. **Add handler case** in `server/services/native-fc-handlers.ts`.
   - Match on `fn.legacyType` in the main switch.
   - Store results in `session.yourResultsField` for the `buildContinuationResponse` to read.
3. **Decide GL exclusion** — if the tool is visual-only or has no voice utility, add its `legacyType` to `GL_EXCLUDED_TOOLS` in `streaming-voice-orchestrator.ts`.

**What happens automatically at next server start** (via `daniela-tool-indexer.ts`, runs at +100s):
- Layer 1: `daniela_tool` embedding created in `memory_embeddings` (pinned global, never decays)
- Layer 2: `tool_knowledge` row inserted (purpose, syntax, bestUsedFor — auto-derived from declaration)
- Layer 3: `tool_knowledge` embedding created in `memory_embeddings` (semantic search of toolkit)

All idempotent — safe to re-run. Hand-crafted `tool_knowledge` rows (richer examples, explicit `combinesWith`/`avoidWhen`) are **never overwritten** by the indexer.

> **Never manually index tool embeddings or insert `tool_knowledge` rows for a new tool** — the indexer handles it automatically.

---

## Teaching Skills (Daniela's Lesson Playbooks)

Teaching skills are **different from Replit skills**. They live in the `teaching_skills` database table and are invoked by Daniela during student sessions via `invoke_teaching_skill`. They are part of HolaHola and travel with the app anywhere it's deployed.

Replit skills (`.local/skills/`, `.agents/skills/`) are tools for the Agent while building — pdf, canvas, validation, etc. No overlap.

To add or modify a teaching skill:
- Skills are seeded in `server/services/teaching-skills-service.ts` in the `SEED_SKILLS` array.
- Each skill has: `name`, `title`, `description`, `triggerConditions`, `actflLevels`, `steps[]`.
- Each step has: `phase`, `instruction`, optionally `tool_call` (tool name + `params_template`), `listen_for`, `decision`.
- Re-seed by hitting `POST /api/teaching-skills/seed` (idempotent — upserts, never duplicates).
- Steps with a `tool_call` get a `⚡ MANDATORY FIRST ACTION` header prepended in `renderTeachingSkillScript` if they are Step 1, so Daniela calls the tool before speaking.

---

## Validation Gate

Before marking any task complete:

```
npm run typecheck
```

This is registered as the `typecheck` validation command. Run it via the Replit validation system or directly in the shell. Fix all errors before shipping.

---

## Key File Map

| Purpose | File |
|---------|------|
| Database schema | `shared/schema.ts` |
| Daniela tool registry | `server/services/daniela-function-registry.ts` |
| Tool call handlers | `server/services/native-fc-handlers.ts` |
| Teaching skills seed + renderer | `server/services/teaching-skills-service.ts` |
| Neural net tool indexer | `server/services/daniela-tool-indexer.ts` |
| Semantic memory / embeddings | `server/services/semantic-memory-service.ts` |
| Fat context builder | `server/services/fat-context-service.ts` |
| Voice session orchestrator | `server/services/streaming-voice-orchestrator.ts` |
| System prompt | `server/system-prompt.ts` |
| Neural net architecture doc | `docs/neural-network-architecture.md` |
| Alden↔Agent handoff | `docs/alden-agent-handoff.md` |
| Batch doc updates | `docs/batch-doc-updates.md` |
| Shared lobe snapshot | `docs/shared-lobe-snapshot.md` |
| Alden direct notes | `docs/alden-to-agent.md` |
| Alden escalations | `.local/alden-escalations.md` |
| Alden auto-repairs | `.local/alden-repairs.md` |
