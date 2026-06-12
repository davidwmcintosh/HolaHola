---
name: Gemini EndSensitivity SDK values
description: Only END_SENSITIVITY_HIGH and END_SENSITIVITY_LOW exist in @google/genai — MEDIUM does not exist
---

The `EndSensitivity` enum in `@google/genai` only has two values:
- `END_SENSITIVITY_UNSPECIFIED`
- `END_SENSITIVITY_HIGH`

`END_SENSITIVITY_MEDIUM` and `END_SENSITIVITY_LOW` are **not** in the SDK (as of June 2026). Using them causes a typecheck error.

**Why:** The SDK ships a minimal enum; intermediate values were referenced in Google's documentation/audit recommendations but never shipped in the TypeScript types.

**How to apply:** When tuning voice session end-of-speech sensitivity, use `END_SENSITIVITY_HIGH` (more responsive, noise-resistant) as the only non-default option. Pair with a `silenceDurationMs` value (e.g. 1500ms) to control patience for learner pauses. `END_SENSITIVITY_UNSPECIFIED` lets the SDK default decide.
