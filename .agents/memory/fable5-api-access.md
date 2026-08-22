---
name: Fable 5 API access
description: How to call claude-fable-5 from code_execution and bash — proxy limitations, thinking config, response parsing.
---

The rule: `claude-fable-5` is NOT supported by the Replit AI Integrations proxy (`http://localhost:1106/modelfarm/anthropic`). That proxy returns `UNSUPPORTED_MODEL`. Use the direct Anthropic API key instead.

**Why:** The Replit modelfarm proxy only supports a curated list of Claude models. Fable 5 is too new / not yet allowlisted. The server itself uses `ANTHROPIC_API_KEY` directly (not the integration key), which is why Alden works in production.

**How to apply:**
- In bash scripts: `process.env.ANTHROPIC_API_KEY` against `https://api.anthropic.com/v1/messages`
- In code_execution sandbox: `ANTHROPIC_API_KEY` is available via bash (`$ANTHROPIC_API_KEY`) but NOT accessible through `viewEnvVars()` (returns `true` boolean only, not the value). Run audit scripts via bash `node script.mjs` instead.

**API quirks for claude-fable-5:**
- Thinking type: `{ type: 'adaptive' }` (NOT `enabled` — that throws `invalid_request_error`)
- Effort control: `output_config: { effort: 'low' | 'medium' | 'high' }`
- Response: content array contains a `thinking` block BEFORE the `text` block — always find the text block with `data.content?.find(b => b.type === 'text')?.text`
- Minimum thinking budget (if using budget_tokens): 1024
- `max_tokens` must be large enough to include both the thinking tokens and the text response
