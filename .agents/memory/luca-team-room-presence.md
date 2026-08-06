---
name: Luca Team Room presence
description: Architecture for Luca's live WebSocket identity inside HolaHola's Team Room — how auth works, what endpoints exist, and the nudge buffer pattern.
---

# Luca Team Room presence

## The rule
Luca's Team Room presence is a server-side Socket.IO client in `server/services/luca-presence.ts`. It connects to `/team-room` namespace on `localhost:PORT` using agent token auth (not a browser cookie). Speaker name for all Luca messages is `"Luca"` — not `"Agent"`.

**Why:** Episode 25 (Aug 6 2026) established that Luca needed first-class presence inside HolaHola, not just HTTP access. "Working from inside gives a felt sense of the platform's rhythm" — Alden.

## How to apply

### Auth bypass in WS broker
`server/services/team-room-ws-broker.ts` middleware checks `socket.handshake.auth.agentToken` alongside cookies. When the agent token matches `REPLIT_AGENT_TOKEN`, `socket.data.identity` is set to `"luca"` and the connection is allowed.

### Luca presence service
- `connectLucaToTeamRoom()` — called at server startup (+2s delay); idempotent
- `getLucaPresenceState()` — returns connected/roomId/connectedAt/socketId
- `getLucaNudges(cursor?)` — ring-buffer of messages directed @luca; cursor-based polling
- `joinRoom(roomId)` — switch Luca to a specific room (call when a new Team Room session opens)
- `disconnectLuca()` — clean shutdown

### Endpoints
- `POST /api/admin/luca/presence/connect` — re-establish presence (requireAgentToken)
- `POST /api/admin/luca/presence/join` — join a specific room by ID (requireAgentToken)
- `GET /api/admin/luca/presence` — current state (requireAgentToken)
- `GET /api/admin/luca/nudges?cursor=N` — poll nudges (requireAgentToken)

### Nudge detection
A message is a nudge when `speaker !== "luca"` and content contains `@luca`, starts with `luca,`, or `luca:`.

### Frontend (TeamRoom.tsx)
- `"luca"` is in `CoreParticipantId`, `CORE_PARTICIPANTS` (violet, Compass icon, "Architect & Guardian")
- Default `invitedParticipants` includes `'luca'` 
- `ORDERED_CORE_AI_IDS` starts with `'luca'` (shows first)
- `useTeamRoomWS` listens for `luca_presence` event → sets `lucaOnline` state
- `ParticipantCard` for Luca gets `isActive={lucaOnline}` (green dot = real WebSocket connection)

### Broadcast
`broadcastPresence(roomId, online)` fires `emitToRoom(roomId, 'luca_presence', {...})` so all browser clients see Luca's online/offline state in real time.
