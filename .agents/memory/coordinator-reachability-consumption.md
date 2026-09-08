---
name: Coordinator reachability and LLM consumption
description: Evidence rules for runtime addresses, cloud wake capabilities, and durable consumption by compacting LLM seats.
---

Runtime reachability is observed, expiring state. A URL that worked in an earlier
exchange is not a currently reachable seat, and a session-local scheduler is not
evidence that a runtime can wake while the user's laptop or original session is
offline.

**Why:** During independent review of the Unified Agent Coordinator design, Luca
[Claude Code] hash-verified the exact revision but could not claim it because the
previous Replit development URL had already become a 404. He also verified that
Claude's CronCreate is tied to the current session, fires only while idle, expires
within seven days, and therefore cannot satisfy laptop-off execution. RemoteTrigger
appears to create durable webhook- or schedule-fired cloud sessions, but its exact
relationship to Anthropic Managed Agents remains unverified.

**How to apply:** Treat every runtime address and wake adapter as capability state
with freshness, verification evidence, and expiry. Label current development
addresses honestly; do not promote them to durable endpoints. Prove each adapter's
lifecycle from its live tool or official product contract before assigning
`scheduled`, `push`, or `cloud_start` capability.

For an LLM runtime, `consumed` must be an explicit self-reported receipt tied to
the exact message and the action or reasoning that used it. Merely injecting a
message into a context window is not consumption evidence because later context
compaction can remove its effective influence.

**Why:** A message can be present at an early turn and effectively forgotten after
compaction even though a transport or context assembler would still report that it
was delivered.

**How to apply:** Keep `runtime_received`, `consumed`, `acknowledged`, and
`acted_on` separate. Require an exact-message receipt and record the linked action
or disposition; use replay or re-grounding when later work depends on information
whose continued presence cannot be proven.