# Gemini Audit — Dispatcher Architecture Review
Date: 2026-06-13

## Summary
Gemini 2.5 Pro reviewed the hybrid dispatcher architecture for Gemini Live's 64-tool limit. Overall verdict: clever, pragmatic, production-ready. Key findings below.

---

## 1. params_json Failure Modes

**Syntactic failures:** Beyond single-quote fix, expect trailing commas, unescaped quotes within string values, or completely malformed structures.
- Defense: Use `json5` library — designed for JSON written by humans/models. Log every time lenient parse succeeds where JSON.parse fails → this is your model error rate metric.

**Semantic failures (valid JSON, wrong schema):**
- Hallucinated keys: `{"time_string":"2:30"}` instead of `{"time":"2:30"}`
- Missing required keys: calls set_clock but provides `{}`
- Wrong types: `{"time":1200}` instead of `{"time":"12:00"}`
- Defense: Validate against a Zod schema per sub-tool after parsing. If validation fails, return a structured error AS the function call result — Gemini will often self-correct and retry with fixed params.

**Self-correction loop (recommended):**
```json
{
  "error": "Invalid parameters for 'set_clock'",
  "message": "The 'time' parameter is required and must be a string in 'HH:MM' format."
}
```

**Monitoring dashboard to add:**
- dispatcher_calls_total (by dispatcher type)
- dispatcher_parse_failures
- dispatcher_validation_failures
- dispatcher_success

---

## 2. System Prompt Design for Gemini Live

Our discovery (code-style syntax → model speaks it aloud) is the canonical pattern. Confirmed guidance:

1. Use imperative, goal-oriented language: "To show a clock, use the classroom_widget tool."
2. Describe params in plain English — single quotes in the prompt text make examples feel less like code
3. Separate instruction from example clearly (our current prompt does this correctly)
4. Avoid XML tags, Markdown code blocks, numbered lists that resemble code — these also trigger "speak instead of call"

**Core principle from Gemini:** "The system prompt should sound like a director giving instructions to an actor, not a programmer writing a spec."

---

## 3. Schema Design Critique

**On enum + free-form string pattern:**
- Verdict: Reasonable and pragmatic. The enum for widget/type/action constrains the routing key (the part the model must get right for the call to succeed at all). The free-form string params_json accepts the semantic payload.
- Risk: The enum constrains routing but doesn't constrain params. A model that calls classroom_widget correctly but passes garbage params_json still routes correctly but fails downstream. The Zod validation layer is the critical missing piece.

**Alternative Google would suggest:** Separate tool declarations per widget group — but this is exactly what the 64-tool limit prevents. The dispatcher is the correct workaround given the constraint.

---

## 4. Token Efficiency

~700 tokens for dispatcher system prompt per session on top of an already large system prompt.

**Recommendations:**
- The tool description in the registry schema is the primary source of truth. If the neural net retrieves the tool_knowledge for classroom_widget, the model has more detail than the system prompt provides.
- Consider compressing the dispatcher system prompt to just the routing map: "Use classroom_widget for visual displays, exercise_tool for language exercises, memory_action for memory ops, admin_action for bookkeeping." Then rely on the tool schema and neural net tool_knowledge for parameter details.
- Gemini noted that for simple, high-confidence tools (clock, weather, emotion), the enum + description in the schema is usually sufficient without additional system prompt guidance. System prompt guidance is most valuable for edge cases and disambiguation.

---

## 5. Red Flags / Future Risks

1. **The enum as bottleneck:** Every new tool added to a dispatcher requires a registry edit to add it to the enum. If the enum is missed, the tool silently fails (model calls the dispatcher with an unrecognized widget name, routing fails). Mitigation: the fuzzy lookup + explicit "Unknown widget" error log is good. Consider adding a test that checks all sub-tools have their legacyType registered.

2. **64-limit headroom:** Currently at 64/64 (at the cap). Any new native GL tool addition must come with a corresponding exclusion or demotion to a dispatcher. The FATAL assertion protects against silent overflow. Keep the assertion; consider lowering threshold to 63 to give a one-slot buffer.

3. **Audio mode + function calling latency:** In GL audio mode, function calls pause audio generation until the tool response is received. If a dispatcher handler takes >2-3s (e.g., a slow DB lookup in memory_action), users hear a silence gap. All dispatcher handlers should return within 500ms; heavy operations should return immediately with a "loading" acknowledgment and then push updates via WebSocket.

4. **Multi-dispatch in one turn:** If the model decides to call classroom_widget AND exercise_tool in the same turn (e.g., "show the clock and start a conjugation drill"), GL sends them as parallel tool calls. The routing handles each independently — this should work correctly. But test this explicitly.

---

## Verdict

The architecture is sound. The two immediate priorities are:
1. Zod validation per sub-tool with self-correction error returns
2. Lowering the GL cap assertion from 64 to 63 (one-slot buffer)

The system prompt design (plain imperative language, no call syntax) is correct and confirmed by Gemini.
