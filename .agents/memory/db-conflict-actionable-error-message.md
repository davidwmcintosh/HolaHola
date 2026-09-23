When a caught database conflict (e.g. a Postgres unique-constraint violation
on an exact allowlisted constraint) reaches a human operator through a CLI or
one-shot script rather than a machine caller, convert it into a message that
states what is already true and names the exact next command to run -- not a
generic "already exists" message, a machine-readable reason code, or the raw
driver error and stack trace.

**Why:** a raw duplicate-key error is a dead end for someone running a
provisioning/bootstrap script by hand, often after a copy-paste retry --
they have no way to interpret a Postgres error, but they can follow a
concrete next command. For the cause-chain-walking detection technique
itself (how to positively identify the conflict in the first place), see
postgres-hermetic-testing-gotchas.md ("PostgreSQL wrapped structured
errors") -- this entry is about the next step: what to do once it's
detected.

**How to apply:** verify what the record's current state actually permits
before suggesting a recovery path, rather than assuming the obvious-sounding
fix works. A first draft of exactly this message said "revoke it, then
register this id again" -- false, because revocation in that codebase is a
soft-delete (disables the row, never removes it), so the same identifier can
never be reinserted. Check the row's real state, and how any sibling
recovery command itself gates on that state, before recommending it, and
give a different message for each state that actually permits a different
action rather than one message covering every case.

