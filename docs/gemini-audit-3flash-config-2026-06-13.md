=== Gemini 3-flash Audit: Session Config + Tool Responses + System Prompt ===
Date: 2026-06-13T02:26:12.727Z

This is a sophisticated implementation. You are hitting several known "sharp edges" of the `gemini-3.1-flash-live-preview` model.

Here is the direct feedback on your three areas, plus a "Critical Risks" section for things you didn't ask about but that will likely break in production.

---

### Area 1: VAD and Session Settings

**1. VAD Configuration:**
`END_SENSITIVITY_HIGH` + `1500ms` is a contradictory pairing for language learners. 
*   **The Problem:** `HIGH` sensitivity means the model is aggressive about interpreting a drop in pitch or volume as a "potential end." For a learner saying *"Quiero... [pause]... una... [pause]... manzana,"* `HIGH` sensitivity will likely trigger the 1500ms timer the moment they pause to think, even if their tone implies they aren't done.
*   **The Fix:** Use `END_SENSITIVITY_LOW`. This forces the model to wait for a more definitive "final" cadence before it starts the 1500ms countdown. For non-fluent speakers, you want the VAD to be "lazy," not "eager."

**2. Thinking Level:**
*   **The Behavior:** `MEDIUM` does run on every turn. In the Live API, "Thinking" is not selective; it's a pre-computation phase. 
*   **The Tradeoff:** On `3.1-flash`, `MEDIUM` is the correct choice. `HIGH` often causes the model to "buffer" the entire response, leading to a 3-5 second silence followed by a burst of audio, which ruins the "Live" feel. `MEDIUM` allows for more streaming-friendly behavior.

**3. Missing Fields:**
*   **`generationConfig`:** You aren't setting `temperature` or `presence_penalty`. For a language tutor, a slightly higher `presence_penalty` (0.2–0.4) prevents Daniela from repeating the same "¡Muy bien!" or "¡Excelente!" filler phrases every turn.

---

### Area 2: Tool Response Pattern

**1. Payload Shape:**
*   **The Fix:** Do not nest everything under `{ result: <string> }`. While it works, it's token-inefficient and forces the model to "parse" the string.
*   **Better Schema:** Use a flat, descriptive schema. If a tool returns data, return the object directly: `{ status: "success", data: { ... } }`. If it's an action, return `{ status: "executed", effect: "clock_updated_to_3:30" }`.

**2. Action-only Tools:**
*   **The Verdict:** Returning state confirmation is **mandatory**. If you just return `{"result":"done"}`, the model's internal "state tracking" is weaker. By returning `{"status":"displayed","widget":"set_clock","params":{"time":"3:30"}}`, you are reinforcing the model's memory of what is currently on the student's screen. This prevents the model from asking "Can you see the clock?" when it just set it.

**3. Batching:**
*   **The Verdict:** Your current pattern (one `sendToolResponse` for the whole batch) is correct. Sending individual responses for a single turn's batch can cause race conditions in the model's state machine.

**4. Multimodal (The 1007 Crash):**
*   **The Warning:** Your "text in tool response, image via `sendRealtimeInput` after" is the only way to avoid the 1007 error, but it creates a **race condition**. 
*   **The Risk:** The model might start generating audio based on the tool response *before* the image arrives via `sendRealtimeInput`. 
*   **The Fix:** In your `toolResponsePayload`, include a hint: `{"result": "Image is loading now, wait for it before describing."}`. This encourages the model to pause slightly or acknowledge the incoming visual.

---

### Area 3: System Prompt and Dispatchers

**1. Injection Order:**
*   **The Problem:** Your current order (Neural Net -> Dispatcher -> Student Data) is suboptimal.
*   **The Fix:** Move the **Dispatcher Instructions** to the very top or immediately after the Character Prompt. 
*   **Rationale:** The model needs to know *how* to use its tools (the routing logic) before it looks at the *list* of tools (neural net context). Think of it as giving the model the "Grammar" of tool use before the "Vocabulary."

**2. Truncation Priority:**
*   **Drop First:** Course TOC (Keep only the current and next chapter).
*   **Drop Second:** Older Memory Context (Keep only the last 3-5 sessions).
*   **Never Drop:** Character Prompt, Dispatcher Instructions, Student Snapshot (current goals).

**3. Inline Examples:**
*   **The Verdict:** Keep them. For the "JSON-in-a-string" pattern (`params_json`), the function schema alone is often not enough for Flash models to get the escaping right. One or two "Golden Examples" in the prompt are worth 100 lines of schema definition.

---

### Critical Risks (The "Production" Reality Check)

**1. The 40k Character Limit vs. Latency:**
You are pushing the limits of `gemini-3.1-flash-live-preview`. While the limit is 40k, the **TTFT (Time to First Token)** scales with prompt size. At 40k chars + 63 tools, you are likely looking at a 1.5s - 2.5s delay before Daniela speaks. In a voice session, 2 seconds feels like an eternity. 
*   *Optimization:* Aggressively prune your `tool_knowledge` (Neural Net context). Do you really need 15 tools? Try 5-7.

**2. The "Dispatcher" Bottleneck:**
Using 4 tools to route to 139 capabilities is clever, but it's a "reasoning tax." Every time Daniela wants to show a Kanji tool, she has to:
1.  Decide to use a tool.
2.  Select `classroom_widget`.
3.  Recall the string `"kanji_practice"`.
4.  Format the `params_json`.
*   *Risk:* Flash models occasionally "hallucinate" the parameter names when they are nested inside a dispatcher. Monitor your logs for `params_json` keys that don't match your backend expectations.

**3. Shared Dev/Prod Database:**
*   **Danger:** You mentioned a single Neon database shared between dev and production. **Fix this immediately.** A migration error in dev or a stray `DELETE` during testing will take your production AI tutor offline. Neon makes branching/cloning easy—use it.

**4. Audio Modality 1011 Error:**
You are correctly using `AUDIO` only to avoid the 1011 error. However, be aware that `outputAudioTranscription` is sometimes slightly delayed compared to the audio stream. If your frontend relies on the transcription to trigger UI sync (like highlighting text), you may see a "laggy" UI. Always sync UI to the audio timestamp if possible, not the arrival of the transcription packet.