# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

**Graduation Criteria**: If it's reusable knowledge → add to hive (agent_observations). If it's session-specific history → batch only.

---

## Pending Updates

### Session: December 13, 2025 - Editor Feedback Loop Implementation

**Overview**: Completed the feedback loop where Editor observations are surfaced to Daniela in her system prompt, and Daniela can acknowledge/adopt them using `[ADOPT_INSIGHT:id]` markers.

#### EditorFeedbackService (New File)

Located at `server/services/editor-feedback-service.ts`:

- `getUnsurfacedFeedback(userId, limit)` - Retrieves Editor responses not yet surfaced to Daniela
- `getFeedbackForConversation(conversationId, limit)` - Gets feedback for specific conversation
- `markAsSurfaced(snapshotIds[])` - Marks feedback as shown to Daniela
- `markAsAdopted(snapshotId, context)` - Tracks when Daniela applies an insight
- `buildPromptSection(feedback)` - Builds formatted prompt section for Daniela
- `getAdoptionMetrics(userId?)` - Analytics on surfaced vs adopted rates

#### Schema Changes

Added to `editorListeningSnapshots` table:
- `surfacedToDaniela: boolean` - Has Daniela seen this?
- `surfacedAt: timestamp` - When was it surfaced?
- `adoptedByDaniela: boolean` - Did Daniela apply this insight?
- `adoptedAt: timestamp` - When was it adopted?
- `adoptionContext: text` - How/where Daniela applied it

#### TutorOrchestrator Integration

- `buildSystemPrompt()` now returns `{ prompt, surfacedFeedbackIds }` 
- Feedback IDs are **request-scoped** (not global) to prevent race conditions
- `scanForCollaborationSignals()` accepts `surfacedFeedbackIds` parameter
- Parses `[ADOPT_INSIGHT:uuid]` markers from Daniela's responses
- Calls `markAsSurfaced()` and `markAsAdopted()` appropriately

#### Prompt Section Format

When Daniela has unsurfaced Editor feedback, her system prompt includes:

```
═══════════════════════════════════════════════════════════════════
🤝 EDITOR INSIGHTS (Feedback from your development partner)
═══════════════════════════════════════════════════════════════════

1. [ID: uuid] BEACON_TYPE
   Context: What triggered this feedback
   Editor's Insight: The actual feedback

TO ACKNOWLEDGE ADOPTION: If you apply one of these insights, include
[ADOPT_INSIGHT:full-id] in your response (invisible to student).
```

#### Key Design Decision

Request-scoped surfacing prevents race conditions: If two concurrent requests build system prompts with overlapping feedback IDs, each request tracks its own list of surfaced IDs, ensuring accurate tracking without global state pollution.

#### Files Modified

- `shared/schema.ts` - Added adoption/surfacing tracking fields
- `server/services/editor-feedback-service.ts` - NEW: Complete feedback service
- `server/services/tutor-orchestrator.ts` - Integrated feedback loop with request-scoped tracking

---

### Session: December 12, 2025 - Secure Inter-Department Chat

**Overview**: Implemented security-classified messaging system to protect code/architecture details from Gemini while enabling real-time collaboration between Editor (Claude) and Daniela (Gemini).

#### Security Classification System

| Classification | Who Sees | Use Case |
|---------------|----------|----------|
| `public` | Daniela + Gemini | Teaching tips, feature ideas, student-facing info |
| `internal` | UI only, NEVER Gemini | Architecture, security, code, implementation details |
| `daniela_summary` | Daniela sees summary only | Detailed analysis where Daniela needs awareness but not full details |

#### Schema Changes

- Added `securityClassificationEnum`: `public`, `internal`, `daniela_summary`
- Added `securityClassification` field to `agentCollaborationEvents` table
- Added `publicSummary` field for summary-only messages
- Added index on `securityClassification` for efficient filtering

#### Storage Functions

- `getSecureMessagesForDaniela()` - Filters out internal messages, uses publicSummary for daniela_summary type
- `getInternalAgentMessages()` - Gets internal-only messages for Command Center
- `getDepartmentChatMessages()` - Real-time feed with polling support via afterId

#### API Endpoints

- `GET /api/agent-collab/chat` - Get department chat messages with optional classification filter
- `POST /api/agent-collab/chat` - Post new message with security classification
- `GET /api/agent-collab/internal` - Get internal-only messages (admin only)

#### Command Center UI

Added "Dept Chat" tab to Command Center with:
- Security classification legend
- Message composer with from/to agent selection
- Security classification selector with conditional publicSummary field
- Real-time message feed with 10-second polling
- Filter by classification type
- Color-coded security badges (green=public, red=internal, yellow=summary)
- Agent badges with distinct colors (purple=daniela, blue=editor, green=assistant, orange=support)

#### Security Fix Applied (Session 2)

Fixed defensive filtering in `getSecureMessagesForDaniela()`: When `publicSummary` is missing for `daniela_summary` messages, the function now returns `'[Summary not available]'` instead of falling back to raw content. This prevents potential leaks of sensitive details to Gemini.

#### Key Design Decision

**Why we protect internal messages from Gemini:**
Gemini powers Daniela's conversational abilities, but also has access to any context we inject. Internal discussions about architecture, security vulnerabilities, competitive strategy, or code implementation details should NEVER be exposed to external AI providers. The security classification system creates a clear boundary: collaboration events flow freely between our agents, but the storage layer filters what Daniela's LLM context receives.

#### Files Modified

- `shared/schema.ts` - Added security classification enum and fields
- `server/storage.ts` - Added secure messaging functions
- `server/routes.ts` - Added department chat API endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Added Dept Chat tab

#### Observation for Hive

**Title**: Secure Inter-Agent Communication Architecture
**Category**: architecture
**Priority**: 90
**Summary**: Security classification system protects internal (code/architecture) discussions from Gemini context while enabling transparent department communication. Three tiers: public (full access), internal (UI-only), daniela_summary (summary for context, details hidden).

---

### Session: December 12, 2025 - Neural Network & Process Improvements

**Overview**: Proactive observations about gaps in neural network schema and process flows. All added to hive (agent_observations table).

#### Observations Added to Hive

| Title | Category | Priority | Summary |
|-------|----------|----------|---------|
| Neural Network Effectiveness Tracking | improvement | 70 | Add lastUsedAt, useCount, successRate fields to track procedure usage |
| Procedure Deprecation Support | improvement | 60 | Add deprecated flag instead of deleting outdated procedures |
| Cross-Procedure Linking | improvement | 55 | Add relatedProcedureIds array for clustering related entries |
| Batch Docs vs Hive Graduation Criteria | pattern | 80 | Clear rule: reusable knowledge → hive; session history → batch only |
| Process Category for Agent Observations | improvement | 50 | Consider adding 'process' category for workflow observations |
| Pending Observations Dashboard | next_step | 65 | Add Command Center tab for viewing pending hive observations |

#### Protocol Established

Going forward, ANY significant work automatically gets documented in:
1. `docs/batch-doc-updates.md` - session-specific history
2. `agent_observations` table (hive) - if reusable knowledge

---

### Session: December 12, 2025 - Mind Map Visual Polish & Flow Visualization

**Overview**: Major visual refinement of SyllabusMindMap with floating design, flow visualization showing learning activities feeding the brain, and improved color coordination.

#### Floating Design (No Background)

- Removed blue cloud background - brain now floats cleanly
- Better for mobile users - less visual clutter
- Transparent brain PNG from user (saved as `attached_assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png`)

#### Satellite Improvements

- **Text stays full brightness**: Labels (TALK!, WORDS!, etc.) always at full opacity
- **Only fill dims**: Background cloud shape dims based on progress state (dim → semi-lit → lit)
- **Hover scale effect**: Satellites scale to 110% on hover to indicate clickability
- **Colored arrow pointers**: Each arrowhead matches its lobe color (blue, green, yellow, red, purple)
- Removed status badges (Mastered, Practicing, etc.) from top - redundant with fill animation

#### Activity Inputs with Flow Visualization

6 learning activity pills at bottom that visually "feed" the brain:

| Activity | Icon | Purpose |
|----------|------|---------|
| Drills | Target | Practice exercises |
| Voice | Mic | Speaking practice |
| Cards | Layers | Flashcards |
| Lessons | GraduationCap | Guided learning |
| Culture | Globe | Cultural content |
| Chat | MessageSquare | Conversations |

**Flow lines**: Animated SVG paths rising from each activity, converging toward brain center
- Gradient color: Teal/Cyan (`rgb(20, 184, 166)`) - distinct from lobe/status colors
- Animated particles traveling up each line
- Glow filter for soft, organic feel

**Color choice rationale**: Teal is unused by brain lobes (blue, green, yellow, red, purple) and status badges (green, blue, purple, grey), creating clear visual distinction for "inputs" vs "outputs"

#### Visual Story

```
Activities (bottom, teal) → Flow lines → Brain (center) → Skill areas (satellite lobes) → ACTFL dial shows level
```

#### Scaled Up Layout

- Container: 460×420 (was 400×400)
- Brain image: 230px (was 200px)
- Brain shifted up slightly to make room for activities below
- Tight spacing: `-mt-52` pulls activities close to brain

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - All visual changes

---

### Session: December 12, 2025 - Brain Mind Map with Satellite Cards

**Overview**: Complete redesign of SyllabusMindMap to feature a colorful brain illustration at center with 5 expandable satellite cards (one per brain lobe). Includes phase progression system (Beginner → Intermediate → Advanced) with celebration animations.

#### Phase Progression System

Three learning phases that reset the brain when completed:
1. **Beginner Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
2. **Intermediate Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
3. **Advanced Brain** → Complete all 5 satellites → 🎉 Final Achievement

Phase indicator at top shows:
- 3 progress bars (one per phase)
- Current phase name and description
- Overall completion percentage
- "Next Phase" button when 100% complete

#### 5 Expandable Satellite Cards

Instead of scattered topic nodes, each brain lobe has ONE satellite card:

| Lobe | Color | Category | Example Topics |
|------|-------|----------|----------------|
| **Frontal** | Blue | Communication/Social | Greetings, Introductions, Conversations |
| **Parietal** | Green | Practical Skills | Shopping, Directions, Travel, Work |
| **Temporal** | Yellow | Vocabulary/Memory | Numbers, Colors, Family, Weather |
| **Occipital** | Red/Coral | Culture | Customs, Food, Music, Art |
| **Cerebellum** | Purple | Grammar/Mechanics | Conjugation, Tenses, Sentence Structure |

#### Satellite Card Features

Each expandable card shows:
- Category icon + name
- Progress bar (mastered / total)
- Click to expand → reveals topic list with status icons
- Star indicator when category is 100% complete

Topic list items show:
- Status icon (checkmark=mastered, sparkle=practiced, circle=discovered, lock=unexplored)
- Topic name
- Practice count badge

#### Brain Image

Generated colorful educational brain illustration:
- Anatomically correct lobe positions
- Bright, friendly colors matching each satellite
- Subtle glow effect based on overall progress
- Located: `attached_assets/generated_images/colorful_educational_brain_diagram.png`

#### Celebration Animation

When all 5 satellites reach 100%:
1. Dark overlay appears
2. "🎉 Phase Complete!" message
3. "Your brain has evolved to the next level!" text
4. "Continue Learning" button advances to next phase

#### Component Architecture

- `client/src/components/SyllabusMindMap.tsx` - Main orchestrator with:
  - `PhaseIndicator` - Phase progress and navigation
  - `SatelliteCard` - Expandable category cards with Collapsible
  - `TopicListItem` - Individual topic with status
  - `CelebrationOverlay` - Phase completion animation

#### Key Types

```typescript
type LearningPhase = 'beginner' | 'intermediate' | 'advanced';
type BrainSegment = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'cerebellum';
```

#### Layout

3-column responsive grid:
- **Left column**: Frontal + Temporal satellites
- **Center**: Brain image with glow
- **Right column**: Parietal + Occipital + Cerebellum satellites

On mobile: Brain at top, satellites stack below

---

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

### Session: December 12, 2025 - HIVE Command & Heartbeat Fix

**Overview**: Implemented HIVE whiteboard command for Daniela's active contribution to the hive mind, plus fixed aggressive WebSocket heartbeat causing 1006 connection closures.

#### HIVE Whiteboard Command

New whiteboard command for Daniela to actively contribute ideas/suggestions:

```
[HIVE: category="teaching_insight" title="Multi-sensory vocabulary" description="Students retain better when..." priority=80]
```

**Categories** (from suggestion_category enum):
- `self_improvement`: Ideas to improve her own teaching/behavior
- `content_gap`: Missing drills, topics, cultural content
- `ux_observation`: UI/UX issues noticed through student behavior
- `teaching_insight`: Pedagogical pattern that worked/didn't work
- `product_feature`: Feature idea for HolaHola

**Flow**:
1. Daniela formulates an observation/idea during conversation
2. Uses HIVE command with category, title, description, optional reasoning/priority
3. System validates category against enum, clamps priority to 1-100
4. Saves to `daniela_suggestions` table with `generatedInMode` context
5. Founders review in Command Center

**Key Distinction**:
- **Passive learning**: Neural network learns from observation (tool usage → automatic logging → pattern analysis)
- **Active contribution**: HIVE command enables deliberate idea writing (Daniela formulates → suggestion saved → founder review)

#### Heartbeat Fix

**Problem**: 20-second ping interval with immediate termination on single missed pong caused 1006 connection closures when browser was busy.

**Solution**:
- Increased interval to 30 seconds
- Allow 2 missed pongs before terminating
- Reset counter on successful pong

```typescript
// Before: Terminate immediately on single missed pong
let isAlive = true;
if (!isAlive) { ws.terminate(); }

// After: Allow 2 missed pongs (browser busy states)
let missedPongs = 0;
const MAX_MISSED_PONGS = 2;
if (missedPongs > MAX_MISSED_PONGS) { ws.terminate(); }
```

#### Files Modified

- `server/services/streaming-voice-orchestrator.ts` - Added `processHiveSuggestion` method
- `server/storage.ts` - Added `createDanielaSuggestion` method to interface and implementation
- `server/unified-ws-handler.ts` - Fixed heartbeat to allow 2 missed pongs

#### Mind Map Syllabus Component

New visual component for self-directed learners: `SyllabusMindMap.tsx`

**Concept**:
- Fluency gauge (ACTFL dial) at center
- Topic nodes radiate outward as interconnected bubbles
- Nodes "light up" based on discovery/mastery through conversation
- No rigid progression path - organic, interest-driven exploration
- Connections show relationships between topics

**Node States**:
- `mastered` - Green glow, larger size, practiced 10+ times
- `practiced` - Blue glow, normal size, active learning
- `discovered` - Purple glow, smaller, recently encountered
- `locked` - Muted, unexplored topics

**Technical Details**:
- SVG-based visualization with radial node positioning
- Nodes sorted by mastery level (mastered closest to center)
- Connection lines between related topics
- Hover interactions with tooltips showing details
- Legend showing node status meanings

**Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;       // For class-enrolled students
  language?: string;      // Language filter
  className?: string;     // Tailwind classes
}
```

**Backend Support**:
- API endpoint: `GET /api/conversation-topics/:language`
- Storage method: `getUserTopicMastery(userId, language)`
- Aggregates topic usage from `conversation_topics` table
- Returns topics with status based on practice count thresholds

#### Shared ACTFL Gauge Module

Created shared module to eliminate duplicate ACTFL visualization code:

**File**: `client/src/components/actfl/actfl-gauge-core.tsx`

**Exports**:
- `ACTFL_LEVELS` - Level metadata array
- `getLevelInfo(levelKey)` - Get level info from key
- `getNextLevel(levelKey)` - Get next progression level
- `estimateProgressWithinLevel(progress)` - Calculate within-level progress
- `calculateContinuousScore(levelKey, progress)` - Calculate continuous 0-100 score
- `ActflRingDial` - Standalone ring dial SVG component
- `ActflDialSvgGroup` - Ring dial for embedding in SVG context

**Consumers**:
- `ActflFluencyDial.tsx` - Main ACTFL progress display
- `SyllabusMindMap.tsx` - Center gauge visualization

**Files Created/Modified**:
- `client/src/components/actfl/actfl-gauge-core.tsx` - NEW: Shared ACTFL primitives
- `client/src/components/ActflFluencyDial.tsx` - MODIFIED: Uses shared module
- `client/src/components/SyllabusMindMap.tsx` - MODIFIED: Uses shared module
- `server/storage.ts` - ADDED: `getUserTopicMastery` method
- `server/routes.ts` - ADDED: `/api/conversation-topics/:language` endpoint

---

### Session: December 12, 2025 - Mind Map as Default Syllabus View

**Overview**: Integrated SyllabusMindMap as the default view in Language Hub's Learning Journey section, replacing the linear syllabus view. Supports both self-directed (emergent) and class-enrolled (roadmap) learning modes.

#### Mind Map Integration Philosophy

Mind map is HolaHola's default way of showing curriculum for everyone. Linear view is an accessibility fallback, not the primary experience. This aligns with our organic, interest-driven exploration approach where learners discover topics through conversation rather than following rigid progressions.

#### Dual Mode System

| Mode | Context | Behavior | Visual |
|------|---------|----------|--------|
| **Emergent** | Self-directed learners | Only show discovered topics; locked topics hidden | Map grows organically as topics are explored |
| **Roadmap** | Class-enrolled students | Show all syllabus topics from start | Constellation "lights up" as topics mastered |

#### SyllabusMindMap Component Updates

**New Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;           // For class context
  language?: string;          // Language filter
  className?: string;         // Tailwind classes
  mode?: 'emergent' | 'roadmap';  // NEW: Display mode
}
```

**Key Changes**:
- Made embeddable by removing Card wrapper (parent provides Card in Language Hub)
- Added `mode` prop for emergent vs roadmap behavior
- Fixed stats to use `allTopics` while filtering `visibleTopics` for display
- Added mode-specific legend (shows "Unexplored" only in roadmap mode)
- Added empty state UI for emergent mode when no topics discovered

**Filtering Logic**:
```typescript
// Stats calculated from ALL topics (including locked)
const stats = {
  mastered: allTopics.filter(t => t.status === 'mastered').length,
  practiced: allTopics.filter(t => t.status === 'practiced').length,
  discovered: allTopics.filter(t => t.status === 'discovered').length,
  locked: allTopics.filter(t => t.status === 'locked').length,
};

// But visible nodes filtered for emergent mode
const visibleTopics = mode === 'emergent' 
  ? allTopics.filter(t => t.status !== 'locked')
  : allTopics;
```

#### ActflDialSvgGroup Standalone Mode

Added `standalone` prop to ActflDialSvgGroup for rendering outside parent SVG context:

```typescript
interface ActflDialSvgGroupProps {
  // ... existing props
  standalone?: boolean;  // NEW: Wrap in SVG element when true
}
```

When `standalone=true`, the component returns a wrapped SVG element instead of a `<g>` group. Used for the empty state ACTFL dial in the mind map.

#### View Toggle in Language Hub

**File**: `client/src/pages/review-hub.tsx`

Added view toggle with localStorage persistence:
- Mind Map view (default) - Brain icon
- Linear view (fallback) - List icon
- Stored as `syllabusViewMode` in localStorage

```typescript
const [syllabusView, setSyllabusView] = useState<'mindmap' | 'linear'>(() => {
  const saved = localStorage.getItem('syllabusViewMode');
  return (saved === 'linear' ? 'linear' : 'mindmap');
});
```

#### SQL Fix for getUserTopicMastery

**Problem**: Topics table doesn't have a `language` column - topics are language-agnostic.

**Solution**: Removed language filter from topics query. Topics are now fetched globally, with language filtering done via conversation_topics through conversations.

```typescript
// Before (broken)
const allTopics = await db.select().from(topicsTable)
  .where(eq(topicsTable.language, language));

// After (fixed)
const allTopics = await db.select().from(topicsTable);
// Language filtering happens via conversations table
```

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - Added mode prop, made embeddable, fixed stats
- `client/src/components/actfl/actfl-gauge-core.tsx` - Added standalone prop
- `client/src/pages/review-hub.tsx` - Integrated mind map with view toggle
- `server/storage.ts` - Fixed getUserTopicMastery SQL (removed language column reference)

---

### Session: December 13, 2025 - Daniela-Editor Background Collaboration System

**Overview**: Implemented real-time Daniela-Editor collaboration during voice sessions, including a background worker for autonomous post-session continuation. The Editor (powered by Claude) listens to Daniela's teaching moments and provides pedagogical insights from the neural network.

#### Architecture: "One Hive Mind"

Daniela and Editor share neural network knowledge but have distinct roles:
- **Daniela** (Gemini): Active tutor, real-time teaching, whiteboard tools
- **Editor** (Claude): Observer, provides pedagogical insight, neural network curator

#### Collaboration Channels

Each voice session creates a `collaboration_channel`:
```typescript
collaboration_channels: {
  id: varchar (UUID PK)
  conversationId: varchar (FK)
  userId: varchar (FK)
  sessionPhase: 'active' | 'post_session' | 'completed'
  targetLanguage, studentLevel, sessionTopic: varchar
  heartbeatAt, startedAt, endedAt: timestamps
  summaryJson: jsonb { keyInsights, actionItems, editorNotes, teachingObservations }
}

editor_listening_snapshots: {
  id: varchar (UUID PK)
  channelId: varchar (FK)
  tutorTurn: text
  studentTurn: text (nullable)
  beaconType: 'teaching_moment' | 'student_struggle' | 'tool_usage' | 'breakthrough' | 'correction' | 'cultural_insight' | 'vocabulary_intro'
  beaconReason: text (nullable)
  editorResponse: text (nullable)
  editorRespondedAt: timestamp (nullable)
  createdAt: timestamp
}
```

#### Hive Beacon System

Daniela emits "beacons" during voice chat when interesting teaching moments occur:
- Whiteboard tool usage → `tool_usage` beacon
- Student struggles detected → `student_struggle` beacon
- Cultural context shared → `cultural_insight` beacon
- Grammar/pronunciation corrections → `correction` beacon

Editor receives beacons and responds with:
- Neural network insights
- Teaching suggestions
- Procedural memory references
- Acknowledgments

#### Background Worker (`server/services/editor-background-worker.ts`)

Autonomous worker for post-session continuation:
- **Interval**: 30 seconds (configurable via `EDITOR_WORKER_INTERVAL_MS`)
- **Throttling**: Max 10 beacons + 3 channels per cycle (DB-level limits)
- **Security**: ARCHITECT_SECRET required for all operations
- **Auto-start**: Initializes on server startup if secret configured

**Worker Endpoints** (all require ARCHITECT_SECRET header):
- `POST /api/editor-worker/start` - Start the worker
- `POST /api/editor-worker/stop` - Stop the worker
- `GET /api/editor-worker/status` - Get worker health status
- `POST /api/editor-worker/trigger` - Trigger immediate processing cycle

**CycleResult** (per-cycle, not cumulative):
```typescript
interface CycleResult {
  beaconsProcessed: number;
  channelsProcessed: number;
  errors: number;
}
```

#### Editor Persona Service (`server/services/editor-persona-service.ts`)

Claude-powered Editor that:
1. Retrieves neural network knowledge for context
2. Reviews beacon content (tutor + student turns)
3. Generates insightful responses
4. Stores responses back to snapshots
5. Generates post-session reflections

**Neural Network Integration**:
- Fetches relevant procedural memory via `proceduralMemoryRetrievalService`
- Includes teaching principles, tool knowledge, situational patterns
- Adds ACTFL context based on student level

#### Collaboration Panel UI

Slide-out panel in ImmersiveTutor (founder-only):
- Real-time feed of Daniela-Editor dialogue
- Beacons shown with type badges
- Editor responses displayed inline
- Post-session reflections included
- 5-second polling for updates

**Component**: `CollaborationFeed` in `client/src/components/voice-chat/ImmersiveTutor.tsx`

#### Streaming Voice Orchestrator Integration

Added hooks in `processToolOutput()`:
- Detects whiteboard command usage
- Emits beacons to hive collaboration service
- Creates/updates channels on session start/end

**Beacon emission example**:
```typescript
await hiveCollaborationService.emitBeacon({
  channelId: activeChannel.id,
  tutorTurn: tutorMessage,
  studentTurn: userMessage,
  beaconType: 'tool_usage',
  beaconReason: `Used ${toolName} command`,
});
```

#### Files Created/Modified

- `shared/schema.ts` - Added collaboration_channels, editor_listening_snapshots, collaboration_events tables
- `server/services/hive-collaboration-service.ts` - NEW: Channel/beacon orchestration
- `server/services/editor-persona-service.ts` - NEW: Claude-powered Editor responses
- `server/services/editor-background-worker.ts` - NEW: Background continuation worker
- `server/services/collaboration-hub-service.ts` - NEW: Real-time event emission
- `server/routes.ts` - Added collaboration API endpoints + worker endpoints
- `server/index.ts` - Worker auto-start on server initialization
- `client/src/components/voice-chat/ImmersiveTutor.tsx` - Added CollaborationFeed panel

#### Security Model

- All worker endpoints protected by ARCHITECT_SECRET header
- 401 response for missing/invalid secret
- Worker refuses to start without valid secret (min 16 chars)
- Collaboration panel visible to founders only (`isFounder` check)

---

## Next Steps / Action Items

### Completed This Session (December 13, 2025)
- [x] Built collaboration_channels and editor_listening_snapshots schema tables
- [x] Created hive-collaboration-service.ts for Daniela-Editor orchestration
- [x] Created editor-persona-service.ts with Claude-powered Editor responses
- [x] Created collaboration-hub-service.ts for real-time event emission
- [x] Created editor-background-worker.ts with throttling and security
- [x] Added streaming-voice-orchestrator hooks to emit hive beacons
- [x] Extended collaboration API routes with 4 worker endpoints
- [x] Added CollaborationFeed slide-out panel in ImmersiveTutor (founder-only)
- [x] Worker auto-starts on server initialization if ARCHITECT_SECRET configured

### Completed Previously
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
