---
name: Gemini Live greeting ownership
description: Durable ownership rule for fresh and resumed Gemini Live orientation turns.
---

The client supplies greeting intent and current context only after the session is
ready; the Gemini Live session owns transport timing, setup queuing, dispatch,
delivery acknowledgement, and retry.

**Why:** Independent client and provider bootstrap owners raced in production,
causing both silent starts and duplicate greetings. Send acceptance is not proof
that the learner heard anything; first audio is the acknowledgement.

**How to apply:** Keep exactly one bounded retry authority for send failures,
no-audio completions, and watchdog expiry. Resumed sessions use explicit
orientation intent, while provider bootstrap must never independently greet.