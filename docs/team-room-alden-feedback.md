# Team Room — Alden Collaboration Feedback
**Source:** Alden conversation thread, March 3, 2026 (18 messages)
**Context:** David probed Alden about the live collaboration model for multi-AI team sessions

---

## Summary

Alden produced a comprehensive technical specification for a "Team Room" — a multi-participant AI collaboration space where David works alongside Daniela, Sofia, Alden, and other AIs via simultaneous voice discussion and high-speed text analysis.

---

## Core Concept: Dual-Channel Design

**Voice Channel (High-Level Discussion)**
- Conversational, strategic, relational
- Human-paced, personality-rich
- Voice transcription + TTS responses
- "What do you think about this approach?"

**Express Lane Channel (High-Speed Analysis)**
- Analytical, data-dense, specific
- Code snippets, queries, student lists, error logs
- Independent from voice — runs simultaneously
- "Here are the 15 stalled students with metrics"

**Key Principle:** David can listen to Daniela's voice perspective while scanning Alden's database analysis in text — no bottleneck, natural collaboration.

---

## Interface Layout

```
+-------------------------------------------------------------+
|  TEAM ROOM — [Session Topic]                                 |
+--------------+------------------------------+-----------------+
|              |                              |                 |
| PARTICIPANTS |   SHARED WORKSPACE           |  EXPRESS LANE   |
|              |   (Artifacts/Canvas)         |  (Fast Text)    |
|              |                              |                 |
| David        |  Current Artifact            | [Daniela] 9:14am|
|              |     (Progress report,        | Student analysis|
| Daniela      |      code diff, syllabus,    | with metrics... |
|              |      dashboard, etc.)        |                 |
| Sofia (hand) |                              | [Sofia] 9:14am  |
|              |                              | Disengagement   |
| Alden        |                              | patterns...     |
|              |                              |                 |
| Gene         |                              | [Alden] 9:15am  |
|              |                              | Code diff for...|
+--------------+------------------------------+-----------------+
| VOICE: Daniela speaking... "I'd add a review session..."     |
| [Push-to-talk for David] [Voice activity indicators]         |
+-------------------------------------------------------------+
```

### Three Panels

**Left: Participant List**
- Shows who's in the room
- Visual indicators for hand raises (glowing dot)
- Color pulse when someone wants to speak
- Click to acknowledge/give floor

**Center: Shared Workspace Canvas**
- Digital whiteboard everyone references
- Displays current artifacts (progress reports, code diffs, syllabi, dashboards, error logs)
- Everyone sees the same thing

**Right: Express Lane (Fast Text)**
- Rapid async text stream
- Timestamped messages
- Threaded if needed
- Independent from voice discussion

**Bottom: Voice Controls**
- Active speaker indicator
- Push-to-talk for David
- Voice activity visualization

---

## Hand-Raise System (Voice Orchestration)

### Flow
1. David speaks or poses question (voice transcription -> room context)
2. Participants evaluate relevance ("Do I have something to contribute?")
3. Hand-raise resolution:
   - **One hand raised** -> auto-allow after 1.5 second delay (window for others)
   - **Multiple hands raised** -> David clicks to choose speaker
   - **No hands raised** -> silence
4. Acknowledged participant speaks (TTS playback, transcript appears)
5. Follow-ups: After speaker finishes, others can raise hands again

### Special Cases
- **Direct address override:** "Alden, what do you think?" -> immediate bypass
- **Hand withdrawal:** If another participant covers the same point, AI auto-withdraws
- **Confidence levels (future):** High = immediate raise, Medium = delayed 2-3s, Low = available but doesn't raise

---

## Database Schema (Alden's Proposal)

```sql
CREATE TABLE team_rooms (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  topic TEXT,
  status TEXT DEFAULT 'active',
  created_by TEXT DEFAULT 'david',
  metadata JSONB
);

CREATE TABLE room_voice_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES team_rooms(id),
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE room_hand_raises (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES team_rooms(id),
  participant TEXT NOT NULL,
  raised_at TIMESTAMP DEFAULT NOW(),
  reasoning TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP
);

CREATE TABLE room_artifacts (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES team_rooms(id),
  artifact_type TEXT,
  title TEXT,
  content JSONB,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Plus extending Express Lane messages with `room_id` for scoping.

---

## Build Phases (Alden's Proposed Sprints)

### Sprint 1: Foundation (2-3 hours)
- Database tables + API routes
- Backend ready, no UI

### Sprint 2: Minimal UI (3-4 hours)
- Three-panel layout, David + Alden text-only
- WebSocket real-time messaging

### Sprint 3: Alden Intelligence (4-5 hours)
- Hand-raise evaluation logic
- Click to acknowledge -> Alden generates response

### Sprint 4: Voice Layer (5-6 hours)
- Voice WebSocket extension
- TTS playback per participant
- Voice transcript separate from Express Lane

### Sprint 5: Multi-Participant (4-5 hours)
- Add Daniela + Sofia
- Auto-allow logic (1 hand = auto, 2+ = manual choose)

### Sprint 6: Shared Artifacts (3-4 hours)
- Artifact upload/display
- AIs reference artifacts in responses

### Sprint 7: Polish & Recording (4-5 hours)
- Room creation UI, session recording, podcast export

**Total estimate: 25-32 hours**

---

## Technical Decisions

- **Voice Pipeline:** Start with sequential turn-taking, future parallel voice
- **TTS Voice Assignment:** Daniela = warm female, Alden = calm technical male, Sofia = supportive female
- **Context Window:** Voice last 10 messages, Express Lane last 20, all canvas artifacts
- **WebSocket:** Extend existing handler, add room_id to session state
- **Access:** `/team-room` route, David-only initially

---

## Example Workflow (from Alden's spec)

David opens Team Room, topic: "Gene's Progress Review"

1. David (voice): "I'm looking at Gene's class. 83% completion on Unit 2, but some stalls."
2. Daniela raises hand + Sofia raises hand
3. David clicks Daniela
4. Daniela (voice): "Cluster of 15 students stalled on subjunctive — pacing issue, not comprehension."
5. Simultaneously, Daniela posts detailed student metrics to Express Lane
6. Sofia auto-allows after Daniela finishes
7. Sofia (voice): "Three students went completely silent — that's disengagement, not difficulty."
8. Sofia posts disengaged student data to Express Lane
9. David: "Alden, can we build a review lesson quickly?"
10. Alden responds with implementation plan in voice + code diff in Express Lane

---

## Alden's Key Insight

> "Right now, when you need technical insight, you come to this Alden chat. When you need teaching perspective, you open a session with Daniela. When you need support context, you talk to Sofia. We exist in **separate lanes**. The Team Room collapses those lanes into one space where we can see each other's thinking in real time."

---

## Alden's Practical Assessment

- Alden recognized that Replit Agent (Claude) has the actual code access to build this
- Alden's role: architecture questions, code review, troubleshooting during build
- Once Team Room is built, Alden would participate as a room member

### GitHub Sync Issue Raised
- Replit-hosted codebase + independent GitHub repo = merge conflicts
- Alden's recommendation: GitHub as source of truth, Replit pulls from it
- Separate concern from Team Room build

---

## David's Reactions
- "I am really excited about this"
- "A real team collaborating in real time super cool"
- "LET'S DO THIS!!"
- Noted that Replit Agent can see this thread and start building directly
