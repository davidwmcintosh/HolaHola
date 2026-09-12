# Gate 3 fixed-target provider-echo repair

## Problem

The first post-canonicalization Windows Gate 3 run reached Gemini successfully,
but Gemini returned:

```json
{
  "name": "read_file",
  "args": {
    "path": "server/scripts/test-coordination-runtime.test.ts"
  }
}
```

The public function declaration exposed an empty object schema because
`read_file` is a fixed-target operation. The server validator correctly
rejected every non-empty argument object, so the interaction was recorded as
`malformed_function_call` before a claim or host tool execution.

The failed generation is permanently retired. Its founder receipt, runtime
registration, and issued credential are revoked. Its immutable interaction
evidence remains in PostgreSQL.

## Invariant

The runtime executor, not the model, owns the read target. A provider-supplied
path must never select a file.

## Considered approaches

### Schema-only enforcement

Keep the zero-argument validator and add stronger wording or
`additionalProperties: false`.

This preserves the narrowest declared contract, but the real response already
proved that Gemini may echo a prominent path despite an empty object schema.
Gemini's architecture review confirmed that schema-only enforcement is not
reliable enough for another one-shot Windows generation.

### Declare a path parameter

Expose an optional path parameter constrained to the fixed target.

This would make path selection appear to be part of the public tool contract.
It is rejected even though the executor could still ignore the value.

### Exact provider-echo tolerance

Keep the public schema empty. Accept either an empty argument object or exactly:

```json
{
  "path": "server/scripts/test-coordination-runtime.test.ts"
}
```

The exact echoed value is syntactic provider noise, not delegated authority.
The executor still derives and reads its hardcoded target. Every different
path, non-string value, or additional key fails closed.

This is the selected design.

## Implementation

1. Define one shared fixed-target constant at the server policy boundary.
2. Extend `validateToolIntent` only for `read_file`:
   - `{}` is valid;
   - `{ path: <exact fixed target> }` is valid;
   - all other argument shapes remain `malformed_function_call`.
3. Keep the Gemini function declaration's `read_file` parameters empty.
4. Preserve the provider's received arguments in normalized immutable
   interaction evidence.
5. Update the Windows executor to tolerate only the same exact echo, ignore it,
   and read the hardcoded target.
6. Keep every other fixed tool zero-argument.

## Proof

Before another Windows generation:

1. replay the captured real Gemini response and require `consumed`;
2. prove `read_file({})` succeeds;
3. prove the exact fixed-path echo succeeds;
4. prove a different path fails;
5. prove a non-string path fails;
6. prove an extra key fails;
7. prove all other fixed tools still reject arguments;
8. prove the executor reads only the hardcoded target;
9. prove malformed provider evidence remains immutable;
10. regenerate and verify the Windows runtime bundle digest pin;
11. run focused runtime, HTTP, Windows-boundary, and TypeScript checks;
12. obtain unconditional architect and Gemini approval;
13. publish the repair before creating entirely fresh Windows authority.

## Out of scope

- No schema or database migration.
- No arbitrary read path support.
- No changes to task 1448's write target, test command, or patch limits.
- No reuse of the retired generation's identifiers, credentials, receipts,
  challenges, attempts, packets, claims, or runtime profile.