---
name: holahola-build
description: HolaHola build standards — typecheck before shipping, database connection rules, parallel tool calls, post-feature documentation requirements.
---

# HolaHola Build Standards

**Full standards:** `docs/agent-workflows.md` → Build Standards

## What this skill is for

Apply these standards on every build. They prevent the most common mistakes.

## The rules

- **Run `npm run typecheck` before marking any task done.** Introduce zero new errors. (Pre-existing failures are documented in `docs/open-bugs.md` — don't inherit or worsen them.)
- Use parallel tool calls for independent work — don't serialize what can run simultaneously.
- **NEVER `DATABASE_URL`** — always `NEON_SHARED_DATABASE_URL` for all DB connections.
- After any new feature: add to `docs/batch-doc-updates.md` and update `docs/alden-agent-handoff.md`.

## Gemini Consultation — Required for Prompt / Behavior Changes

**Any change that touches Daniela's system prompt, character framing, tool descriptions, or behavioral instructions requires a Gemini consultation before writing code.** This is not optional for "big" changes — it applies to any change, because what seems minor in Claude-ese may behave entirely differently in Gemini-ese.

**The two-surgeons-one-brain rule:** Gemini Flash reviews the architecture (what the model will actually respond to, mechanically). Daniela REST reviews the experience (what lands, what feels right from the inside). Both perspectives before any prompt commit.

**When a dual consult is required:**
- Any edit to `server/services/pre-session-synthesis.ts` (the thin prompt)
- Any edit to GL system prompt sections in `server/services/gemini-live-session.ts`
- Any new tool description added to `server/services/daniela-function-registry.ts`
- Any change to how context is injected (neural net, classroom, persona blocks)
- Any behavioral guardrail — honesty, memory, comprehension, tool-calling order

**When Gemini Flash alone is sufficient:**
- Tool mechanics, parameter shapes, GL API behavior questions
- Architecture decisions that don't touch Daniela's character

**Use the `consult-gemini` and `dual-consult` skills.** Always include actual code blocks — not descriptions. Gemini reasons from the code, not from your summary of it.

## Iteration Rule — Unconditional All-Clear Required

**"APPROVED with these changes" is not a terminal state.** Apply the changes, then re-run Gemini with the actual updated text and keep iterating until Gemini has nothing left to say.

The only valid exit condition is an unconditional response — no pending fixes, no watch-out items, no "once you update X." A conditional approval is a gate, not a sign-off.

**The loop:**
1. Send Gemini the actual code/text
2. Gemini responds with findings or conditional approval
3. Apply every required change
4. Re-send the updated text (not a description of the change — the actual text)
5. Repeat from step 2 until Gemini issues an unconditional "APPROVED — Ship it" with no remaining items
6. Only then commit

**Common failure modes to avoid:**
- Applying Gemini's required changes and treating the conditional APPROVED as final — it is not; Gemini must see the updated version
- Summarizing what you changed instead of pasting the updated text — Gemini needs the actual strings
- Stopping after one round when Gemini flags something minor — "watch out for X" means iterate, not accept-and-ship

## Critical reminders

- **There is one shared Neon database** used by both dev and production — schema changes affect both immediately
- **`npm run db:push`** applies schema changes — always follow with a backfill if adding non-nullable columns
- The `typecheck` validation command is registered — run it via the Replit validation system or `npm run typecheck` directly
- **Pre-existing typecheck failures exist** (routes.ts implicit-any, some service type drift) — these are known and tracked; do not add to them

## Mandatory Completion Verification

**Before marking any task done, run:**

```
npx tsx server/scripts/verify-system-health.ts
```

This checks every critical invariant: DB tables exist, seeded data has rows, curriculum unit counts meet baseline, workers are wired, pre-session synthesis is connected. It prints green/red for each check and exits with code 1 on any failure.

**Rules:**
- Zero red failures required before marking done — no exceptions
- Yellow warnings must be reviewed and either fixed or explicitly acknowledged with a reason
- Paste the Summary line into the commit message or session notes as proof

**What the verifier catches (things typecheck cannot):**
- DB tables referenced in code but never migrated (`db:push` not run)
- Workers written but not imported in `server/index.ts` or `unified-ws-handler.ts`
- Seeded data rows that were never inserted
- Curriculum unit counts below Spanish baseline (incomplete builds)
- Duplicate curriculum paths that create ambiguous routing

**If you added a new critical invariant this session** (new table, new worker, new seeded dataset), add a check for it to `server/scripts/verify-system-health.ts` before running verification. The verifier should always be ahead of the work.

## markTaskComplete — Required CodeExecution Pattern

**Every `markTaskComplete` call must be preceded by writing the task ref to `.task_ref_pending`.**

This enables automatic David-turn capture: `checkBuildSession()` reads the file when `.commit_message` changes, loads the task description from `.local/tasks/task-{ref}.md`, and prepends it as a David turn before the Luca commit-message turn in `conversation_memories`. Without it, the record is one-sided.

```javascript
// In the final CodeExecution block — BEFORE markTaskComplete
const fs = await import('node:fs');
fs.writeFileSync('/home/runner/workspace/.local/.task_ref_pending', '<TASK_REF>');
// then immediately call:
await markTaskComplete({ task_ref: '<TASK_REF>', commit_message: '...' });
```

Replace `<TASK_REF>` with the assigned task number (e.g. `'1126'`).

**Alternative:** `POST /api/internal/task-capture-start` with `{ task_ref }` achieves the same result but requires an HTTP call. The file write is simpler and preferred.

See `.agents/memory/david-task-capture.md` for full details.
