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

## Next Steps / Action Items

### Completed This Session
- [x] Created `docs/neural-network-architecture.md` - single-source-of-truth for neural network work
- [x] Archived sessions 9-20o to `docs/archive/`
- [x] Designed Tri-Lane Hive architecture (3 agents)
- [x] Added collaboration metadata to `daniela_suggestions` and `agent_observations`
- [x] Created `support_observations` table with full sync contract
- [x] Created `system_alerts` table for proactive communications
- [x] Implemented cross-agent collaboration APIs
- [x] Added Tri-Lane sync methods to `neural-network-sync.ts`

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
