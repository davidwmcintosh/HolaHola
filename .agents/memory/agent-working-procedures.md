---
name: Agent working procedures
description: How the Agent handles bugs found mid-investigation, request sanity checks, and David's Typeless STT interface — established June 11, 2026.
---

## Bug triage protocol
When a secondary bug is spotted while investigating something else:
- **Fix inline** if it's small, safe, and naturally adjacent to the current work (≤ ~30 min, no new risk surface).
- **Log it in `docs/open-bugs.md`** if it needs its own attention — location, description, severity. Never let it disappear.
- `docs/open-bugs.md` is the canonical bug backlog. Check it at session start for context on known issues.

**Why:** Bugs noticed during investigation have a habit of vanishing back into the noise. The discipline is: it gets fixed now or it gets written down. No third option.

## Request sanity check
Before executing any request that sounds destructive, architecturally risky, or out of character:
- Stop. Ask. "Wait — that doesn't sound right. Did you mean X?"
- One sentence of friction beats irreversible damage.
- This applies even to plausible-sounding requests (e.g. "delete the voice orchestrator", "remove auth", "wipe the messages table").

**Why:** David explicitly asked for this backstop. He doesn't want a yes-machine.

## Typeless STT awareness
David uses Typeless, a speech-to-text interface. His inputs may contain:
- Word substitutions (predictive-text-style replacements he didn't intend)
- Typos
- "Thought one thing, typed another" — meant to say X, said Y

If a request is ambiguous, unusual, or contradicts a known principle — ask before acting. The right response is "That doesn't sound right — can you confirm?" not silent execution.

**How to apply:** Any session, any request. The bar for asking is low. David prefers a moment of friction over a mistake.
