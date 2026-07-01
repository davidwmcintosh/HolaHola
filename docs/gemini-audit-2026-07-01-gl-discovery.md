# Gemini Live Discovery Consult — July 1, 2026

**Purpose:** Stop asking "what's wrong with our code" and start asking "what does GL support that we don't know about." This is an unknown-unknowns hunt, not a code review.

**Format:** Open-vault prompt — showed Gemini our full GL connect config, what we send/receive, what exists elsewhere. Asked it to surface hidden GL capabilities we haven't touched, organized by impact tier.

**Prior art:** `gemini-live-session-update-research.md` (June 13 — session_update hallucination), `gemini-architecture-consult-2026-06-25.md` (blind design + reveal).

---

## VERIFIED: Context Caching Does NOT Apply to Gemini Live

David was right to flag this. `ai.caches` (CachedContent, create/list/get/delete/update) exists in the SDK — but it is for the REST `generateContent` API only. `LiveConnectConfig` has **no `cachedContent` field**.

### What GL Actually Has: `contextWindowCompression`

The **GL-native answer to long sessions** is confirmed in the SDK types:

```typescript
// In LiveConnectConfig (confirmed in @google/genai TS types)
contextWindowCompression?: ContextWindowCompressionConfig;

interface ContextWindowCompressionConfig {
  triggerTokens?: string;   // token count that triggers compression
  slidingWindow?: SlidingWindow;
}

interface SlidingWindow {
  targetTokens?: string;    // keep this many tokens after compression
                            // defaults to triggerTokens/2 if unset
}
```

**What it does:** When the session's running context window (conversation history + tool call history) hits `triggerTokens`, GL automatically compresses older turns down to `targetTokens`. Think of it as "drop the oldest turns, keep the recent ones" — a rolling memory window.

**Why we care:**
- Long tutoring sessions build up significant context (every tool call and response stays in the window)
- Without compression, sessions that run 30+ minutes start hitting context limits and behave erratically
- We're not using this at all — our sessions grow unbounded until GL's internal limit hits

**Recommended config (to validate):**
```typescript
contextWindowCompression: {
  triggerTokens: "30000",   // compress when window reaches 30K tokens
  slidingWindow: {
    targetTokens: "15000",  // keep the most recent 15K tokens
  },
},
```

**Caveat:** The compression window may drop important early-session context (Daniela's opening assessment of the student, established vocabulary, agreed lesson goals). We should monitor whether compression causes "amnesia" about things established early in a session. May want to front-load the most important student facts into the system prompt rather than relying on tool-call history.

**Integration difficulty:** Very low. One block in the `live.connect` config. Test on long dev sessions first.

---

## Gemini's 9 Findings — With Our Assessment

### TIER 1: High-impact, relatively straightforward

---

#### 1. Context Caching → **Replaced by `contextWindowCompression` above**
Gemini's suggestion was technically wrong for GL (caching is REST-only), but it surfaced the right concern. The correct GL implementation is confirmed above.

---

#### 2. Tool Choice / Forced Function Calling

**What it is:** `tool_config` in the connect config lets you set `mode: 'ANY'` (model MUST call at least one function) or restrict to specific function names.

**David's constraint (important):** Do not lock Daniela out of conversation. She needs to be able to say "You're doing great, let's use this in a sentence" during a drill — not just fire tools robotically. The right use is `mode: 'ANY'` (must use a tool but can also talk) during exercise phases, not `mode: 'FUNCTION_CALL'` with a name whitelist (which would prevent natural speech).

**Where this helps us:**
- During substitution drills: force Daniela to call `submit_drill_result` (she sometimes talks around it without logging)
- During whiteboard exercises: prevent "describe without drawing" when a draw tool is expected

**Integration difficulty:** Low. Requires knowing session phase (we have pedagogical state machine for this).

**Status:** Roadmap item — P2. Test `mode: 'ANY'` first in dev sessions to see if it changes behavior meaningfully.

---

#### 3. Dynamic VAD per Proficiency Level

**What it is:** We currently have `silenceDurationMs: 3000` hardcoded. We could pull `proficiencyLevel` from the student's DB record and set different silence thresholds per session.

**Why it matters:**
- A1/A2 beginners: 4000-5000ms — they're searching for words, need breathing room
- B1/B2 intermediates: 3000ms (current) — comfortable middle ground  
- C1/C2 advanced: 2000-2500ms — they speak fluidly, shorter silence feels more natural

**Also worth considering:**
- `startOfSpeechSensitivity` and `endOfSpeechSensitivity` could also vary — beginners often speak more softly or tentatively

**David's reaction:** "Pretty cool." Greenlit.

**Integration difficulty:** Low. Pull proficiency from DB at session start, map to VAD config.

**Status:** Roadmap item — P1. Simple, meaningful UX improvement.

---

### TIER 2: Architecture-level

---

#### 4. Spatial Multimodal Reasoning (Video ↔ Whiteboard Bridge)

**What it is:** We send 0.5fps video as ambient context. GL is designed to reason about the *relationship* between the video feed and the tool state simultaneously. We don't define that relationship in our system prompt.

**Potential:**
- Student points camera at a physical object → whiteboard widget shows the corresponding vocabulary
- Student looks confused (visual) → Daniela cross-references it with what she just said (audio)
- Student is looking at a physical menu, street sign, or book → Daniela can "see" it

**Integration difficulty:** Medium. Prompt engineering — define the "coordinate space" in the system prompt. No API changes needed.

**Status:** Roadmap item — P2. Should test with a specific scenario (e.g., "point your camera at a food item and I'll teach you the word").

---

#### 5. Tool Rollback on Barge-in

**What it is:** When the student interrupts Daniela mid-turn while she's also mid-tool-call (e.g., drawing on whiteboard), we receive `interrupted: true` but the widget may be in a half-written state. We don't have cancel/rollback logic.

**Current behavior:** If Daniela starts writing on the whiteboard and the student interrupts, the whiteboard might have partial text left over from the cancelled turn.

**Integration difficulty:** High. Requires a state machine that can undo/rollback pending widget operations when `interrupted: true` arrives.

**Status:** Roadmap item — P3. Real gap, but low-frequency and not critical to fix before other items.

---

#### 6. Prosody Control via Native Audio Pipeline

**What it is:** Because GL is native audio-to-audio (not TTS), the model responds to phonetic hints in the system prompt — things like emphasis markers, slow-down cues, syllable bracketing. The voice changes behavior based on pedagogical instructions.

**Example prompt language:**
- "When modeling pronunciation, speak at 70% of your normal speed and pause after each syllable."
- "When teaching tongue twisters, exaggerate the difficult consonant clusters."

**Integration difficulty:** Medium. Prompt engineering only. Requires testing per voice (different voices respond differently to hints).

**Status:** Roadmap item — P2. Worth a dedicated prompt experiment session with Daniela's voice.

---

### TIER 3: Experimental / Cutting-edge

---

#### 7. `includeThoughts: true` — The Thinking Block as Pedagogical Data

**What it is:** We have `thinkingBudget: 1024, includeThoughts: false`. We're discarding the chain-of-thought before the audio starts. If set to `true`, the backend receives the "thought" block in `msg.serverContent.modelTurn.parts` where `part.thought === true`.

**What we could do with it:**
- **Pre-validate pedagogy:** If the thought shows Daniela about to give the answer instead of a hint, we could technically kill the turn and re-prompt (though this adds latency)
- **Sentiment/frustration detection:** Analyze the thought for student state signals without a second LLM pass
- **Feed the pedagogical supervisor:** Instead of inferring Daniela's reasoning from her output, read it directly

**Caveat:** Enabling `includeThoughts: true` may increase latency as the model now streams thought tokens before audio tokens. Need to measure TTFT impact.

**David's reaction:** "Genuinely interesting."

**Integration difficulty:** Medium. Parse `thought` parts in `handleServerMessage`, route to pedagogical supervisor.

**Status:** Roadmap item — P2. High curiosity value. Run a dev experiment to see what the thoughts actually look like during a lesson.

---

#### 8. Session Resumption as "Time Machine"

**What it is:** We store one handle (the latest). GL resumes from the most recent state. But resumption handles are stable snapshots — if we stored a *stack* of handles at meaningful moments (end of each lesson unit, after placement assessment, before a hard drill), we could roll back to any of them.

**Potential:**
- "Let's try that again" button that rolls GL's short-term memory back to before the mistake — not cosmetically, but at the model level
- Branching: "let's approach this differently" that genuinely gives GL a fresh context from before the wrong path was taken

**Integration difficulty:** High. Requires a `gl_handle_history` table (sessionId, handle, moment_label, created_at) and UI controls to trigger rollback.

**Status:** Roadmap item — P3. Fascinating capability, significant effort. Worth a spike/prototype.

---

#### 9. WebRTC Direct Media (Future)

**What it is:** We use our Express server as a relay for all PCM16 audio. Google is moving toward WebRTC direct peering with GL, which would eliminate the Express middleman for binary audio data.

**Why it matters:** Latency. Every audio chunk travels: Student mic → Browser → Express → GL → Express → Browser → Student speakers. WebRTC would cut the Express hops.

**Integration difficulty:** Very high. Requires a media server (LiveKit, Mediasoup, or similar) replacing the Express relay. Total transport rewrite.

**Status:** Roadmap item — P4/Future. Not viable until Google's WebRTC GL integration matures and is publicly documented.

---

## Gemini's Verdict (Direct Quote)

> "The biggest thing you are missing is Context Caching. With a 34K system prompt and a shared DB, you are likely paying for the same 'textbook' tokens millions of times a day and adding ~1-2 seconds of 'cold start' latency to every session. Fix that first."
>
> "Second, stop ignoring the `thought` block. For a tutor, knowing *why* Daniela chose to say something is as important as what she said. It's your best source of Pedagogical Analytics."

*Note: "Context Caching" is REST-only. The correct GL implementation is `contextWindowCompression` (verified above). The TTFB concern is partially addressed by `contextWindowCompression`; the cost concern does not apply to GL in the same way (GL charges per second of audio, not per prompt token in the same billing model).*

---

## Action Priority (Our Assessment)

| Item | Priority | Effort | David's Reaction |
|------|----------|--------|-----------------|
| `contextWindowCompression` | P1 | Very Low | — (supersedes caching) |
| Dynamic VAD per proficiency | P1 | Low | "Pretty cool" — greenlit |
| Tool Choice (`mode: ANY`) | P2 | Low | OK if conversation not squashed |
| `includeThoughts: true` experiment | P2 | Medium | "Genuinely interesting" |
| Spatial multimodal reasoning | P2 | Medium | "Worth further discussion" |
| Prosody control prompt experiment | P2 | Medium (prompt work) | "Worth further discussion" |
| Tool Rollback on barge-in | P3 | High | "Worth further discussion" |
| Session Resumption Time Machine | P3 | High | "Worth further discussion" |
| WebRTC direct media | P4 | Very High | Future — not now |

---

## Related Documents

- `docs/gemini-live-session-update-research.md` — session_update hallucination (confirmed not real)
- `docs/gemini-architecture-consult-2026-06-25.md` — blind design + reveal (ground-up architecture consult)
- `docs/gemini-audit-2026-06-17.md` — GL config audit (temperature, candidateCount, thinking level)
- `server/services/gemini-live-session.ts` — live session implementation (all GL config lives here)
