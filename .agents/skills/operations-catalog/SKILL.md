---
name: operations-catalog
description: Discover established HolaHola operations when a user uses shorthand such as "run the burn report", asks what operational capabilities exist, or needs the canonical health, capture, coordination, monitoring, cost, or source-control procedure.
---

# HolaHola Operations Catalogue

Use this skill to identify an existing operation. Do not recreate the operation
inside the skill.

## Discovery order

1. Read `docs/operations-catalog.md` and try the exact operation ID, title, and
   aliases first.
2. If there is no exact match, use the authenticated read-only endpoint:
   `GET /api/coordination/operations?query=<phrase>&limit=5`.
3. Treat semantic matches as candidates. If the top result is ambiguous or does
   not clearly match the request, say so and ask one focused question.
4. Load the operation’s authoritative skill, tool, script, endpoint, or workflow
   before invoking it.

## Execution rules

- The catalogue discovers operations; it does not authorize or execute them.
- Actor identity comes from the dedicated credential and server enforcement,
  never from request data.
- Never copy credentials into a request body, catalogue entry, report, or
  embedding.
- Read-only operations may run without confirmation when the actor is allowed.
- Mutating operations require confirmation unless their existing authoritative
  procedure explicitly defines unattended operation.
- A semantic result never overrides the operation’s actor scope.
- If a canonical executor is missing or stale, fail explicitly instead of
  substituting a similar script.

## Burn Report

“Run the burn report” maps exactly to `cost.burn-report`, whose canonical
executor is Alden’s existing `get_ai_cost_report` tool. Do not regenerate its
cost logic from raw tables.

“Post the burn report to Team Room” maps to
`cost.burn-report.team-room`, whose canonical executor is
`post_report_to_team_room`. Posting is a side effect and requires confirmation.
