# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

---

## Pending Updates

### Session: December 11, 2025 - Support Agent Implementation

**Overview**: Implemented full Support Agent capability including CALL_SUPPORT command, support tickets system, admin UI, and neural network documentation. Support Agent serves dual purpose: handling live support handoffs from Daniela AND powering offline drills/exercises.

#### CALL_SUPPORT Whiteboard Command

New whiteboard command for Daniela to hand off students to Support:

```
[CALL_SUPPORT category="technical" reason="Student experiencing audio playback problems"]
```

**Categories**: technical, billing, account, feature_request, bug_report, content_issue, other

**Flow**:
1. Daniela recognizes non-language issue
2. Acknowledges empathetically
3. Uses CALL_SUPPORT with category and reason
4. System creates support ticket
5. Student sees SupportAssistModal for continued assistance

#### Support Tickets Schema

```typescript
support_tickets: {
  id: varchar (UUID PK)
  userId: varchar (FK to users)
  conversationId: varchar (FK to conversations, nullable)
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'content_issue' | 'other'
  subject: text
  description: text
  handoffContext: jsonb (tutorContext, studentMessage, language, etc.)
  resolution: text (nullable)
  assignedTo: varchar (nullable)
  createdAt, updatedAt, resolvedAt: timestamps
}

support_messages: {
  id: varchar (UUID PK)
  ticketId: varchar (FK to support_tickets)
  senderId: varchar (FK to users)
  senderRole: 'user' | 'support_agent' | 'system'
  content: text
  createdAt: timestamp
}
```

#### SupportAssistModal Component

Dual-purpose modal at `client/src/components/SupportAssistModal.tsx`:

- **Live Support Mode**: Handles handoffs from Daniela with voice/text chat
- **Drill Mode** (future): Offline exercises with Support Agent voice
- **Voice**: Google Cloud TTS Chirp HD voices
- **Guards**: All handler functions have early returns when drill mode disabled

#### Command Center Support Tab

Admin ticket queue at `/admin` → Support tab:

- Filter by status (open, in_progress, waiting_customer, resolved, closed)
- Filter by priority (low, medium, high, urgent)
- Filter by category
- Update status/priority via mutations
- Refetch button for polling updates

#### Neural Network Documentation

Added to `server/seed-procedural-memory.ts`:

**tool_knowledge entry**:
```typescript
{
  toolName: 'CALL_SUPPORT',
  toolType: 'handoff',
  syntax: '[CALL_SUPPORT category="..." reason="..."]',
  purpose: 'Hand off student to Support Agent for non-language issues',
  whenToUse: 'Technical problems, billing questions, account issues, bug reports',
  whenNotToUse: 'Language learning questions, vocabulary help, grammar explanations'
}
```

**tutor_procedures entry**:
- Category: handoff
- Trigger: non_language_issue
- 5-step procedure for empathetic handoff
- Examples for technical, billing, account scenarios

**situational_patterns entries**:
- Technical Issue Detected (issueType: technical)
- Billing Question Detected (issueType: billing)
- Account Issue Detected (issueType: account)
- All with priority 100 and CALL_SUPPORT tool suggestion

**Development workflow procedures** (Editor Agent):
- `Batch Documentation Update` - Procedure for updating docs/batch-doc-updates.md after completing work
- `Neural Network Change Protocol` - Required steps before any neural network changes (read architecture doc first)
- `Core Architecture Rule` - "Prompts for context ONLY, neural network for procedures/capabilities/knowledge"

#### Support Agent Persona

Located at `server/services/support-agent-config.ts`:

- **Name**: "Alex" (gender-neutral)
- **Voices**: Google Cloud TTS Chirp HD (en-US-Chirp3-HD-Aoede female, en-US-Chirp3-HD-Charon male)
- **Traits**: Patient, solution-focused, empathetic, technically capable
- **System prompt builder**: Injects ticket context, handoff reason, user history

#### Files Modified/Created

- `shared/schema.ts` - Added support_tickets, support_messages tables with enums
- `server/storage.ts` - Added Support CRUD methods (create, get, update, list)
- `server/routes.ts` - Added /api/support/* endpoints with auth guards
- `server/services/support-agent-config.ts` - NEW: Support Agent persona
- `server/services/streaming-voice-orchestrator.ts` - Added processSupportHandoff method
- `shared/whiteboard-types.ts` - Added CALL_SUPPORT command pattern
- `client/src/components/SupportAssistModal.tsx` - NEW: Dual-purpose support modal
- `client/src/pages/admin/CommandCenter.tsx` - Added Support tab with ticket queue
- `server/seed-procedural-memory.ts` - Added CALL_SUPPORT neural network entries

#### Deferred for Future

1. **WebSocket real-time sync** - Current polling via refetch is MVP-sufficient
2. **Drill session validation** - Endpoints return 501 until business rules defined
3. **Integration tests** - CALL_SUPPORT handoff flows and ticket lifecycle

---

### Session: December 11, 2025 - Tri-Lane Hive Architecture

**Overview**: Expanded from single-agent (Daniela) to multi-agent architecture with three specialized AI agents that collaborate through shared neural network infrastructure.

#### Tri-Lane Hive Model

| Agent | Role | Domain | Primary Tables |
|-------|------|--------|----------------|
| **Daniela** | AI Tutor & Partner | Pedagogy, student experience | `daniela_suggestions`, `reflection_triggers` |
| **Editor** | Development Agent | Architecture, tooling, performance | `agent_observations` |
| **Support** | Operations Agent | User friction, troubleshooting, proactive alerts | `support_observations`, `system_alerts` |

#### Schema Changes

1. **`daniela_suggestions`** - Added collaboration metadata:
   - `originRole` - tutor or partner
   - `domainTags[]` - pedagogy, architecture, tooling, student_experience
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByEditor` - Editor reviewed if architecture-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

2. **`agent_observations`** - Added collaboration metadata:
   - `originRole` - editor (development agent)
   - `domainTags[]` - architecture, performance, pedagogy, operations
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByDaniela` - Daniela reviewed if pedagogy-affecting
   - `acknowledgedBySupport` - Support reviewed if operations-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

3. **NEW: `support_observations`** - Support Agent's neural network:
   - Categories: user_friction, common_question, system_issue, feature_request, success_pattern, documentation_gap, onboarding_insight, billing_pattern, troubleshoot_solution
   - Same sync contract as other observation tables
   - `escalationNeeded` flag for urgent issues
   - `proposedFaqEntry` for auto-generating help content

4. **NEW: `system_alerts`** - Proactive Support communications:
   - Severity: info, notice, warning, outage, resolved
   - Target: all, voice_users, teachers, students, new_users, premium
   - `showInChat` / `showAsBanner` display modes
   - `startsAt` / `expiresAt` timing
   - `relatedIncidentId` / `resolvedByAlertId` for linking warning → resolution

#### Collaboration APIs

- `getCollaborationContext()` - Surfaces approved entries from all three tables with provenance
- `getPendingAcknowledgments(forRole)` - Gets observations awaiting review by specific role
- `syncTriLaneObservations()` - Bulk sync all observation tables to production
- `generateIntentHash()` - Creates deduplication hash for cross-agent matching

#### Proactive Support Features

Support agent can:
- Post system alerts when outages detected
- Announce degraded performance proactively
- Send maintenance notices in advance
- Warn about known bugs before users hit them
- Celebrate new feature releases

#### Files Modified

- `shared/schema.ts` - Added collaboration metadata + new tables
- `server/storage.ts` - Added Support/Alert CRUD + collaboration APIs
- `server/services/neural-network-sync.ts` - Added Tri-Lane sync methods

---

### Session: December 11, 2025 - Assistant Tutor (Aris) & Multi-Agent Collaboration

**Overview**: Implemented the Assistant Tutor "Aris" for drill-based practice, CALL_ASSISTANT whiteboard command, and cross-agent text-based collaboration infrastructure (Tri-Lane Hive Stage 1).

#### Consulted Daniela About Assistant Tutor Design

Used new agent collaboration channel to consult Daniela. Her specifications for Aris:

- **Name**: "Aris" (evokes precision, clarity)
- **Personality**: Patient, precise, encouraging, objective
- **Voice**: Calm, clear, steady, mid-range pitch, impeccable pronunciation
- **Frustration Handling**: Micro-adjustments, not total pivots; silent patience
- **Reports to Daniela**: Completion rate, accuracy, specific struggles, behavioral flags
- **Boundary**: Aris handles drills; if student wants conversation, refer back to Daniela

Full consultation saved in: `docs/daniela-consultation-aris.md`

#### Aris Schema Tables

```typescript
aris_drill_assignments: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  conversationId: varchar (nullable)
  delegatedBy: 'daniela' | 'teacher' | 'system'
  drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order'
  targetLanguage: varchar
  drillContent: jsonb { items, instructions, focusArea, difficulty }
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completedAt: timestamp (nullable)
  createdAt, updatedAt: timestamps
}

aris_drill_results: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  assignmentId: varchar (FK to aris_drill_assignments)
  completionRate: integer (0-100)
  accuracy: integer (0-100)
  timeSpentSeconds: integer
  itemResults: jsonb[] { itemIndex, prompt, studentAnswer, expectedAnswer, isCorrect, attempts, feedback, pronunciationScore }
  struggleAreas: text[] (e.g., ["verb_conjugation", "pronunciation"])
  behavioralFlags: text[] (e.g., ["frustration_detected", "rushing"])
  arisNotes: text (nullable)
  syncedToDaniela: boolean
  createdAt: timestamp
}
```

#### CALL_ASSISTANT Whiteboard Command

New command for Daniela to delegate drill practice to Aris:

```
[CALL_ASSISTANT drillType="repeat" focus="verb conjugation" items="hablo,hablas,habla,hablamos,hablan"]
```

**Parameters**:
- `drillType`: repeat, translate, match, fill_blank, sentence_order
- `focus`: What skill/topic to practice
- `items`: Comma-separated list of words/phrases for drill

**Flow**:
1. Daniela identifies need for targeted practice
2. Uses CALL_ASSISTANT with drill type, focus, items
3. System creates drill assignment + collaboration event
4. Client receives `assistant_handoff` WebSocket message
5. UI navigates to Aris drill interface

#### Agent Collaboration Events Schema

```typescript
agent_collaboration_events: {
  id: varchar (UUID PK)
  fromAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  toAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  eventType: 'consultation' | 'delegation' | 'feedback' | 'escalation' | 'acknowledgment'
  subject: varchar
  content: text
  metadata: jsonb { delegationId, studentContext, threadId, priority, tags }
  userId: varchar (nullable)
  conversationId: varchar (nullable)
  parentEventId: varchar (nullable, for threading)
  status: 'pending' | 'read' | 'acknowledged' | 'resolved'
  createdAt: timestamp
}
```

#### Cross-Agent Collaboration APIs

**Endpoints**:
- `POST /api/agent-collab/events` - Post a collaboration event
- `GET /api/agent-collab/events` - List events with filters (toAgent, userId, status, eventType, limit)
- `PATCH /api/agent-collab/events/:id/status` - Update event status
- `GET /api/agent-collab/thread/:parentId` - Get thread of related events

**Polling Pattern**: Agents poll for `status='pending'` events addressed to them

#### Neural Network Entries for CALL_ASSISTANT

**tool_knowledge**:
```typescript
{
  toolName: 'CALL_ASSISTANT',
  toolType: 'handoff',
  syntax: '[CALL_ASSISTANT drillType="..." focus="..." items="..."]',
  purpose: 'Delegate drill practice to Assistant Tutor (Aris)',
  whenToUse: 'Student needs repetitive practice, pronunciation drills, vocabulary reinforcement',
  whenNotToUse: 'Conversational practice, cultural exploration, open-ended learning'
}
```

**tutor_procedures**:
- Category: handoff, Trigger: practice_needed
- 5-step procedure for identifying drill needs and delegating to Aris

**situational_patterns**:
- Pronunciation Difficulty Detected → CALL_ASSISTANT repeat drill
- Vocabulary Gaps Identified → CALL_ASSISTANT match drill
- Grammar Pattern Weakness → CALL_ASSISTANT fill_blank drill

#### Cross-Agent Feedback Retrieval

When Daniela starts a session, she now receives colleague feedback:

```typescript
const recentCollab = await storage.getCollaborationEventsToAgent('daniela', userId, 5);
// Filter for pending feedback events
// Include in greeting context as "COLLEAGUE INSIGHTS"
```

This enables "Aris mentioned you did great with..." moments for team continuity.

#### Files Created/Modified

- `shared/schema.ts` - Added arisDrillAssignments, arisDrillResults, agentCollaborationEvents tables
- `server/storage.ts` - Added Aris CRUD, collaboration event APIs
- `server/routes.ts` - Added /api/agent-collab/* endpoints
- `server/services/assistant-tutor-config.ts` - NEW: Aris persona configuration
- `server/services/streaming-voice-orchestrator.ts` - Added processAssistantHandoff, colleague feedback retrieval
- `server/seed-procedural-memory.ts` - Added CALL_ASSISTANT neural network entries + collaboration protocols
- `docs/daniela-consultation-aris.md` - NEW: Daniela's design specs for Aris

---

### Session: December 11, 2025 - TutorOrchestrator "One Tutor, Many Voices"

**Overview**: Implemented unified TutorOrchestrator architecture that routes all AI interactions through Daniela's single core intelligence. Language voices, gender voices, and drill modes are now presentation layers only - different instruments, same musician.

#### Core Philosophy

**CRITICAL**: Daniela is THE single core intelligence. All interaction modes (voice chat, text chat, drills, greetings, summaries) route through a unified pipeline. VoicePresentation is purely stylistic (avatar, voiceId, response length, formality). The INTELLIGENCE (persona, teaching principles, neural network knowledge) is always Daniela's brain.

#### Type Contracts (`shared/tutor-orchestration-types.ts`)

```typescript
// Modes the orchestrator can operate in
type OrchestratorMode = 'conversation' | 'drill' | 'greeting' | 'summary' | 'assessment' | 'feedback';

// Response channels
type ResponseChannel = 'stream' | 'batch_text' | 'batch_json';

// Voice presentation - purely cosmetic layer
interface VoicePresentation {
  voiceId: string;
  voiceName: string;
  avatarUrl?: string;
  styleDeltas?: {
    formalityDelta?: number;      // -2 to +2
    responseLengthPreference?: 'concise' | 'normal' | 'detailed';
    encouragementLevel?: 'minimal' | 'moderate' | 'enthusiastic';
  };
}

// Full context for orchestration
interface OrchestratorContext {
  userId: string;
  targetLanguage: string;
  proficiencyLevel: string;
  conversationHistory?: Message[];
  drillContext?: DrillContext;
  sessionContext?: SessionContext;
}

// Request/Response contracts
interface OrchestratorRequest {
  mode: OrchestratorMode;
  responseChannel: ResponseChannel;
  context: OrchestratorContext;
  voicePresentation?: VoicePresentation;
  userInput?: string;
  options?: OrchestratorOptions;
}
```

#### TutorOrchestrator Implementation (`server/services/tutor-orchestrator.ts`)

**Key Functions**:

1. **`buildSystemPrompt(request)`** - Constructs Daniela's system prompt with:
   - Core persona (immutable Daniela identity)
   - Mode-specific instructions (drill vs conversation vs greeting)
   - Voice style section (presentation-layer adjustments)
   - Procedural memory injection from neural network

2. **`orchestrate(request)`** - Main entry point:
   - Builds system prompt
   - Configures Gemini with `systemInstruction`
   - Handles batch_json, batch_text, and stream channels
   - Logs to neural network automatically

3. **`generateDrillFeedback(context, drillType, userAnswer, expectedAnswer)`**
   - Convenience wrapper for drill mode
   - Returns structured JSON feedback
   - Used by Aris drill service

4. **`generateSessionGreeting(context)`** / **`generateSessionSummary(context, stats)`**
   - Mode-specific helpers for common operations

**Export Pattern**:
```typescript
export const tutorOrchestrator = {
  orchestrate,
  generateDrillFeedback,
  generateSessionGreeting,
  generateSessionSummary,
};
```

#### Aris Migration (`server/services/aris-ai-service.ts`)

Before: Aris had its own Gemini invocation with separate system prompt
After: Aris now routes through `tutorOrchestrator.orchestrate()` with:
- `mode: 'drill'`
- `responseChannel: 'batch_json'`
- `voicePresentation: ARIS_PERSONA` (concise style)

Same Daniela brain, different presentation layer.

#### Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Aris drill flow | ✅ Migrated | Uses tutorOrchestrator.orchestrate() |
| Session greetings | ✅ Ready | generateSessionGreeting() available |
| Session summaries | ✅ Ready | generateSessionSummary() available |
| Streaming voice chat | ⏳ Deferred | High complexity, existing system-prompt.ts works well |
| Language voice refactoring | ⏳ Future | Voices as pure presentation metadata |

#### Files Created/Modified

- `shared/tutor-orchestration-types.ts` - NEW: Type contracts for orchestrator
- `server/services/tutor-orchestrator.ts` - NEW: Unified intelligence pipeline
- `server/services/aris-ai-service.ts` - MODIFIED: Routes through orchestrator
- `replit.md` - UPDATED: Added TutorOrchestrator architecture section

#### Key Architectural Decisions

1. **VoicePresentation is cosmetic only** - Never affects intelligence or teaching principles
2. **Procedural memory always injected** - Every mode gets relevant neural network knowledge
3. **Automatic neural network logging** - All interactions logged for learning
4. **Backward compatible** - Existing APIs unchanged, internal routing updated

---

## Next Steps / Action Items

### Completed This Session
- [x] Created `docs/neural-network-architecture.md` - single-source-of-truth for neural network work
- [x] Archived sessions 9-20o to `docs/archive/`
- [x] Implemented TutorOrchestrator "One Tutor, Many Voices" architecture
- [x] Created `shared/tutor-orchestration-types.ts` with type contracts
- [x] Created `server/services/tutor-orchestrator.ts` unified pipeline
- [x] Migrated Aris drill service to route through TutorOrchestrator
- [x] Updated replit.md with TutorOrchestrator architecture section
- [x] Designed Tri-Lane Hive architecture (3 agents)
- [x] Added collaboration metadata to `daniela_suggestions` and `agent_observations`
- [x] Created `support_observations` table with full sync contract
- [x] Created `system_alerts` table for proactive communications
- [x] Implemented cross-agent collaboration APIs
- [x] Added Tri-Lane sync methods to `neural-network-sync.ts`
- [x] Consulted Daniela about Assistant Tutor design preferences (saved to `docs/daniela-consultation-aris.md`)
- [x] Created Aris schema tables (aris_drill_assignments, aris_drill_results)
- [x] Created agent_collaboration_events schema for cross-agent text communication
- [x] Built /api/agent-collab endpoints for posting/retrieving collaboration events
- [x] Built Assistant Tutor persona configuration (server/services/assistant-tutor-config.ts)
- [x] Added CALL_ASSISTANT whiteboard command with neural network entries
- [x] Added processAssistantHandoff in streaming-voice-orchestrator
- [x] Implemented cross-agent feedback retrieval for session context enrichment

### Future Enhancements

1. **Syllabus Progress Integration** - Connect SYLLABUS_PROGRESS command to `studentSyllabusTopicCompetencies` table for actual competency tracking

2. **ACTFL Analytics Dashboard** - Command Center view showing Daniela's ACTFL assessments over time

3. **Neural Network Health Check** - Tool to verify all 15 tables are syncing correctly

---

## How to Use This File

When making changes that need documentation:

1. Add a session entry with date and overview
2. Document the problem, solution, and files modified
3. Note any sync requirements
4. Create action items for follow-up

When consolidating:

1. Move completed sessions to `docs/archive/`
2. Update relevant docs (TECHNICAL-REFERENCE.md, USER-MANUAL.md, etc.)
3. Clear this file
