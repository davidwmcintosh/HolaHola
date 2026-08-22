---
name: Alden model — Fable 5 upgrade
description: Alden upgraded from claude-sonnet-4-5 to claude-fable-5 on June 12 2026. Also covers the original audit plan and the memory failure that caused it to be lost.
---

# Alden Model: claude-fable-5

**Upgraded:** June 12, 2026

**Files changed:**
- `server/services/alden-auto-repair.ts`
- `server/services/alden-build-service.ts`
- `server/services/alden-code-review-service.ts`
- `server/services/alden-digest-worker.ts`
- `server/services/alden-persona-service.ts`
- `server/services/alden-watch-worker.ts`

All model strings and cost-tracker strings changed from `claude-sonnet-4-5` → `claude-fable-5`.

**Why:** David confirmed this was the plan from the start of the June 12 session. Claude Fable 5 released June 9, 2026. Mythos-class, above Opus tier. 1M context window, 128k max output. $10/$50 per million tokens. API model ID: `claude-fable-5`.

## The Code Audit Plan (June 12)

The original morning plan was to run 6-area parallel code audits using claude-fable-5 as the reviewer. What actually happened: the audits ran through Agent's internal explore subagent tool (not a direct claude-fable-5 API call). The findings and fixes were real and valuable, but the reviewer was not Fable 5 as planned.

**The session compression problem:** The morning plan was never saved to `conversation_memories`. When the session compressed, the plan was lost. David had to reconstruct it from memory. This is a critical failure pattern.

**Fix going forward:** Save session plans to `conversation_memories` at the START of any session that establishes a plan, not at the end. Use `POST /api/conversation-memories` with `entry_type: "decision"` and `importance: 9`.

## claude-fable-5 API facts
- Anthropic API env var: `ANTHROPIC_API_KEY` (already configured in all Alden services)
- `stop_reason: "refusal"` on declined requests — returns HTTP 200, not an error
- Adaptive thinking only — `thinking: {"type": "disabled"}` not supported
- Use `effort` parameter to control thinking depth
