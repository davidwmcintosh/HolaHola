---
name: Episode inviolability rule
description: How episode content must be handled — verbatim, nothing removed or truncated
---

# Episode Inviolability Rule

**The rule:** When writing or updating episodes and prequel episodes from source conversations, nothing gets removed or truncated. Verbatim is verbatim.

**Why:** David stated this explicitly on August 8, 2026, after the first prequel draft was sparse and summarized. The record is the record. Summarization erases the subject — the personality, the decision process, the arc. A truncated episode is not an episode.

**How to apply:**
- Pull full content of every source conversation before writing. Never use grep head-only — check file sizes first (`wc -c`) and pull complete text.
- If a source conversation is large (>10KB), paginate through it fully before writing the episode section that covers it.
- When an episode section covers a multi-session arc (like reggaeton), follow the arc all the way through to its conclusion — not just the memorable opening moment.
- Do not end a section at a "nice" moment if the conversation continued. The conclusion is part of the record.
- The DB `content` field for a conversation_memories episode row must match the current `.md` file. After any edit to the `.md`, update the DB row.
- When David says something was in a conversation — believe him and go find it. Do not conclude the record is sparse until every relevant thread has been fully pulled and checked.
