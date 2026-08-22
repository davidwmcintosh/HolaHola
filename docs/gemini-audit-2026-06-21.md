# Gemini Audit — June 21, 2026

**Scope:** 7 features shipped across the June 20–21 build sessions. Reviewed by `gemini-3-flash-preview`.

**Overall verdict: APPROVED (With Caution)**

---

## Feature 1 — Last State Injection (resume trigger rewrite)

**Verdict: CONDITIONAL → FIXED**

Risk flagged: Context contamination. Providing 2000 chars of transcript as a prompt risks the model treating history as "happening now."

Gemini recommendation:
- Wrap recentContext in a temporal fence: `[HISTORICAL CONTEXT FOR CONTINUITY ONLY: ... END HISTORICAL CONTEXT]`
- Add a programmatic first-word constraint: "The very first word of your response must be a natural continuation of the Spanish flow, not a greeting."

**Fix applied:** Both implemented in `server/services/gemini-live-session.ts` — `sendGreetingTrigger()`.

---

## Feature 2 — Behavioral Output Constraints (buildOutputConstraints)

**Verdict: APPROVED**

Risk: Instruction dilution — in a 34K system prompt these rules are at risk of being ignored in high-token-count sessions (Attention Sink).

Gemini recommendation: Move the Specificity Rule to a "Global Hard Constraints" section at the very bottom of the system prompt (models have recency bias for end-of-system-block instructions).

**Status:** Noted. The specificity rule is currently embedded in tier text. Moving it to a global footer is a follow-up improvement — low priority given overall APPROVED verdict.

---

## Feature 3 — Bootstrap Turn (student profile in conversation history)

**Verdict: APPROVED → IMPROVED**

Risk: Role confusion. Injecting instructions into a `user` turn can cause the model to think the *student* is providing the instructions.

Gemini recommendation: Use `[SYSTEM NOTE: Student David is Novice High...]` framing to explicitly signal metadata, not student speech.

**Fix applied:** Bootstrap Turn framing changed from `[Student context loaded — treat this as felt knowledge...]` → `[SYSTEM NOTE: ...]` in `server/services/gemini-live-session.ts`.

---

## Feature 4 — System Whisper (specificity nudge every 8 turns)

**Verdict: NEEDS REVISION → FIXED**

Risk: **Read-Aloud Failure** — if GL's thinking phase is bypassed or the prompt is misinterpreted, Daniela will speak the reminder aloud. Catastrophic UX failure.

Gemini recommendation: Do not prepend to student speech. Instead inject the nudge into the next tool call response (a "safe channel" — seen by the model but never spoken).

**Fix applied** (`server/services/gemini-live-session.ts`):
- Removed whisper prepend from `sendTextTurn`
- Added `pendingSystemWhisper: boolean` field
- When `turnsSinceLastWhisper >= WHISPER_INTERVAL`, the flag is armed (not injected yet)
- At tool response assembly (just before `sendToolResponse`), if flag is armed, the whisper is appended to the last tool response's `result` string and the flag is cleared
- Tool responses are fed to the model as function results — never spoken aloud

---

## Feature 5 — find_teaching_tool meta-tool

**Verdict: CONDITIONAL → FIXED**

Risk: If `find_teaching_tool` returns a tool not in the current session's 64-tool manifest, Daniela will try to call a non-existent tool → runtime error.

Gemini recommendation: Filter semantic search results against the session's active tool registry.

**Fix applied:**
- `server/unified-ws-handler.ts`: After building `glDeclarations`, stores `(session as any).__activeGLToolNames = new Set(glDeclarations.map(d => d.name))` before `geminiLiveSession.start()`
- `server/services/native-fc-handlers.ts` `FIND_TEACHING_TOOL` handler: filters hits against `__activeGLToolNames`. Callable tools returned first; non-callable annotated with `[Not active this session]` prefix. Combined list trimmed to `ftLimit`.

---

## Feature 6 — Pedagogical Loop State Machine (4 tools + DB)

**Verdict: APPROVED**

Risk: State desync — if browser refreshes or socket drops, the GL model's "working memory" is lost but the DB says loop is at step 3.

Gemini recommendation: On session re-init, `get_current_teaching_context` must be the mandatory first call triggered by the backend (not the model). This ensures the model syncs with the DB before the first spoken word.

Madrigal note: Step 3 (Combinator) should allow free-form input — Madrigal's strength is "spontaneous construction."

**Status:** The State Envelope is already returned by every tool response, which helps. The mandatory-first-call recommendation is a future improvement. Tracked.

---

## Feature 7 — Shadow Auditor (post-session transcript analysis)

**Verdict: APPROVED**

Risk: Race condition — if a student closes and immediately re-opens a session on a different device, the Auditor may still be writing while the new session reads "Last State."

Gemini recommendation: Use a `processing_status` flag on `tutor_sessions`. Resume logic (Feature 1) should wait for the Auditor to finish or timeout (max 5s) before building the new system prompt to ensure Growth Memory is fresh.

**Status:** Noted. Fire-and-forget is intentional for low latency. The race window is narrow (Auditor typically finishes in 2–3s). A `processing_status` guard is a follow-up improvement if we see stale-memory complaints.

---

## Overall Gemini Findings

**Highest-leverage missing improvement: Dynamic Tool Swapping**

> "Since you have 139 tools but a 64-tool limit, you need a 'Pre-flight Router.' Before the GL session starts, use a fast model (Gemini Flash) to look at the student's growth_memory and active_loops to predict which ~40 tools are most likely needed, leaving 24 slots for 'Global/Utility' tools. This ensures the Meta-tool (Feature 5) actually finds tools that are callable."

**Final warning:**
> "Watch the 34K character system prompt. As the session progresses and the transcript grows, you will hit the context window's 'middle-loss' where the model forgets the behavioral constraints in the center of the prompt. Periodically 'summarize and truncate' the system prompt mid-session if possible."

---

## Follow-up items (not yet built)

1. Move Specificity Rule to a global footer section at bottom of system prompt (recency bias benefit)
2. `get_current_teaching_context` as mandatory backend-triggered first call on session re-init
3. `processing_status` flag on `tutor_sessions` to prevent Shadow Auditor race conditions
4. Dynamic Tool Swapping pre-flight router (highest leverage — enables find_teaching_tool to always return callable tools)
