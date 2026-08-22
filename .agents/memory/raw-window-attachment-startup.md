---
name: Raw-window attachment startup safety
description: Why one-shot raw-window evidence attachments bypass the asynchronous episode trigger.
---

Raw-window evidence attachments initiated by a CLI must write through the
direct DB-first episode append path rather than rely on the asynchronous
`.episode_append` trigger.

**Why:** The autosave worker treats a pre-existing trigger at its own startup
as stale and intentionally does not replay it. An attachment made while the
HTTP server is available but before that worker arms can therefore retain its
raw source but lose the requested episode evidence.

**How to apply:** Use the direct canonical append helper for production
attachments. Keep a trigger-path override only where a hermetic test needs to
inspect the serialized trigger payload.