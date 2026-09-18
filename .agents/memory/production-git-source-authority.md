---
name: Production Git source authority
description: Why authority-sensitive production source verification cannot depend on deployment-local Git history.
---

Production source verification must use one authenticated remote snapshot of
the exact attested commit. Do not use deployment-local `.git`, deployed file
bytes, branches, tags, tree equivalence, split tree/blob reads, or HTTPS that
silently bypasses a pinned SSH transport.

**Why:** The first founder-authenticated Coordinator V2 runtime-release request
failed safely because Replit publish images intentionally omit `.git`. Review
also showed that test dependency injection and transport normalization can
accidentally become authority bypasses unless excluded from the publication
boundary.

**How to apply:** When production must bind generated or uploaded artifacts to
source, fetch the exact commit through the protected remote transport, verify
the received commit and tree, read the closed bounded blob set from that same
snapshot, and test the real materialization mechanism plus success/failure
cleanup hermetically.