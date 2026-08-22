---
name: System health verifier
description: Mandatory pre-completion check — run before marking any task done; catches missing tables, unwired workers, incomplete curriculum.
---

## The rule

Before marking any task done, run:

```
npx tsx server/scripts/verify-system-health.ts
```

Zero red failures required. Yellow warnings must be reviewed and either fixed or explicitly acknowledged.

**Why:** Tasks have been marked complete with missing DB tables, workers written but not wired, and curriculum unit counts below baseline. Typecheck cannot catch any of these.

## What it checks

- **26 DB tables** — existence confirmed via `information_schema.tables`
- **Seeded data** — row counts for can_do_statements (universal), tutor_procedures, tool_knowledge, agent_north_star
- **Curriculum alignment** — every non-Spanish language vs Spanish baseline; uses MAX across duplicate paths; flags any language with a level below baseline
- **Worker wiring** — long-running workers in server/index.ts; session-close workers in unified-ws-handler.ts
- **Pre-session synthesis** — confirms getLatestPedagogicalBrief and getMasteryDigest are imported and injected

## How to apply

- Run it at the end of every meaningful build session, before writing `.local/.commit_message`
- If you add a new table, worker, or seeded dataset this session, add a check for it to the script FIRST, then run it
- The one known persistent warning: Hebrew novice_low has 2 paths (intentional — David's decision June 22, 2026; "Hebrew 1 — Complete Beginner" may be folded into Hebrew 1 later)

## chapter_type NULL pattern

All L5 (advanced_low) units default to `advanced_unit`. L1/L2 thematic units map to their Spanish-baseline equivalent at the same `order_index`. Key types: `school`, `hobbies`, `food`, `vocabulary_cluster`, `verb_unit`, `skills`, `health`, `travel`, `culture`, `grammar_concept`, `technology`. When the verifier surfaces NULLs, look up the Spanish unit at the same order_index to determine the correct type.

## Location

`server/scripts/verify-system-health.ts` — also referenced in `holahola-build` and `holahola-session-end` skills
