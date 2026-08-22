# Luca Chat Panel — Design Spec
**Date:** 2026-08-22  
**Status:** Approved  
**Author:** Luca (Replit Agent)

---

## Problem

David needs to have a real-time text conversation with Luca while Daniela's live session is running — captured canonically, informed by what Daniela is doing, with the ability to relay selected Luca messages directly into Daniela's session.

The current `LucaObserverPanel` shows backend observation data (tool calls, Guardian fires, friction scores) that David does not need to see. It occupies the right slide-out slot but provides no conversational interface.

---

## Goal

Replace the backend-data view in the right panel with a simple David↔Luca chat window. Luca's observation of Daniela's session becomes internal knowledge that informs his responses — not a display layer for David.

---

## Layout (unchanged)

```
┌─────────────┬──────────────────────┬──────────────────┐
│  Studio     │     Daniela          │  [Luca chat]     │
│  (left)     │     (center)         │  slide-out right │
│  unchanged  │     unchanged        │  hidden by default│
└─────────────┴──────────────────────┴──────────────────┘
```

- Toggle button (existing position, bottom-right) opens/closes the right panel.
- When closed, panel is fully hidden — no change to Daniela's visible workspace.
- When open, panel slides in from the right at its existing width.

---

## Right Panel: `LucaChatPanel`

Replaces `LucaObserverPanel.tsx`. Same props interface (`isOpen`, `onToggle`, `sessionId`).

### UI elements

| Element | Description |
|---|---|
| Header | "Luca" label + close/collapse button |
| Message thread | Scrolling list; David's messages right-aligned (blue); Luca's left-aligned (neutral) |
| "→ Daniela" button | Appears on each Luca message; injects that text into the active Daniela session |
| Text input | Single-line, Enter to send, Send button |
| Loading state | Spinner while Luca is responding |

### Behaviour

- On open, loads recent David↔Luca exchange history (last ~20 messages).
- David sends a message → POST to `/api/admin/luca/chat` → response streams back as a single completed turn.
- Both David's message and Luca's response are saved to `conversation_memories` with tag `david-luca-chat` before the response is returned.
- "→ Daniela" injects the message text into the active Daniela session via the existing session-inject path; a small "sent ✓" confirmation replaces the button briefly.
- Daniela does **not** see David↔Luca messages unless David explicitly presses "→ Daniela".

---

## Server: New Endpoint — `POST /api/admin/luca/chat`

**Auth:** `requireAgentToken` or `requireFounder` (same pattern as other Luca endpoints)

**Request body:**
```json
{
  "message": "string",
  "sessionId": "string | null"
}
```

**What the handler does:**
1. Fetches current Daniela session state from the in-memory observation store (same data as `/api/admin/luca/observe`) — used as internal context only, not returned to client.
2. Fetches last N David↔Luca exchanges from `conversation_memories` (tag: `david-luca-chat`) for conversation history.
3. Calls Luca response composition (existing four-channel `composeLucaTurn` in `inner-life-capture.ts`) with:
   - David's message
   - Daniela session state as background context
   - Conversation history
4. Saves David's message + Luca's response to `conversation_memories` (tag: `david-luca-chat`, entry_type: `conversation`).
5. Returns Luca's response text.

**Response:**
```json
{
  "reply": "string",
  "savedAt": "ISO timestamp"
}
```

---

## Server: New Endpoint — `GET /api/admin/luca/chat`

Returns the last 20 David↔Luca exchanges for panel hydration on open.

**Response:**
```json
{
  "messages": [
    { "role": "david" | "luca", "content": "string", "createdAt": "ISO timestamp" }
  ]
}
```

---

## Relay: "→ Daniela"

Calls the existing Daniela session-inject mechanism with the selected Luca message text. Attributed as a system/context injection (not as a new student message). Implementation reuses whatever path the existing dev-notes injection uses, or the `sendClientContent` path on the active GL session if one is running.

---

## Luca's Response Context

When Luca responds, he has access to:

| Source | What |
|---|---|
| Daniela observation store | Recent messages, tool calls, friction score, Guardian fires, scene state |
| `conversation_memories` (tag: david-luca-chat) | Last ~10 David↔Luca exchanges |
| North Star values + personal reflections | Standard Luca grounding (same as always) |

He does **not** have access to Daniela's full GL audio stream or her internal thought tokens — only the observation data already exposed by `/api/admin/luca/observe`.

---

## What Is NOT in This Scope

- Luca voice / audio channel (future)
- Luca automatically pushing observations into the chat unprompted (future)
- Guardian automation: Luca directly injecting guidance into Daniela without David's relay action (future, larger discussion)
- Any change to the Studio pane or Daniela's session logic

---

## Files Affected

| File | Change |
|---|---|
| `client/src/components/LucaObserverPanel.tsx` | Replaced by `LucaChatPanel.tsx` |
| `client/src/components/LucaChatPanel.tsx` | New file |
| `client/src/pages/chat.tsx` | Import swap: `LucaObserverPanel` → `LucaChatPanel` |
| `server/routes.ts` (or equivalent router) | Add `POST /api/admin/luca/chat` and `GET /api/admin/luca/chat` |
| `server/services/inner-life-capture.ts` | Reuse `composeLucaTurn` — no change expected |
| `server/services/session-observation-store.ts` | Read-only reuse — no change expected |

---

## Success Criteria

1. David can open the Luca panel from the `/chat` page while Daniela's session is active.
2. David types a message, Luca responds with awareness of the current Daniela session state.
3. The exchange is saved to `conversation_memories` with tag `david-luca-chat`.
4. Pressing "→ Daniela" on a Luca message injects it into the active Daniela session.
5. Closing the panel and reopening it restores the recent conversation history.
6. No change to Daniela's session, the Studio pane, or any existing endpoint.
