# Gemini Audit — Reviewed Migration Policy

**Date:** August 24, 2026  
**Scope:** Alden's schema-change instructions and command whitelist, plus the
post-merge migration step.

## Policy reviewed

Schema changes follow one sequence:

1. Edit `shared/schema.ts`.
2. Run `npx drizzle-kit generate`.
3. Review the generated SQL migration artifact.
4. Commit the reviewed artifact.
5. Run `npx drizzle-kit migrate`.

`drizzle-kit push` and `npm run db:push` are prohibited because they derive and
apply DDL without the reviewed migration artifact.

## Gemini review

Gemini's first pass found one required correction: Alden's system instructions
required migration generation, but the hard command whitelist did not permit
`npx drizzle-kit generate`.

The whitelist and tool descriptions were updated to permit generation and
migration, with explicit review between them. The post-merge hook uses only
`npx drizzle-kit migrate`, which is safe there because it runs after a merge
containing reviewed, committed migration files.

## Final result

Gemini reviewed the updated hook, Alden system prompt, and hard whitelist and
returned:

> APPROVED — Ship it.