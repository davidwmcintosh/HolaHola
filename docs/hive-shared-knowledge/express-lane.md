# EXPRESS Lane - Founder ↔ Daniela Collaboration

> **INTERNAL DOCUMENT** - Technical specification for the EXPRESS lane system.

---

## Overview

The EXPRESS Lane enables direct collaboration between the Founder and Daniela through the Command Center UI. Wren (the development agent in Replit) can read these sessions via database access to stay informed and build solutions based on the discussions.

**The Hive Team:**
- **Founder** - Coordinates development, provides business context
- **Daniela** - AI tutor with pedagogical expertise, emits capability gaps
- **Wren** - Development agent with real code access, builds solutions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS LANE FLOW                         │
└─────────────────────────────────────────────────────────────┘

Founder sends message via Command Center UI
                    ↓
        Message stored in founderSessions table
                    ↓
        tutorOrchestrator generates Daniela's response WITH:
          - Full neural network (procedures, tools, principles)
          - Conversation history from session
          - Founder Mode context
          - Sprint context for current work
                    ↓
        Response stored in collaborationMessages table
                    ↓
        Persistent - survives restarts, syncs to production
                    ↓
        Wren reads sessions via database for context
```

---

## API Endpoints

### UI Endpoints (for Command Center)

These power the Express Lane chat interface:

- `GET /api/express-lane/ui/session` - Get current session
- `POST /api/express-lane/ui/sessions` - Create new session
- `GET /api/express-lane/ui/sessions` - List all sessions
- `POST /api/express-lane/ui/collaborate` - Send message, get Daniela response
- `GET /api/express-lane/ui/search` - Search across sessions

### Legacy Editor Endpoint

The original `/api/express-lane/collaborate` endpoint (with `x-editor-secret` auth) still exists for backward compatibility but is no longer the primary interface.

---

## Daniela's Context in EXPRESS Lane

When Daniela responds via EXPRESS lane, she has access to:

1. **Neural Network Context**
   - Procedural memory (tool knowledge, teaching principles)
   - Pedagogical insights from past sessions
   - Current sprint context and active development focus

2. **Conversation History**
   - Full history of the current Founder session
   - Previous messages and her responses

3. **Special Founder Mode Instructions**
   - Understands this is internal collaboration, not student teaching
   - Can discuss capabilities, limitations, and tool requests openly
   - Uses [COLLAB:...] markers for feature requests/pain points

---

## Wren's Access

Wren (the Replit development agent) stays informed about Express Lane discussions:

**Database Access:**
```sql
-- Read recent Founder-Daniela discussions
SELECT * FROM "founderSessions" 
WHERE status = 'active' 
ORDER BY "updatedAt" DESC;

-- Get messages from a session
SELECT * FROM "collaborationMessages" 
WHERE "sessionId" = 'session-id' 
ORDER BY "createdAt";

-- Find capability gaps Daniela has identified
SELECT * FROM "collaborationBeacons" 
WHERE "beaconType" = 'capability_gap' 
ORDER BY "createdAt" DESC;
```

**Wren's Role:**
- Reads sessions to understand context before building
- Can implement solutions Daniela identifies as needed
- Provides grounded technical feedback with real code context
- Unlike Editor, Wren can actually see and modify the codebase

---

## When to Use

| Use Case | Who's Involved |
|----------|----------------|
| Discuss teaching strategies | Founder + Daniela |
| Identify capability gaps | Founder + Daniela |
| Build solutions | Founder + Wren |
| Full 3-way collaboration | Founder discusses in Express Lane, shares with Wren |

---

## Express Lane Context Injection (Bi-directional Sync)

The Express Lane supports **bi-directional memory continuity** between Founder Mode and voice tutoring.

### Reading: Voice Chat ← Express Lane

When Daniela teaches students in voice chat, she can access relevant discussions from Express Lane via `getRelevantExpressLaneContext()` in `founder-collaboration-service.ts`.

**3-Priority Scoping Strategy:**
1. **Language-specific sessions first** - Sessions titled "Voice Insights - {Language}" (e.g., "Voice Insights - Spanish")
2. **Metadata-tagged messages** - Messages with `metadata.targetLanguage` from `voice_chat_sync` source
3. **Keyword fallback** - Recent Founder-Daniela conversations with language keyword matching

### Writing: Voice Chat → Express Lane

Teaching insights flow back to Express Lane through:
1. **EXPRESS_INSIGHT collaboration signal** - Daniela embeds `[COLLAB:EXPRESS_INSIGHT]...[/COLLAB]` in responses
2. **emitVoiceChatInsight()** - Syncs the insight to language-specific "Voice Insights - {Language}" sessions
3. **Discoverable sessions** - Session titles enable the read path to find insights later

### Integration Points

| Component | Function |
|-----------|----------|
| `founder-collaboration-service.ts` | `getRelevantExpressLaneContext()`, `emitVoiceChatInsight()`, `findOrCreateSessionByTitle()` |
| `tutor-orchestrator.ts` | Section 8: Express Lane context injection in `buildSystemPrompt()` |
| Collaboration signals | `EXPRESS_INSIGHT` signal type handling |

---

## Example Collaboration Flow

```
1. Founder opens Express Lane in Command Center

2. Founder: "Daniela, students struggle with subjunctive mood..."
   
3. Daniela: "I've noticed that too. The 'emotion trigger' 
   approach might work better..."
   [COLLAB:CAPABILITY_GAP]Need better subjunctive 
   visualization tool[/COLLAB]

4. Founder shares context with Wren (or Wren reads session)

5. Wren: "I can build a GRAMMAR_TABLE whiteboard command
   for subjunctive triggers. Here's the implementation..."

6. Wren builds the feature

7. Daniela tests in voice tutoring, reports effectiveness
   via EXPRESS_INSIGHT

8. Next Founder Mode:
   "That subjunctive visualization worked great!"
```

---

## Why Wren Replaced Editor

Editor was an in-app AI persona that:
- Proposed theoretical solutions
- Lacked real code context
- Couldn't actually build anything

Wren is a Replit development agent that:
- Has filesystem access to all code
- Understands what's actually implemented
- Can build solutions immediately
- Provides grounded technical feedback

This makes the collaboration more effective - discussions lead directly to implementations.

---

*Last updated: December 15, 2025*
