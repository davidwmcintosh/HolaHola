# New Actor Onboarding — Coordination Ledger
_Last Updated: September 24, 2026_

This document describes the canonical onboarding process for any new "hat" (AI
runtime, agent, or persona) that needs to interact with the Coordination Ledger
or other shared HolaHola resources. This is how we ensure every new participant
has the necessary context, access, and configuration to function as part of the
Luca brain.

The onboarding process is tiered. Each hat must complete the tiers relevant to
its role.

## Tier 1 — always required, compiler-checked static analysis

This tier ensures the new hat has the necessary static configuration to be
recognized by the system and to prevent compile-time errors.

1.  **`shared/operations-catalog.ts`** — This file declares the specific
    operations (tools, functions) that a hat is authorized to perform.
    *   **Add an entry:** Create a new entry for the hat. This entry defines
        the hat's `id`, `displayName`, `model`, `provider`, and a list of
        `capabilities` (specific tool names or broader permissions like
        `coordination:read`).
    *   **Capabilities:** Ensure the `capabilities` list accurately reflects
        what the hat is intended to do. For example, a hat that only reads
        coordination threads would have `coordination:read`, while one that
        can post replies would also have `coordination:write`.

2.  **`server/services/coordination-actor-clients.ts`** — This file maps actor
    IDs to their client instances for interacting with the Coordination Ledger.
    *   **Add an entry:** Ensure the new hat's `id` from `operations-catalog.ts`
        is mapped to its corresponding client instance (e.g., `lucaClaudeCodeClient`).
        If a new client type is needed, it should be defined here.

3.  **`server/scripts/validate-actor-catalog-completeness.ts`** — This script
    verifies that every actor defined in the operations catalog has a
    corresponding client in `coordination-actor-clients.ts` and vice versa.
    *   **Run the script:** `npm run validate:actor-catalog` to ensure the
        new hat's entry is correctly reconciled across both files. CI fails if
        this script identifies any discrepancies.

### Why not just import `operations-catalog.ts` directly?

The `validate-actor-catalog-completeness.ts` script uses a static-source-parse
approach (regex-based) rather than directly importing `operations-catalog.ts`.
This is a deliberate architectural decision to ensure that the validation can
run even if there are TypeScript compilation errors or circular dependencies
elsewhere in the codebase. It also allows for validation of the raw source
text itself, which is crucial for certain security and consistency checks.

If a future change adds another registry that's supposed to hold every actor
using the same static-source-parse approach — see the comment at the top of
the script for why it doesn't just `import` `operations-catalog.ts` directly.

## Tier 3 — conditional on what this hat needs to do

Edit only the ones that apply; the rest are intentional exclusions, not gaps.
