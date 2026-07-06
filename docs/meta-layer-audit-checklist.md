# Meta-Layer Composition Audit Checklist

## What the Meta-Layer Is

The meta-layer is the set of systems that observe and advise on Daniela's teaching sessions — without being part of the conversation itself. They are distinct from the teaching layer (what Daniela says and does) in that they run in the background, fire on schedule or on session events, and shape what Daniela carries forward.

Current meta-layer systems:

| System | File | When it fires | What it does |
|---|---|---|---|
| Friction signal | `server/services/gemini-live-session.ts` (~line 2341) | Every tool response whisper | Reports pause length + word density as HIGH/MEDIUM/LOW; tells Daniela to simplify or push |
| Session clock whisper | same block | Same whisper injection | At 25+ min, tells Daniela to wind down and name language wins |
| Shadow auditor | `server/services/shadow-auditor.ts` | `stop()` | Generates session summary + topicsObserved for next-session compass context |
| Session reflection | `server/services/session-reflection-worker.ts` | Session end + next session start | Daniela writes private first-person reflection in the target language |
| Context health monitor | `server/services/context-health-monitor.ts` | Periodic interval | Monitors context health; nature TBD — audit pending |

---

## The Composition Rule

**Every time a new exception state is added to the teaching layer, the meta-layer must be audited.**

Exception states are any session-level flags that change how Daniela behaves: placement assessment, Founder Mode, Honesty Mode, incognito, subject sessions, etc. The meta-layer was built without awareness of these states. Left unaudited, each new state risks sending incorrect signals to Daniela (wrong friction instruction, wrong wind-down, wrong reflection frame, wrong session summary).

### What "audit" means

For each meta-layer system, ask:
1. Does this system's default behavior make sense during this exception state?
2. If not: what should it do differently?
3. Fix it — either by passing the flag directly at the call site (preferred) or via self-detection from the transcript (acceptable when the flag isn't available at call time).

---

## Exception State Registry

### Placement Assessment (`placementMode.active`)

Detection: `start_placement_assessment` in transcript (handles mid-session disconnect; `set_actfl_level` may never fire)

| System | Gap? | Fix applied |
|---|---|---|
| Friction signal | Yes — probing generates HIGH friction by design; "simplify" contradicts probing | Suppressed entirely |
| Clock whisper | Yes — premature wind-down interrupts assessment | Replaced with "assessment in progress — do not close" |
| Shadow auditor | Yes — probe-level struggles read as real failures | Prompt rule: report peak performance, omit probe-induced struggles |
| Session reflection | Yes — reflects on struggle rather than bravery | Prompt rule: reflect on bravery and highest level demonstrated |
| Context health monitor | Not yet audited | — |

### Founder Mode (`session.isFounderMode`)

Detection: Flag known at session init — passed directly at call sites.

| System | Gap? | Fix applied |
|---|---|---|
| Friction signal | Yes — long pauses = deep thinking, not language struggle; "simplify" is patronizing | Suppressed entirely |
| Clock whisper | Yes — 25 min wind-down too early; "language wins" irrelevant | Extended to 45 min; prompt changed to "summarize product decisions and next steps" |
| Shadow auditor | Yes — language topicsObserved meaningless; session was strategy not teaching | Prompt rule: summary = strategic topics and decisions; topicsObserved = business/product areas |
| Session reflection | Yes — "tutor" frame wrong; Daniela was a collaborator | Self-detection rule: English-first + product topics → reflect as team member, not teacher |
| Context health monitor | Not yet audited | — |

### Honesty Mode (`session.isRawHonestyMode`)

Detection: Flag known at session init — passed directly at call sites.

| System | Gap? | Fix applied |
|---|---|---|
| Friction signal | Yes — high friction IS the goal; "encourage and simplify" breaks the mode | Overridden: HIGH friction → "Stay silent — student is working. Do not scaffold or prompt." |
| Clock whisper | Yes — "tutoring recap" at close breaks the raw-conversation frame | Replaced with "End naturally, as a friend would. No tutoring recap." |
| Shadow auditor | Yes — pauses and low prompting read as problems | Prompt rule: note this was Honesty Mode; don't flag silence as a concern |
| Session reflection | Yes — "failed to help" read is wrong; staying out was the help | Self-detection rule: student-led + long silences → reflect on stamina and comfort with silence |
| Context health monitor | Not yet audited | — |

---

## How to Add a New Exception State

1. Add the exception state to this table under "Exception State Registry."
2. For each meta-layer system, ask: "Does the default behavior make sense in this state?"
3. If not, implement a fix (direct flag passing preferred; self-detection in prompt acceptable).
4. Mark the fix as applied.
5. Update `docs/batch-doc-updates.md` with what changed.

The pre-flight Gemini consult for any PR that introduces a new session mode flag should explicitly ask: "Does this touch an exception state? If yes, run the meta-layer audit."

---

## Alden Watch Rule

Alden's watch worker should flag when a new session mode flag appears in the codebase without a corresponding entry in this checklist.

Trigger pattern: new `session.isXxx` or `session.xxxMode` property in `server/unified-ws-handler.ts` or `server/services/gemini-live-session.ts` that does not appear in this document.

Alden does not need to implement fixes — just flag the gap in `.local/alden-escalations.md` with: "New exception state `[flag name]` detected — meta-layer audit required before shipping."

---

## Audit History

| Date | Exception State | Audited by | Gaps found | Gaps fixed |
|---|---|---|---|---|
| 2026-07-06 | Placement assessment | Luca + Gemini | 4 | 4 |
| 2026-07-06 | Founder Mode | Luca + Gemini | 4 | 4 |
| 2026-07-06 | Honesty Mode | Luca + Gemini | 4 | 4 |
