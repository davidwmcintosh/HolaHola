=== Gemini Audit 2026-06-17T00:48:20.504Z ===

This is a sophisticated implementation, but you are hitting the "Flash-model ceiling." Gemini 1.5 Flash (the engine behind Gemini Live) is optimized for speed and tool-calling accuracy, but it has a shorter "effective attention span" than Pro when it comes to complex persona nuances buried under a mountain of tool definitions.

Here is a direct assessment of your friction points and architectural questions.

---

### FRICTION POINT 1: Relational Blankness
**The Reality:** Gemini Flash is a "utility-first" model. When you give it 64 tools, its internal attention mechanism prioritizes the `tools` namespace. It views its primary job as "selecting the right tool" or "answering the prompt." Relational warmth is seen as "flavor text" that can be sacrificed for latency or accuracy.

**The Fix:**
1.  **The "Persona Anchor" in Preamble:** Do not rely on the system prompt for warmth. Inject a "Persona Anchor" as the *very last* turn in your preamble (the one right before the user's utterance). 
    *   *Example:* `system: "Reminder: You are Daniela. You are warm and empathetic. Before you execute any tool or give a lesson, acknowledge the student's effort with a brief, human sentence."`
2.  **Tool-Linked Warmth:** If Daniela goes blank specifically when calling tools, it’s because she’s in "execution mode." Modify your tool descriptions to include: *"When calling this tool, always preface your response with a supportive comment about the student's progress."*

### FRICTION POINT 2: ACTFL Knowledge and Application
**The Reality:** Gemini knows *of* ACTFL, but it doesn't "live" it. To a model, "Novice High" is just a label. It doesn't inherently know that it must restrict its own vocabulary to high-frequency words or avoid the subjunctive mood.

**The Fix:**
1.  **Behavioral Constraints > Can-Do Statements:** Can-Do statements describe the *student*. You need to describe the *tutor’s output*. 
    *   *Instead of:* "Student is Novice Mid."
    *   *Use:* "Output Constraint: Use 80% English. Use only present tense Spanish. Limit Spanish vocabulary to: [List]. If the student uses a complex word, praise them but do not use complex words back."
2.  **The "Level Header" in Preamble:** Inject the current level constraints into every single preamble. Gemini Live is a "sliding window" of attention. If the ACTFL rules are 30k tokens away in the system prompt, they are effectively invisible during a high-intensity voice exchange.

### FRICTION POINT 3: Continuity after Blips
**The Reality:** Gemini (and most LLMs) has a "First Turn Bias." If the context looks "fresh" (even with history), the model's strongest training weights tell it to introduce itself. The `isResumed` flag is too weak.

**The Fix:**
1.  **The "Last State" Injection:** Instead of a flag, inject a "Current State" summary as a system turn at the end of the history:
    *   *System turn:* "RESUMING SESSION. You were in the middle of the 'Grocery Store' scenario. The student just asked how much the milk costs. Do NOT greet them. Pick up exactly where you left off."
2.  **Tool Chain Silence:** If a tool takes 3 seconds, Gemini Live's VAD (Voice Activity Detection) might trigger a "turn end." You must ensure the backend sends a "Processing..." signal or a "thought" token to keep the session active, or explicitly tell the model in the system prompt: "When a tool is running, do not re-introduce yourself when the result returns."

---

### Q4 — Claude-ese vs. Gemini-ese
*   **Claude** loves XML tags (`<persona>`, `<tools>`) and long-form reasoning.
*   **Gemini** is a "List and JSON" model. It prefers Markdown headers (`# Persona`, `## Rules`) and very flat, explicit instructions.
*   **Tooling:** Gemini is much more sensitive to the `description` field in the tool declaration than Claude. If your tool descriptions are "Claude-optimized" (verbose, prose-heavy), Gemini might get confused. Keep Gemini tool descriptions "Google-style": imperative, concise, and focused on *when* to call it.
*   **Function Results:** Gemini hates "chatty" function results. If a tool returns a massive JSON blob, Gemini might hallucinate or get overwhelmed. Return only the essential data.

### Q5 — System Prompt Length and Priority
**34K characters is too long for 1.5 Flash to maintain high-fidelity persona adherence.** 
You are experiencing "Middle-of-the-Prompt" loss. 
*   **The Token Budget:** Try to get your static system prompt under 10K characters. 
*   **The Dispatcher Strategy:** You have 139 tools. If you are sending 64 "just in case," you are drowning the model. Use your backend logic to only send the 10-15 tools relevant to the *current* scenario/level. 
*   **Ordering:** Put the most critical behavioral rules (Language Mixing, Persona) at the *very end* of the system prompt, just before the tools. The "end" of the prompt usually has higher weight than the middle.

### Q6 — Where to put ACTFL level constraints?
**The "Sandwich" Method is the only way to ensure consistency in Gemini Live:**
1.  **System Prompt:** High-level definition of Daniela and the ACTFL framework.
2.  **Tool Metadata:** If a tool (like `launch_scenario`) is called, the tool's *output* (the result sent back to Gemini) should include: `{"status": "success", "reminder": "The student is Novice Low. Keep your response 90% English."}`.
3.  **Dynamic Preamble (The most important):** Every single turn, inject a 1-sentence "Current Constraint" turn. 
    *   *Example:* `system: "Current Level: Intermediate Mid. Use 50/50 Spanish/English. Focus on past tense narration."`

### Final "Hard Truth" Advice:
Gemini 1.5 Flash Live is a "reactive" beast. It reacts to the most recent tokens it saw. If the most recent tokens are a massive tool result or a long student utterance, the 34k-character system prompt is a distant memory. **Move your most important "Daniela-isms" and "ACTFL-isms" into the preamble turns.** If it’s not in the last 1,000 tokens, you can't guarantee Flash will follow it.