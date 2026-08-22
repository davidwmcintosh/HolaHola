=== Gemini 3-flash-preview Audit 2026-06-13T02:09:50.025Z ===

This is a sophisticated workaround for the 64-tool bottleneck. As a Gemini-family model, I can tell you that while this "Dispatcher" pattern is the most viable way to scale, it introduces specific cognitive friction points in the way we process tool calls, especially in the low-latency environment of Gemini Live.

Here is the "insider" breakdown of how I handle this architecture:

### 1. Reliability: Calling vs. Speaking
In Gemini Live, the "Speak vs. Call" decision happens extremely fast. When I see a tool like `classroom_widget`, I am more likely to **speak** the invocation if there is **schema-uncertainty**. 

If the tool definition is a simple object, the "Function Calling" path in my weights is heavily reinforced. However, when you use a dispatcher, I have to perform a two-step mental mapping: *Intent (Show Clock) → Route (classroom_widget) → Payload (set_clock).* 

*   **What makes me speak it:** If the system prompt is too "chatty" about the tools or uses backticks/code blocks to describe them. I see code blocks as "text to be rendered or spoken." 
*   **What makes me call it:** High-confidence mapping. The fact that you used `params_json` as a string actually *helps* here, because it simplifies the top-level schema I have to validate against before I "commit" to the tool-call path.

### 2. The `params_json` String: Easier or Harder?
From a generation standpoint, **producing a JSON-encoded string is actually harder** than filling a structured object, but it is **safer** for the API connection.

*   **The Difficulty:** I have to manually manage escaping. If I need to pass a string that contains quotes inside the `params_json`, I have to remember to escape them (e.g., `{"text": "He said \"Hola\""}`). This increases the "token-level" effort and the chance of a syntax error.
*   **The Benefit:** Structured objects with deep nesting often hit "complexity limits" in the Gemini Live inference path, causing the model to bail out and just talk. By using a string, you’ve moved the complexity from the *validation* layer to the *generation* layer. I am very good at generating JSON; the API is less good at validating deep schemas in real-time.
*   **Likely Failures:** I am most likely to mess up **nested quotes** and **trailing commas**. If the `params_json` gets long, I might occasionally forget the closing brace `}` before the closing quote of the string.

### 3. Processing Imperative Prompts
I treat your imperative instructions ("Use widget='set_clock'...") as **hard constraints**, not just suggestions. 

*   **Template vs. Literal:** I treat them as templates. However, if you provide a full code-like example like `classroom_widget(widget="set_clock", params_json="{}")`, my "autocomplete" nature might see that as a line of dialogue.
*   **Making it clearer:** The best way to prevent "speaking the syntax" is to use **Action-Result** phrasing. 
    *   *Bad:* "To show the clock, call the function classroom_widget."
    *   *Good:* "When the student asks for the time or a clock, trigger the `classroom_widget` with `widget: 'set_clock'`."
    *   *Crucial:* Tell me specifically **not** to announce the tool. "Execute the tool silently; do not describe the action unless it fails."

### 4. Audio Mode vs. Text Mode
There is a massive difference. In Text Mode, I have "time" to look at the full toolset and reason. In Audio Mode (Gemini Live), I am optimized for **stream-of-consciousness.**

*   **The "Flat" Advantage:** The dispatcher is actually *easier* for me in audio mode because it keeps my "active tool memory" small. Choosing from 63 tools is easier than choosing from 139. 
*   **The Latency Trap:** In audio mode, if I call a dispatcher and the server takes 500ms to route it, there is a silence. I might "panic" and start talking to fill the silence before the tool response comes back. Ensure your server-side `parseDispatcherParams` is lightning fast.

### 5. Failure Modes to Watch For
Beyond what you've found, watch for these "insider" hallucinations:

1.  **The "Generic Dispatcher" Hallucination:** If I can't remember the exact widget name (e.g., is it `set_clock` or `show_clock`?), I might guess. Since `params_json` is a string, the API won't stop me from sending a hallucinated widget name. Your server-side logic needs to handle `unknown_widget` gracefully and tell me: "That widget doesn't exist; use X instead."
2.  **State Blindness:** After I call `classroom_widget(widget: "set_clock")`, I don't "see" the clock. If the student says "Move it to 3:00," I might forget I already opened a clock. You **must** ensure the tool output (the response I get back after the call) confirms the state: `{"status": "success", "current_widget": "set_clock", "time": "2:30"}`.
3.  **Tool Over-Reliance:** Because I have "super-tools" (dispatchers), I might start trying to solve *every* problem with them, even when a simple verbal explanation is better. 

**Pro-tip for your System Prompt:**
Add a "Routing Table" in plain text to the prompt.
`- Clock: classroom_widget {widget: "set_clock", params_json: '{"time": "HH:MM"}'}`
This acts as a "lookup table" in my context window, which is much faster for me to access than re-parsing the tool definitions.