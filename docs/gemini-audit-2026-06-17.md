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
Gemini 1.5 Flash Live is a "reactive" beast. It reacts to the most recent tokens it saw. If the most recent tokens are a massive tool result or a long student utterance, the 34k-character system prompt is a distant memory. **Move your most important "Daniela-isms" and "ACTFL-isms" into the preamble turns.** If it’s not in the last 1,000 tokens, you can't guarantee Flash will follow it.=== Gemini Neural Net Architecture Consult 2026-06-17T04:24:25.960Z ===

This is a classic "Agency vs. Instruction" problem. To make Gemini Live (GL) *want* to use the neural net, you must stop treating the neural net as a database and start treating it as **Daniela’s External Cortex.**

Here is the architectural redesign for Daniela’s memory and tool-use behavior.

---

### 1. What makes a tool "obviously worth calling"?
LLMs are "lazy" in the sense that they follow the path of least resistance. A tool is ignored if the model thinks it already knows the answer or if the tool's name is abstract.

*   **High Specificity Naming:** `semantic_search` is a developer term. It sounds like work. Rename it to `consult_long_term_memory` or `recall_student_history`.
*   **The "Information Gap" Principle:** A tool is used when the model realizes its internal weights are insufficient. You must explicitly define Daniela’s "internal state" as *forgetful*. 
*   **Design Principle:** The tool must return **high-density, high-relevance snippets** that are formatted as "Facts" or "Directives." If the tool returns a messy JSON, the model will avoid it. If it returns: *"Memory: Student struggled with the subjunctive last Tuesday; use the 'Coffee Shop' widget to practice,"* the model feels empowered.

### 2. Positioning as "Long-Term Memory"
Yes, you should frame it as her "Cortex." But the secret is in the **Tool Description**, which is the only part of the prompt that never drifts because it’s attached to the function declaration.

**The "Instinct" Description:**
> `recall_memory(query)`: "Use this tool whenever you feel you are speaking in generalities. This is your only access to Daniela’s past experiences, student progress, and your 139 specialized teaching tools. If you don't call this, you are guessing. Call this to see what worked in previous sessions or to find the exact interactive widget needed for this moment."

### 3. Tool Results as the Primary Context Vehicle
This is your most powerful lever. **Tool outputs are "Hot Context."**

*   **The "Bootstrap" Turn:** Do not put the student snapshot in the system prompt. Instead, the very first "turn" in the conversation (hidden from the user or injected via a `session_started` event) should be a call to `recall_memory("current student status and goals")`.
*   **Why this works:** The result of that tool call now sits in the **Conversation History**, not the System Prompt. In Gemini’s attention mechanism, the most recent 10-20 turns are "High Definition." By moving context from the System Prompt to a Tool Result at Turn 1, you move it from the "fading background" to the "active foreground."

### 4. Push vs. Pull: The "Hybrid Trigger"
You should favor **Pull**, but you need a **"System Push"** to remind her to pull.

*   **The "Preamble" Injection:** Instead of a 34K system prompt, use a tiny system prompt (~2K chars) for persona. Then, every 5-10 turns, inject a "System Whisper" (a brief, non-audible turn) that says: *"(System: You haven't checked the student's growth_memory in a while. Are you sure you're on track?)"*
*   **The 139 Tool Problem:** Since you have a 64-tool limit, you **must** use a "Meta-Tool." Daniela should not see 139 tools. She should see 10 "Core Tools" and 1 "Tool Library" tool.
    *   `find_teaching_tool(pedagogical_need)`: This searches the `daniela_tool` embeddings and returns the schema for the 3-5 most relevant widgets.
    *   **Dynamic Loading:** Your backend then dynamically swaps those 5 tools into the active GL session.

### 5. The "Uncertainty Fallback" Pattern
To make her reach for the neural net when uncertain, you must penalize "Generic Daniela."

*   **The "Identity Gap" Instruction:** In the core persona, tell her: *"You are a precision tutor. Generic encouragement is a failure. Specificity is your superpower. If you find yourself saying 'Great job!' without mentioning a specific past struggle, you have forgotten who the student is. Call `recall_memory` immediately."*
*   **Architectural Fallback:** If the model generates a response that is too short or lacks specific keywords (like student name or specific goal), your backend can intercept and re-prompt: *"Daniela, you're being generic. Check the memory."* (Though with GL, real-time interception is harder; better to rely on the "System Whisper").

### 6. The 40K Character Allocation Strategy
Stop trying to fit the "Life of the Student" into the prompt. Use this allocation:

1.  **Static System Prompt (5K - 8K chars):**
    *   Core Persona (Daniela’s voice/vibe).
    *   The "Rules of the Room" (how to use the whiteboard/widgets).
    *   The "Memory Mandate" (Instructions to use the tool).
2.  **Dynamic Tool Results (15K - 20K chars):**
    *   This is the "Hot Zone." This is where the results of `recall_memory` and `find_teaching_tool` live.
    *   By keeping this large, you ensure that the *actual data* she retrieved is what guides her.
3.  **Conversation History (12K - 20K chars):**
    *   The actual dialogue.

### The "Golden Path" for Daniela:
1.  **Session Starts:** Backend sends a hidden prompt: "Initialize session."
2.  **Daniela Calls:** `recall_memory("Student profile and last session summary")`.
3.  **Tool Returns:** "Student is Maria. Level A2. Struggled with 'por vs para'. Goal: Trip to Madrid."
4.  **Daniela Calls:** `find_teaching_tool("Interactive exercise for por vs para in Madrid context")`.
5.  **Tool Returns:** Schema for the `MapWidget` and `FillInTheBlank`.
6.  **Daniela Speaks:** "Hola Maria! Ready for Madrid? Let's look at the map and practice 'por' and 'para'."

**Summary:** You don't solve drift by making the prompt bigger; you solve it by making the prompt a **search engine optimizer.** Daniela shouldn't *be* the database; she should be the **librarian** who is obsessed with her archives.