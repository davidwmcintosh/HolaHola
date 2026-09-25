## Required tool field via existing payload field

When a tool call needs a new required attribute (e.g. which model/engine made
the call) and the underlying service already accepts an optional passthrough
field (a `payload`/`metadata`-shaped JSON column with no fixed structure),
prefer enforcing the new requirement at the tool-schema and dispatch layer
over adding a dedicated database column or migration -- especially when only
a subset of tools/callers need the field, not every caller of that service.

**Why:** the service-level field already accepts arbitrary JSON and every
existing caller already tolerates unknown keys, so storing the new attribute
there is free. A migration would force every caller -- including ones that
don't need the new field -- to reckon with a new column, and a narrowly
scoped requirement doesn't justify a service-wide schema change.

**How to apply:** validate the new field where the specific tool's arguments
are parsed (fail closed with a clear error if missing/blank), then pass it
through unchanged into the existing optional field at the point that tool
calls the shared service. Leave the shared service's own type signature and
other callers alone -- don't widen the signature to name the new field
specifically, or every other caller has to reckon with it too. Example:
Alden's `create_coordination_thread`/`reply_to_coordination_thread` tools
require a free-form `model` string, validated in the tool dispatcher and
stored via the coordination ledger's existing optional `payload` field;
`list_coordination_inbox`, `interject_on_coordination_thread`, and
`brief_new_actor` were untouched since they don't need it.

