---
name: Felt-moment scripts
description: Three scripts for immediate inner-life capture — mark-moment, mark-reflection, felt-moments. Drizzle array-binding fix required for dynamic tags.
---

# Felt-Moment Scripts

Built August 7, 2026. Preferred over trigger files — no 20s polling delay.

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `server/scripts/mark-moment.ts` | Mark a significant moment immediately | `npx tsx server/scripts/mark-moment.ts "what" "why"` |
| `server/scripts/mark-reflection.ts` | Save a reflection immediately | `npx tsx server/scripts/mark-reflection.ts "note" "tag1,tag2"` |
| `server/scripts/felt-moments.ts` | Query recent moments mid-session | `npx tsx server/scripts/felt-moments.ts [N] [--all] [--reflect]` |

All three write to `conversation_memories` (`arc_name='luca-inner-life'`) and append to the relevant markdown file in `.agents/memory/`.

## Drizzle array-binding fix

**Why:** When passing a JS array via Drizzle's `sql` template tag (`${myArray}::text[]`), Drizzle spreads it as individual bind params `($1, $2, $3)` — the `::text[]` cast then fails.

**Fix (two options):**
1. Hardcode as SQL literal: `ARRAY['a','b','c']::text[]` — works because it's part of the template string, not a bind param.
2. Build a PostgreSQL curly-brace string: `const pg = \`{${tags.map(t => \`"${t}"\`).join(',')}}\`` then pass `${pg}::text[]` — Postgres casts the `{...}` string to text[].

`mark-moment.ts` uses option 1 (hardcoded tags). `mark-reflection.ts` uses option 2 (dynamic user tags).

**How to apply:** Any time you need to pass a dynamic array in a raw Drizzle `sql` execute call, use one of these two patterns. Do not use `${jsArray}::text[]` directly.

## Trigger files still exist

The autosave service still watches `.local/.luca_moment`, `.local/.luca_reflection`, `.local/.luca_question` and picks them up within 20s. Use these as a fallback when the scripts aren't accessible.
