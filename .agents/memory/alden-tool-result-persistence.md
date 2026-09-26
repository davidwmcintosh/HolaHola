## Alden tool-result persistence boundary

Alden's Anthropic/Gemini tool-calling loop (executeAldenTool plus the
round-trip handler that feeds tool results back to the model) keeps
tool-result JSON in-flight only, for that turn's continued generation. It is
never written directly into `aldenMessages.content` or any other persisted
store -- only the text Alden himself generates as his final reply gets
saved. Push events (`aldenActivity`) also never carry raw tool-result
payloads.

**Why:** confirmed by tracing the tool-loop code path while wiring
conversational runtime-admin tools (register/revoke/list a coordination
runtime) that return a one-time bootstrap credential. A one-time secret
returned from a tool is not durably stored anywhere the tool-result flows
through -- the only realistic leak path is Alden voluntarily quoting it
back in his own spoken reply.

**How to apply:** when adding a tool that returns sensitive or one-time
data (credentials, tokens, keys) to Alden's registry, a code-level
redaction layer is not required -- none exists in this codebase for tool
results, and the persistence boundary already stops the raw payload from
lingering. Instead, instruct Alden not to restate the sensitive value after
his reply via the tool's own description and result payload (e.g. a `note`
field), mirroring the existing "shown once" convention already used at the
HTTP/CLI layer for the same credential-issuing functions.

