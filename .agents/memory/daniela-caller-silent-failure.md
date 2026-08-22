---
  name: Daniela caller silent-failure fix
  description: Why Luca's Daniela-contact paths sometimes appeared to get "no response" and how it was fixed.
  ---

  `server/services/daniela-caller.ts` is the shared utility behind every Daniela Gemini call (voice endpoint, text util, browser lesson skill all route through it). Its tool-use loop (`callDanielaWithTools`) used to return a bare empty string `''` in two places: when the model returned empty text with no function calls, and when it exhausted MAX_TURNS (was 6) without ever producing final text. Both looked identical to "Daniela said nothing" to any caller, with zero diagnostic signal.

  **Why:** Luca (the Agent) needs immediate, reliable feedback from his contact paths with Daniela. A silent empty string is indistinguishable from "the model chose to say nothing" vs. "the tool loop got stuck" vs. "the API call failed" — all very different problems requiring different fixes.

  **How to apply:** Empty-text-no-function-calls now triggers one automatic retry turn before giving up. MAX_TURNS raised 6→8 for more headroom on longer tool chains. Exhausting MAX_TURNS returns an explicit `[DANIELA_CALLER_ERROR: reached MAX_TURNS...]` string instead of `''`. The whole `callDaniela()` entrypoint is wrapped in try/catch so a thrown Gemini API error becomes a readable `[DANIELA_CALLER_ERROR: <message>]` string instead of crashing the caller. If you see this error string surface anywhere, check server logs for the underlying FC handler error it points to — don't just retry blindly.
  