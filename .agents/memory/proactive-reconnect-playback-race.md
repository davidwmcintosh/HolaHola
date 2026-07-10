---
name: Proactive WS reconnect vs audio playback race
description: Connection state and audio playback state are separate clocks; a timer gated only on connection state can cut off live audio.
---

The voice client cycles its WebSocket proactively (every ~4.5 min) to beat Replit's 5-min proxy hard-kill, deferring only when the *connection* state is mid-turn. But connection state returns to idle as soon as the server signals the response is fully sent — not once the browser has finished *playing* the audio. Those two clocks can diverge by several seconds.

**Why:** Any timer/cleanup logic that gates on "is a turn in flight" using connection/session state alone will misfire during the gap between "server done sending" and "client done playing." This was a leading suspect for a long-standing high-frequency (300+) chronic mid-sentence connection drop pattern.

**How to apply:** When deferring a disruptive action (reconnect, cleanup, teardown) around live audio/streaming turns, always check the actual playback state (a dedicated store/flag), not just the request/response or connection state machine. Look for a plain non-React accessor for such state so it can be read from non-component client code.
