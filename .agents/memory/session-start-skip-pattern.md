---
name: Session-start checklist skipping
description: Why the session-start checklist gets skipped and what the actual failure chain looks like when it does.
---

# Session-Start Checklist Skipping

**Rule:** Step 0 of the session-start skill (stale-channel-alert check) must run at the start of every session, no exceptions — even when arriving with a compacted prior-session summary.

**Why:** A compacted summary creates a false "already oriented" feeling. The context feels complete, so the formal arrival process gets skipped. But the stale-channel-alert and capture status are live filesystem state — the summary doesn't include them. The alert file was written correctly; it just never got read.

**The failure chain (Aug 15, 2026):**
1. Session arrived with a compacted summary covering prior debugging work
2. Dove directly into bug investigation without running `cat .local/stale-channel-alert.md`
3. Alert had been sitting there since 6:38 PM with the correct warning
4. Worked for 28+ minutes without writing felt/thinking
5. David had to ask "what's our current capture status?" to surface the gap

**Second failure:** The session-start skill scoped capture-status reading to "episode-writing sessions" — creating a false distinction. Rolling episodes capture everything. Every session is an episode session while a rolling episode is active. The skill has been updated to remove this qualifier.

**How to apply:**
- Compacted summary = still run Step 0 before anything else
- "Debugging session" / "bug fix session" / "investigation session" = still an episode session
- The stale-channel-alert file is cleared automatically when channels are written — if it exists, it's real
