---
name: SQL CASE expression — column/parameter name collision
description: A SQL CASE expression inside a Drizzle UPDATE failed silently when the column name matched the parameter variable name.
---

## The rule
When writing a Drizzle `sql\`...\`` UPDATE with a CASE expression, never use a bare column name that is identical to the JS variable holding the parameter. The SQL parser resolves the ambiguity by treating both as the parameter (or the column), causing the CASE condition to always evaluate incorrectly.

## What broke
```sql
UPDATE conversation_memories
SET content = CASE
      WHEN LENGTH(${content}) >= LENGTH(content)
      THEN ${content}
      ELSE content
    END
```
`LENGTH(content)` was supposed to be the DB column length, but Drizzle resolved it to the parameter — making the comparison always `true` or `false` regardless of DB state. Result: "longer wins" pass always failed silently.

**Why:** The rolling-guard uses a monotonic max-length rule: shorter syncs must not shrink a rolling episode. The CASE expression was the guard. When it misfired, Pass 3 (longer content should overwrite) stopped working.

## Fix
Move the comparison to JS — fetch current DB length first, compare, then issue a plain UPDATE only if new content is longer:
```typescript
const lenRow = await db.execute(sql`SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${memoryId}`);
const currentLen = Number((lenRow as any).rows?.[0]?.len ?? ...);
if (content.length >= currentLen) {
  await db.execute(sql`UPDATE ... SET content = ${content} ...`);
}
```

**How to apply:** Any time a Drizzle SQL CASE expression references both a `${variable}` and a bare column name that are spelled the same, lift the comparison to JS instead.
