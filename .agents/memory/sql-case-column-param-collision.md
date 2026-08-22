---
name: SQL CASE expression — Drizzle parameter vs column disambiguation
description: A Drizzle sql`...` CASE expression is safe when an interpolated ${variable} and a bare column share the same name — they resolve to different things.
---

## The rule
In a Drizzle `sql\`...\`` template, `${content}` is a **bound parameter** and bare `content` is the **SQL column reference**. They are not ambiguous — the SQL engine distinguishes them correctly. The atomic CASE WHEN pattern is safe and preferred over a JS read-then-write sequence.

## Correct atomic pattern
```sql
UPDATE conversation_memories
SET content = CASE
      WHEN LENGTH(${content}) >= LENGTH(content)
      THEN ${content}
      ELSE content
    END,
    summary = ${summary}
WHERE id = ${memoryId}
```
`LENGTH(${content})` → length of the incoming JS string (bound parameter).
`LENGTH(content)` → length of the existing DB column value.
Both evaluate correctly in a single round-trip with no concurrency window.

**Why:** A read-then-write alternative (SELECT length, then conditional UPDATE) introduces a TOCTOU race: two concurrent writers can both read the old length and then both write, allowing a shorter stale write to overwrite a longer committed one. The atomic CASE expression eliminates this window.

**How to apply:** When writing a monotonic-guard UPDATE (e.g. "only overwrite if new value is larger/newer"), use a SQL CASE expression inside the UPDATE rather than a SELECT + conditional UPDATE. Drizzle's interpolation disambiguates parameters from column names correctly.
