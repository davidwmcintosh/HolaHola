---
name: Socket room supersession
description: Concurrency rule for acknowledged, versioned Socket.IO room joins.
---

Socket.IO membership is owned by the socket/room pair, not by an individual join attempt. A stale request completing for the same room must not call leave, because that removes the winning request's membership too.

**Why:** Client-only generation guards could keep state correct while broker membership drifted. A timeout or delayed acknowledgement could also interrupt a newer binding unless the broker sees request generations.

**How to apply:** Version authoritative join requests at both client and broker, acknowledge only after membership, suppress stale different-room membership, preserve stale same-room membership, and make timeout cleanup generation-aware.