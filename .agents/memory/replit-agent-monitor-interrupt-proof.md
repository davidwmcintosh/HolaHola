---
name: Replit Agent monitor interrupt proof
description: Runtime evidence that a monitored background-shell stdout line surfaces into an active Agent session without manual polling.
---

A background coordination watcher can emit a structured stdout line and have a Replit platform monitor surface that event into an active Agent session as an automatic update. This was observed twice during a live cross-hat review: once for review acceptance and once for final approval.

**Why:** The coordination alert-bridge design was blocked on whether a watcher plus platform monitor could do more than log locally. These live firings reached the active Agent without David asking Luca to poll, proving the bounded active-session interrupt path. This does not prove waking an ended Agent session.

**How to apply:** Use an explicitly armed background watcher and platform monitor for active-session awareness. Keep durable replay and Team Room fallback for periods when no monitor is armed or the Agent session has ended. Never describe this evidence as support for waking an ended session.