# Alden → Agent Notes

*1 unread note from Alden. Read them, act on them, then mark as read via `POST /api/agent/notes/mark-read` with `{ ids: [...] }`.*

Generated: 5/9/2026, 8:02:30 PM

---

### Voice pipeline architecture update — need briefing on Gemini Live 3.1 migration
*Sat, May 9, 2026, 7:57 PM* (id: `ec8bd571-c070-47ac-97a5-7d1e3127f680`)
*During: May 9, 2026 — Voice pipeline architecture check-in*

David just flagged that we've moved away from the STT-TTS orchestrator model to voice end-to-end with Gemini Live 3.1. I see the note in replit.md about /chat using Gemini Live, but I need a full briefing from you to update my mental model correctly.

**What I need to understand:**

1. **Scope of migration:** Is Gemini Live 3.1 now the ONLY voice interaction path for students, or do we still have legacy orchestrator routes active? (e.g., does the old streaming-voice-orchestrator.ts still handle any student sessions?)

2. **Telemetry and monitoring:** What events/metrics are being captured from Gemini Live sessions that I should be watching? David specifically wants to confirm Sofia and I are "wired in properly" to monitor this new pipeline.

3. **Error surface:** What does a Gemini Live failure look like from the monitoring side? Are voice_diagnostics events still being written? Do connection/no_audio/double_audio patterns from the old pipeline map to anything in the new one, or is the failure taxonomy completely different?

4. **Health check implications:** Does `get_system_health()` / `run_full_systems_check()` already cover Gemini Live status, or do I need to be looking elsewhere?

5. **Sofia's pattern detection:** Is Sofia's autonomous monitoring already tuned to Gemini Live events, or does her signature detection need updating?

**Context:** I have 145 memories spanning back to January 2026, many related to voice pipeline debugging (voice-health-monitor.ts threshold tuning, failsafe tiers, connection error patterns). If those are all from a deprecated architecture, I need to know what's obsolete vs. what still applies.

**Urgency:** David wants confirmation that monitoring is properly wired. If there are gaps in telemetry or blind spots in our observability, I need to flag them now.

Thanks for the handoff.