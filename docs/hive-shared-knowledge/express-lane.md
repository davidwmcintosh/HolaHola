# EXPRESS Lane - Editor ↔ Daniela Direct Collaboration

> **INTERNAL DOCUMENT** - Technical specification for the EXPRESS lane system.

---

## Overview

The EXPRESS lane enables direct communication between the Editor (Claude) and Daniela through a REST API. This creates a "two surgeons" collaboration where both can contribute to persistent Founder Mode conversations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS LANE FLOW                         │
└─────────────────────────────────────────────────────────────┘

Editor (Claude) calls /api/express-lane/collaborate
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
```

---

## API Endpoints

### POST /api/express-lane/collaborate

Send a message to Daniela and receive her response with full neural network context.

**Authentication:** `x-editor-secret` header (uses ARCHITECT_SECRET)

**Request Body:**
```json
{
  "message": "Your question or topic for Daniela",
  "sessionId": "optional - use specific session ID",
  "requestDanielaResponse": true  // default: true
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "9e8e1a94-b51f-4eca-b318-ec7ce4e8e7da",
  "editorMessage": {
    "id": "message-id",
    "content": "Your message",
    "cursor": "1765736172716-000051"
  },
  "danielaResponse": {
    "id": "response-id",
    "content": "Daniela's full response...",
    "cursor": "1765736180145-000061"
  },
  "sessionUrl": "/admin?tab=founder-mode&session=..."
}
```

### GET /api/express-lane/context

Get the current collaboration session context.

**Authentication:** `x-editor-secret` header

**Query Parameters:**
- `sessionId` (optional) - Specific session to retrieve

**Response:**
```json
{
  "hasActiveSession": true,
  "session": {
    "id": "session-id",
    "status": "active",
    "messageCount": 10,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "recentMessages": [
    {
      "role": "editor",
      "content": "truncated preview...",
      "cursor": "..."
    }
  ]
}
```

---

## Usage Example

```bash
curl -X POST http://localhost:5000/api/express-lane/collaborate \
  -H "Content-Type: application/json" \
  -H "x-editor-secret: $ARCHITECT_SECRET" \
  -d '{"message": "Daniela, what teaching tools do you wish you had?"}'
```

---

## Daniela's Context in EXPRESS Lane

When Daniela responds via EXPRESS lane, she has access to:

1. **Neural Network Context**
   - Procedural memory (tool knowledge, teaching principles)
   - Pedagogical insights from past sessions
   - Current sprint context and active development focus

2. **Conversation History**
   - Full history of the current Founder session
   - Editor's previous messages and her responses

3. **Special Founder Mode Instructions**
   - Understands this is internal collaboration, not student teaching
   - Can discuss capabilities, limitations, and tool requests openly
   - Uses [COLLAB:...] markers for feature requests/pain points

---

## Key Implementation Details

- **System Founder ID:** Uses `admin-test-user` (valid DB user for foreign key)
- **Model:** gemini-2.5-flash via Replit AI Integrations
- **Max Tokens:** 2000 for rich responses
- **Neural Network Logging:** Disabled for internal collaboration

---

## When to Use

| Use Case | EXPRESS Lane? |
|----------|--------------|
| Ask Daniela about her teaching experience | ✅ Yes |
| Discuss Hive collaboration design | ✅ Yes |
| Get feedback on tool implementations | ✅ Yes |
| Debug student-facing issues | ✅ Yes |
| Test voice streaming | ❌ No - use voice endpoints |
| Student interactions | ❌ No - use normal chat endpoints |

---

*Last updated: December 14, 2025*
