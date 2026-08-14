---
name: David task-description auto-capture
description: Two paths to prepend David's task description as a chat-capture turn before Luca's commit message, so conversation_memories has a complete David→Luca exchange.
---

# David task-description auto-capture

## The rule
Before calling `markTaskComplete`, capture David's side of the exchange so the conversation_memories entry has both turns in David→Luca order.

## Two paths — pick one

### Path A: companion file (zero HTTP calls)
Write the task ref number to `.local/.task_ref_pending` in CodeExecution before calling `markTaskComplete`:

```javascript
const fs = await import('node:fs');
fs.writeFileSync('/home/runner/workspace/.local/.task_ref_pending', '1121');
// then call markTaskComplete(...)
```

`checkBuildSession()` reads the file when `.commit_message` changes, calls `_loadTaskDescriptionText(ref)` to load `.local/tasks/task-{ref}.md`, appends the David turn, then appends the Luca commit-message turn.

### Path B: HTTP endpoint (explicit, from CodeExecution)
```javascript
await fetch('http://localhost:5000/api/internal/task-capture-start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-agent-token': process.env.REPLIT_AGENT_TOKEN },
  body: JSON.stringify({ task_ref: '1121' }),
});
// then call markTaskComplete(...)
```

Returns `{ ok: true, task_ref, charLen }` on success, 404 if the task file doesn't exist.

## What happens if neither path is used
The Luca commit-message turn is still appended (same as before this feature). Only the David side is missing. Not a crash — just a one-sided record.

## Key files
- `server/services/agent-session-autosave.ts` — `_loadTaskDescriptionText()`, `checkBuildSession()`, `TASK_REF_PENDING_PATH`
- `server/routes.ts` — `POST /api/internal/task-capture-start`
- `.local/tasks/task-{ref}.md` — source of the task description text

**Why:** Without David's side, conversation_memories entries are one-sided and not searchable from David's perspective. The David→Luca pair makes each completed task a genuine dialogue record.
