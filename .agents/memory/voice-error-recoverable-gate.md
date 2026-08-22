---
name: voice_error recoverable gate bug
description: streamingVoiceClient.ts voice_error handler unconditionally set intentionalDisconnect=true — recoverable errors blocked all subsequent socket.io reconnects.
---

## The rule

In `streamingVoiceClient.ts`, the `case 'voice_error':` handler MUST check `veRecoverable` before setting `intentionalDisconnect = true`. Only set the gate for non-recoverable errors.

**Why:** The server sends a recoverable `voice_error` (e.g. `GEMINI_WS_ERROR` with `recoverable: true`) whenever GL fires a 1008 mid-response. `intentionalDisconnect = true` causes `handleDisconnect()` to bail immediately — skipping the entire 12-attempt auto-reconnect path. So if socket.io drops for ANY reason after a recoverable `voice_error` (4G network drop, event-loop stall, heartbeat miss), the client permanently goes offline. Result: "Session ended — The connection was lost. Let's start fresh!" toast, Daniela doesn't return.

**How to apply:**
- For `recoverable: true` → `setState('reconnecting')`, do NOT set `intentionalDisconnect`
- For `recoverable: false` → `setState('error')` + `intentionalDisconnect = true` (original behavior)

Fixed July 25 2026. Confirmed by Sofia Agent who independently tracked `network_instability_4g` pattern for same user.
