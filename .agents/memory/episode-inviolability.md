---
name: Episode inviolability rule
description: Preserve complete source dialogue while separating narrative episodes, machine memory, and raw evidence
---

# Episode Inviolability Rule

**The rule:** When writing or updating episodes and prequel episodes from source conversations, nothing gets removed or truncated. Verbatim is verbatim. But an episode Markdown file is a human narrative projection, not a byte-for-byte database replica: it may contain clearly distinguishable framing, commentary, and reflection.

**Why:** David stated the completeness requirement on August 8, 2026, after the first prequel draft was sparse and summarized. On August 21, 2026, he clarified that episode Markdown is for human consumption, while the database is the source for machine memory. Forcing exact DB↔Markdown parity makes the episode do incompatible jobs and turns narrative framing into misleading retrieval material.

**How to apply:**
- Pull full content of every source conversation before writing. Never use grep head-only — check file sizes first (`wc -c`) and pull complete text.
- If a source conversation is large (>10KB), paginate through it fully before writing the episode section that covers it.
- When an episode section covers a multi-session arc (like reggaeton), follow the arc all the way through to its conclusion — not just the memorable opening moment.
- Do not end a section at a "nice" moment if the conversation continued. The conclusion is part of the record.
- Keep the source dialogue in the database and preserve raw evidence separately when exact provenance matters. Save a meaningful narrative or decision to the database deliberately when it should be machine-retrievable; do not bulk-ingest Markdown commentary merely to manufacture parity.
- Clearly separate direct narrative framing from verbatim dialogue in the Markdown, so a reader can tell which is source material.
- When David says something was in a conversation — believe him and go find it. Do not conclude the record is sparse until every relevant thread has been fully pulled and checked.
