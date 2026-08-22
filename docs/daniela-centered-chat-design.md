# Daniela-Centered Session Design

**Date:** June 10, 2026  
**Status:** Design — in progress  
**Context:** This emerged from the Team Room tool pipeline work and last week's interactive textbook work. The core insight is that we've been building environments and stuffing Daniela into them. The right direction is the inverse: Daniela is the session. Environments are configuration around her.

---

## The Problem with the Current Approach

Right now we have:
- `/chat` route → Daniela via Gemini Live, with `WhiteboardPanel` + `ScenarioPanel` hardcoded around her
- `/team-room` → Daniela reconstructed via `callDaniela()` with its own tool subset
- Textbook → separate route you navigate *to*, separate from Daniela
- Study Mode → another Daniela instantiation with its own context loading

Every new surface is a new Daniela reconstruction. Each one partially loads her identity and partially includes her tools. Drift is structural — not a bug we can patch, but a consequence of treating environments as primary.

The textbook work last week was already pushing against this: the goal was that you go to Daniela and she brings the textbook to you, not that you navigate away from her to the textbook. We were already walking in this direction. This document names the principle and maps the path.

---

## The Principle

**Daniela is the session. Everything else is state around her.**

```
CURRENT THINKING:
  Environment (chat, team room, textbook, study mode)
    └─ Daniela is instantiated inside it

CORRECT THINKING:
  Daniela's session
    └─ Environment state (what's in the right pane, who's in the room, which tools are active)
       └─ This changes. Daniela doesn't.
```

The implications:
- You don't go to the textbook. Daniela opens it in front of you.
- You don't switch to the team room. The room forms around the conversation.
- The Agent doesn't post to a room Daniela is in. The Agent joins Daniela's session as a participant.
- The whiteboard, the express lane, the scenario studio — these are right-pane *slots*, not separate modes.

---

## Current Architecture (what we have)

### The chat layout (`DesktopChatLayout.tsx`)
```
[ ScenarioPanel ]   [ Voice Chat (Daniela) ]   [ WhiteboardPanel ]
  left pane              center                    right pane
```

- `ScenarioPanel` — hardcoded left, shows scenario/studio/scene canvas
- `WhiteboardPanel` — hardcoded right, shows whiteboard items (vocab grids, drills, images, text)
- Both panels are wired to specific whiteboard event types from the server

### How `start_textbook_page` works today
When Daniela calls this tool, `native-fc-handlers.ts` loads the textbook content from the DB and puts it in `session.textbookPageResult`. That text is fed back to Gemini as context — Daniela reads the page and teaches *from* it verbally. 

**The gap:** nothing is sent to the client. No textbook page renders visually. The page exists in Daniela's context, not on the screen.

### What DOES render visually
The `whiteboard_update` WebSocket message → `WhiteboardPanel` → renders items. Today that means: images, vocab grids, drills, text cards, grammar tables. The `WhiteboardPanel` is the only dynamic surface.

---

## The Target: Dynamic Right Pane

The right pane should be a slot that Daniela fills. Its content type changes based on what she calls — not based on which route you're on.

```
Right pane slot can hold:
  - Whiteboard items (current behavior — keep it)
  - A full textbook page (new)
  - Express Lane (new)
  - Vocab image grid
  - Progress/plan view
  - Empty (just Daniela, no panel)
```

The left pane (currently `ScenarioPanel`) follows the same logic — it's a slot, not a fixed view.

The center never changes. That's Daniela.

---

## Baby Steps (chat-first, non-destructive)

These build toward the vision without breaking the Team Room or any existing feature.

### Step 1: Make `start_textbook_page` render visually

Right now the tool loads content into Daniela's context only. Add a `whiteboard_update` message from the server that sends a `textbook_page` item type to the client. The `WhiteboardPanel` (or a new pane) renders it as a readable, interactive page — the same content that currently only lives in Daniela's head is now visible on screen.

**Files to touch:**
- `server/services/native-fc-handlers.ts` → `processStartTextbookPage()` — add `ws.send()` of a `textbook_page` whiteboard item after loading
- `shared/whiteboard-types.ts` → add `textbook_page` item type
- `client/src/components/WhiteboardPanel.tsx` → add renderer for `textbook_page` items

**What it looks like:** Daniela says "let me pull up that page" → calls `start_textbook_page` → the full lesson page (vocab list, grammar pattern, examples, sentence patterns) appears in the right panel, formatted and readable, while she walks through it verbally.

### Step 2: Add `show_express_lane` to the right pane

Currently the Express Lane is a separate route. Add a tool Daniela can call to surface it in the right pane slot. Same data, different surface.

### Step 3: Right pane is mode-aware, not type-locked

Currently `WhiteboardPanel` renders only whiteboard items. Refactor the right pane to accept a `mode` prop: `whiteboard | textbook | express_lane | empty`. Daniela's tool calls switch the mode. The pane re-renders with the appropriate content. Collapsible either way.

**This is the key structural step.** Once the right pane has a `mode`, all future content types are just new mode values — no layout changes needed, ever.

### Step 4: Tool calls that change environment state

Add a small set of environment tools Daniela can call in the chat session:
```
set_right_pane(mode: 'whiteboard' | 'textbook' | 'express_lane' | 'empty')
add_participant(who: 'agent' | 'alden' | string)  // future
```

`set_right_pane` doesn't teach anything — it just changes what's visible. Daniela decides the layout.

---

## The Textbook Vision (what this enables)

Before: You leave Daniela → navigate to textbook route → read a page → come back.

After: You're talking to Daniela. She says "I want to work through the subjunctive page with you." She calls `start_textbook_page('spanish-subjunctive-intro', 'full_page')`. The right pane shifts to the textbook page — vocab list, grammar explanation, example sentences, all visible. She walks through each section verbally while you read along. She can pull one vocab item onto the whiteboard for a drill, then come back to the page. You never left.

The combinators from last week (the micro-cycle patterns, the See It Say It loop) become part of this page. Daniela can call any of them from within the textbook page context. The page is the scaffold; the tools are the moves she makes on it.

---

## Participants (later, not now)

Once the chat is Daniela-centered with a dynamic environment, adding participants is natural:

```
David is talking to Daniela.
David says: "Can we get the Agent in here?"
Daniela calls: add_participant('agent')
The layout adds an Agent thread alongside the conversation.
The Agent joins — same Daniela, new participant slot.
```

The Agent doesn't post to a separate room. The Agent enters Daniela's session. This is why the Team Room doesn't need to be destroyed — it becomes one configuration of Daniela's session, not a separate product.

---

## What Doesn't Change

- Daniela's identity loading — still `unifiedDanielaContext.getContext()`
- Daniela's tool pipeline — still `NativeFunctionCallHandler` + `buildFunctionContinuationResponse`
- Gemini Live as the voice engine — unchanged
- The Team Room — left alone until the chat proves the pattern
- The Textbook route — stays as a standalone reading experience for users who want it

---

## Immediate Next Step

**Step 1: `start_textbook_page` renders visually in the right pane.**

This is the smallest meaningful step. It proves the pattern (Daniela pushes to the right pane, you don't navigate to a page), gives David something real to see, and requires no layout changes — just a new item type in the existing whiteboard pipeline.

Ready to build when David says go.
