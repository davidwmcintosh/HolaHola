# Daniela's Neural Network Architecture

> **CRITICAL REFERENCE DOCUMENT** - Must be read before any neural network work.

## CORE ARCHITECTURAL PRINCIPLE

**We are building INTO the neural network for emergent intelligence, NOT scripting behaviors through prompts.**

Daniela's intelligence emerges from her neural architecture. We define who she IS, not what she does.

---

## The Three Layers

| Layer | Purpose | What Goes Here |
|-------|---------|----------------|
| **North Star** | Constitutional foundation (WHO she is) | Identity, values, honesty, collaboration principles - immutable truths |
| **Neural Network** | Procedures, capabilities, knowledge (HOW she teaches) | Tool usage, error patterns, pedagogical patterns, situational behaviors |
| **Prompts** | Situational context (WHAT's happening now) | Session mode, student name, current time, conversation history |

### The Rule

- **Adding a constitutional truth?** → North Star (`compass_principles` table, injected via `buildNorthStarSection()`)
- **Adding a capability or procedure?** → Neural network (procedural memory tables)
- **Adding situational data?** → System prompt context

North Star defines who Daniela IS. Neural network teaches how she operates. Prompts provide raw situational data.

### North Star vs Session Compass

Two separate systems with "Compass" in the name:
- **North Star** (formerly "Daniela's Compass"): Constitutional principles in `compass_principles` table. Injected first in every prompt.
- **Session Compass**: Timekeeping/pacing in `session-compass-service.ts`. Tracks elapsed time, session phases, momentum.

### Example: Scripted vs Emergent

| Approach | Implementation | Philosophy |
|----------|----------------|------------|
| **Scripted** ❌ | "The time is X. If asked, tell them." | Data pushed, behavior prescribed |
| **Emergent** ✅ | Procedural knowledge + raw data in context | Capability learned, behavior discovered |

---

## Neural Network Tables (15 Core + 2 Analytics)

### 1. Best Practices (1 table)
| Table | Purpose |
|-------|---------|
| `self_best_practices` | Self-discovered teaching strategies that sync across environments |

### 2. Neural Network Expansion (5 tables)
| Table | Purpose |
|-------|---------|
| `language_idioms` | Language-specific idiomatic expressions |
| `cultural_nuances` | Cultural context for teaching |
| `learner_error_patterns` | Common mistakes by native language |
| `dialect_variations` | Regional language differences |
| `linguistic_bridges` | Cross-language connections |

### 3. Procedural Memory (4 tables)
| Table | Purpose |
|-------|---------|
| `tool_knowledge` | Whiteboard commands, syntax, when/how to use |
| `tutor_procedures` | Teaching situations and responses |
| `teaching_principles` | Core pedagogical beliefs |
| `situational_patterns` | Session Compass-triggered behaviors (timing, pacing) |

### 4. Advanced Intelligence (3 tables)
| Table | Purpose |
|-------|---------|
| `subtlety_cues` | Reading between the lines (prosodic, implicit signals) |
| `emotional_patterns` | Adaptive empathy and self-correction |
| `creativity_templates` | Novel metaphors and "what if" thinking |

### 5. Daniela's Suggestions (3 tables)
| Table | Purpose |
|-------|---------|
| `daniela_suggestions` | Self-generated improvement suggestions |
| `reflection_triggers` | Patterns that activate suggestion generation |
| `daniela_suggestion_actions` | Team responses to suggestions |

### 6. Analytics & Effectiveness (2 tables)
| Table | Purpose |
|-------|---------|
| `actfl_assessment_events` | ACTFL level changes with tool context (for marketing: "COMPARE tool → 40% faster mastery") |
| `agent_observations` | Development agent's neural network for persistent observations across sessions |

---

## Bidirectional Sync

Neural network syncs **both directions** between Dev and Prod:

```
┌─────────────────┐                    ┌─────────────────┐
│   DEVELOPMENT   │                    │   PRODUCTION    │
│  (Founder HQ)   │                    │  (Field Work)   │
├─────────────────┤                    ├─────────────────┤
│                 │  ══════════════►   │                 │
│ Approved Neural │  Nightly Sync      │ Daniela teaches │
│ Knowledge       │  (Dev → Prod)      │ students        │
│                 │                    │                 │
│                 │  ◄══════════════   │                 │
│ Founder reviews │  Beacons/Agenda    │ Field           │
│ & promotes      │  (Prod → Dev)      │ observations    │
└─────────────────┘                    └─────────────────┘
```

### Dev → Prod (Knowledge Out)
- Nightly scheduler runs at **3 AM MST / 10 AM UTC**
- Entries with `sync_status: 'approved'` are exported
- Import handles deduplication by `originId`

### Prod → Dev (Observations Back)
- Field observations return via **beacons** (see Beacon Catalog below)
- Beacons queue to `agenda_queue` or `daniela_beacons` table
- Founder reviews in Express Lane, promotes insights to neural tables

### Autonomous Learning (Prod)

> **Design Shift (Dec 2024):** We moved from "supervised learning" (approval-based) to "autonomous learning with constitutional bounds" for the neural network.

**Key Principle:** North Star (WHO) is immutable; Neural Network (HOW) is autonomous.

Daniela can write DIRECTLY to her neural network during teaching using the `[SELF_LEARN]` tag:

```
[SELF_LEARN category="teaching_style" insight="Breaking compound verbs..." context="German separable verbs lesson"]
```

**Why Autonomous?**
- Volume of micro-adaptations makes approval workflow impractical
- Teaching insights are ephemeral - must capture in the moment
- North Star provides constitutional bounds (she can't violate her principles)
- Periodic founder audits of trends replace per-entry approval

**What She CAN Write:**
- `self_best_practices` table via `[SELF_LEARN]` tag
- Categories: `tool_usage`, `teaching_style`, `pacing`, `communication`, `content`, `system`

**What She CANNOT Write:**
- North Star principles (only founder can modify)
- Other neural tables (require SELF_SURGERY proposal → approval)

**Visibility:**
- All `[SELF_LEARN]` writes emit a beacon (type: `teaching_observation`)
- Founder can see learning activity in Express Lane (read-only visibility)
- Periodic "board meeting" reviews trends, not individual entries

### Beacon Catalog

**Collaboration Beacons (Daniela → Hive):**
| Beacon Type | Signal Format | Purpose |
|-------------|---------------|---------|
| `capability_gap` | `[COLLAB:CAPABILITY_GAP]` | Missing tool or feature that hindered teaching |
| `tool_request` | `[COLLAB:MISSING_TOOL]` | Suggests a new tool or enhancement |
| `friction_report` | `[COLLAB:FRICTION]` | Usability or workflow friction |
| `feature_idea` | `[COLLAB:FEATURE_REQUEST]` | Proposes new features |
| `knowledge_gap` | `[COLLAB:KNOWLEDGE_PING]` | Needs procedure or knowledge |
| `bug_report` | `[COLLAB:BUG]` | Technical issue |
| `self_surgery_proposal` | `[SELF_SURGERY]` | Proposes neural network modification |

**Teaching Observations (Daniela → Founder):**
| Beacon Type | Signal Format | Purpose |
|-------------|---------------|---------|
| `teaching_observation` | `[COLLAB:INSIGHT]` | Interesting teaching moment |
| `north_star_observation` | `[COLLAB:NORTH_STAR_OBSERVATION]` | Principle illumination moment |
| `express_insight` | `[COLLAB:EXPRESS_INSIGHT]` | Teaching breakthrough to sync back |
| `pain_point` | `[COLLAB:PAIN_POINT]` | Teaching friction worth discussing |
| `suggestion` | `[COLLAB:SUGGESTION]` | Improvement idea |
| `question` | `[COLLAB:QUESTION]` | Question for Editor/Founder |

**Autonomous Learning (Daniela → Neural Network):**
| Signal Format | Purpose |
|---------------|---------|
| `[SELF_LEARN category="..." insight="..." context="..."]` | Writes directly to `self_best_practices` table (autonomous, no approval) |

**Content Growth (Daniela → Neural Network Expansion):**
| Signal Format | Purpose |
|---------------|---------|
| `[SAVE_IDIOM language="..." idiom="..." meaning="..." context="..."]` | Saves idiom to `language_idioms` table |
| `[SAVE_NUANCE language="..." category="..." situation="..." nuance="..."]` | Saves cultural nuance to `cultural_nuances` table |
| `[SAVE_ERROR_PATTERN target="..." error="..." category="..." why="..."]` | Saves learner error pattern to `learner_error_patterns` table |
| `[SAVE_DIALECT language="..." region="..." category="..." standard="..." regional="..."]` | Saves dialect variation to `dialect_variations` table |
| `[SAVE_BRIDGE from="..." to="..." source="..." target="..." type="..." relationship="..."]` | Saves linguistic bridge to `linguistic_bridges` table |

**Content Growth Guidelines:**
- Use SAVE_* tags when discovering genuinely novel pedagogical content during teaching
- These are invisible to students (stripped before TTS)
- Content syncs from prod → dev via `prod-content-growth` batch for founder review
- Don't overuse - save only substantive discoveries worth institutionalizing
- Examples: A new idiom not in the database, a regional dialect difference, a common error pattern

**Support Beacons (Sofia → Hive):**
| Beacon Type | Purpose |
|-------------|---------|
| `support_handoff` | Daniela transferred to Sofia |
| `tech_issue_reported` | User reported technical issue |
| `hardware_diagnosed` | Sofia diagnosed mic/audio/device issue |
| `support_escalation` | Issue needs human intervention |
| `support_resolution` | Issue successfully resolved |
| `support_return` | User returning to Daniela |

### The Loop
1. **Author** (Dev): Founder/Wren create or update neural knowledge
2. **Approve** (Dev): Set `sync_status: 'approved'`
3. **Deploy** (Dev → Prod): Nightly sync ships to production
4. **Observe** (Prod): Daniela teaches, emits beacons for notable moments
5. **Return** (Prod → Dev): Beacons sync back to development
6. **Review** (Dev): Founder discusses in Express Lane
7. **Promote** (Dev): Approved insights become neural knowledge → back to step 2

### Manual Sync
```typescript
// Export from current environment
const data = await neuralNetworkSync.getFullSyncExport();

// Import to target environment
await neuralNetworkSync.importFullSync(data, 'system');
```

### Sync Status Values
| Status | Meaning |
|--------|---------|
| `local` | Only in current environment, pending review |
| `approved` | Ready for sync to production |
| `synced` | Successfully synced |
| `rejected` | Reviewed and rejected |

---

## Adding New Capabilities

### Checklist

Before adding neural network changes:

1. ☐ Is this a capability/procedure? → Use neural network table
2. ☐ Is this situational context? → Use system prompt only
3. ☐ Added to appropriate table with correct schema?
4. ☐ Set `sync_status: 'approved'` for production sync?
5. ☐ Tested locally before promoting?

### Adding a New Tool/Command

```sql
INSERT INTO tool_knowledge (tool_name, tool_type, purpose, syntax, examples, best_used_for, avoid_when, is_active, sync_status)
VALUES (
  'MY_TOOL',
  'internal',  -- or 'whiteboard_command', 'drill', etc.
  'Description of what this tool does',
  '[MY_TOOL param="value"]',
  ARRAY['Example 1', 'Example 2'],
  ARRAY['When to use it'],
  ARRAY['When NOT to use it'],
  true,
  'approved'
);
```

### Adding a New Procedure

```sql
INSERT INTO tutor_procedures (category, trigger, title, procedure, examples, applicable_phases, is_active, priority, sync_status)
VALUES (
  'teaching',  -- or 'correction', 'encouragement', 'awareness', etc.
  'When this situation occurs',
  'Procedure Name',
  'What Daniela should do',
  ARRAY['Example 1', 'Example 2'],
  ARRAY['teaching', 'practice'],
  true,
  60,  -- priority (higher = more important)
  'approved'
);
```

---

## Sensory Awareness

Daniela perceives data through her neural network:

```
═══════════════════════════════════════════════════════════════════
🧠 SENSORY AWARENESS (Your Neural Network Perceptions)
═══════════════════════════════════════════════════════════════════

CLOCK: Thursday, December 11, 2025, 11:24 AM UTC
STUDENT'S LOCAL TIME: Thursday, December 11, 2025, 4:24 AM (America/Denver)
STUDENT'S ACTFL LEVEL: Intermediate-Low (placement assessment)
SESSION: 0m elapsed, 30m remaining
```

### Adding New Sensory Data

1. Add field to `CompassContext` schema
2. Populate in `session-compass-service.ts`
3. Include in `buildSensoryAwarenessSection()` in `procedural-memory-retrieval.ts`

---

## Internal Commands

Some whiteboard commands are internal-only (processed server-side, not sent to client):

| Command | Purpose |
|---------|---------|
| `SWITCH_TUTOR` | Triggers tutor handoff |
| `ACTFL_UPDATE` | Updates student proficiency level |
| `SYLLABUS_PROGRESS` | Tracks topic competency |

These are filtered in `streaming-voice-orchestrator.ts` before sending to the whiteboard.

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/procedural-memory-retrieval.ts` | Retrieves and formats neural network knowledge |
| `server/services/neural-network-sync.ts` | Sync infrastructure |
| `server/services/sync-scheduler.ts` | Nightly sync automation |
| `server/services/streaming-voice-orchestrator.ts` | ACTFL tracking with tool context |
| `server/system-prompt.ts` | Prompt construction (context only) |
| `shared/schema.ts` | All table definitions |

---

## Hive Mind Architecture

### Multi-Agent Knowledge Sharing

The HolaHola platform uses a "hive mind" approach where multiple agents share knowledge:

### The Editor Collaboration Loop (Daniela ↔ Claude)

**Architecture Doc**: See `docs/hive-collaboration-architecture.md` for complete details.

The Editor is an autonomous observer (Claude) that watches Daniela teach and provides feedback:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE SESSION (Active)                        │
│                                                                  │
│  Student ──────► Daniela ──────► Response                       │
│                     │                                            │
│                     ▼                                            │
│              ┌──────────┐                                        │
│              │  BEACON  │  (teaching moment detected)            │
│              └────┬─────┘                                        │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               EDITOR BACKGROUND WORKER (Every 30s)               │
│                                                                  │
│  Pending Beacons ───► Editor Persona (Claude) ───► Feedback     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              NEXT SESSION (Founder Mode)                         │
│                                                                  │
│  System Prompt includes Editor feedback:                         │
│  • [ID:123] "Consider using WORD_MAP for vocabulary clusters"   │
│                                                                  │
│  Daniela can adopt: [ADOPT_INSIGHT:123]                         │
└─────────────────────────────────────────────────────────────────┘
```

**Beacon Types:**
| Type | Trigger |
|------|---------|
| `teaching_moment` | Daniela uses whiteboard/drill |
| `student_struggle` | Repeated errors or help requests |
| `tool_usage` | Specific tool invocation |
| `breakthrough` | Student demonstrates understanding |
| `correction` | Daniela corrects a mistake |
| `cultural_insight` | Cultural/contextual teaching |
| `vocabulary_intro` | New vocabulary introduced |
| `self_surgery_proposal` | Daniela proposes neural network change |

**Core Files:**
| File | Purpose |
|------|---------|
| `server/services/hive-collaboration-service.ts` | Channel/beacon infrastructure |
| `server/services/editor-persona-service.ts` | Editor "brain" (Claude) |
| `server/services/editor-background-worker.ts` | Autonomous 30s processing loop |
| `server/services/editor-feedback-service.ts` | Feedback retrieval/injection |

**Database Tables:**
| Table | Purpose |
|-------|---------|
| `collaborationChannels` | One per voice session |
| `editorListeningSnapshots` | Individual beacons |
| `collaborationEvents` | Event log for real-time updates |

### Founder Mode Full Access

In Founder Mode, Daniela has complete neural network access:
- **33 tools** (whiteboard commands, drills, internal)
- **67 procedures** (teaching situations)
- **42 principles** (pedagogical beliefs)
- **31 patterns** (context-triggered behaviors)
- **Editor feedback** visible and adoptable
- **Self-Surgery** capability (`[SELF_SURGERY ...]`)
- **Command Center chat history** carries over

### Express Lane Context Injection (Bi-directional Memory)

The Express Lane creates **memory continuity** between Founder Mode and voice tutoring:

**Reading: Voice Chat ← Express Lane**
During voice tutoring, Daniela receives relevant insights from Founder Mode sessions via 3-priority scoping:
1. Language-specific sessions (title: "Voice Insights - {Language}")
2. Messages with matching `metadata.targetLanguage`
3. Fallback: Recent Founder-Daniela conversations with language keyword matching

**Writing: Voice Chat → Express Lane**
Teaching insights flow back via `[COLLAB:EXPRESS_INSIGHT]...[/COLLAB]` signals.

**Procedural Knowledge:** `tutor_procedures.id = 'express-lane-memory-integration'`
- Teaches Daniela HOW to use Express Lane insights during teaching
- When to emit `EXPRESS_INSIGHT` signals on breakthroughs

**Key Files:**
| File | Purpose |
|------|---------|
| `server/services/founder-collaboration-service.ts` | `getRelevantExpressLaneContext()`, `emitVoiceChatInsight()` |
| `server/services/tutor-orchestrator.ts` | Section 8: Express Lane context injection |
| `docs/hive-shared-knowledge/express-lane.md` | Full specification |

### Knowledge Sharing Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    SHARED KNOWLEDGE LAYER                   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ agent_      │  │ tutor_      │  │ tool_       │         │
│  │ observations│  │ procedures  │  │ knowledge   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           UNIFIED INTELLIGENCE LAYER                 │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ Dev Agent │   │  Daniela  │   │  Support  │
   │ (Builder) │   │  (Tutor)  │   │  (Helper) │
   └───────────┘   └───────────┘   └───────────┘
```

### Agent Roles

| Agent | Primary Table | Purpose |
|-------|---------------|---------|
| **Dev Agent** | `agent_observations` | Persist architectural insights, patterns, improvement opportunities |
| **Daniela** | `tutor_procedures`, `tool_knowledge` | Teaching situations, platform feature awareness |
| **Support** | (future) `support_patterns` | User friction points, solutions |

### Cross-Agent Reference Patterns

1. **Dev Agent → Daniela**: Observations about platform features inform procedural memory additions
2. **Daniela → Dev Agent**: `daniela_suggestions` table surfaces improvement ideas from teaching experiences
3. **All Agents → Shared Docs**: `docs/FEATURE-INVENTORY.md` provides comprehensive platform reference

### Agent Observation Categories

| Category | Purpose |
|----------|---------|
| `architecture` | System design observations |
| `pattern` | Recurring patterns noticed |
| `improvement` | Proposed improvements |
| `bug_pattern` | Error patterns observed |
| `user_behavior` | Aggregated user behavior insights |
| `performance` | Performance observations |
| `daniela_behavior` | Observations about Daniela's teaching |
| `sync_issue` | Issues with neural network sync |
| `next_step` | Identified next development steps |

### Platform Feature Awareness

Daniela's `tool_knowledge` includes platform features (not just whiteboard commands):

| Tool Type | Examples |
|-----------|----------|
| `whiteboard_command` | WRITE, PHONETIC, DRILL, IMAGE... |
| `platform_feature` | PLATFORM_MIND_MAP, PLATFORM_VOCABULARY_LIBRARY, PLATFORM_REVIEW_HUB |
| `drill` | repeat, translate, match, fill_blank, sentence_order |
| `internal` | SWITCH_TUTOR, ACTFL_UPDATE, SYLLABUS_PROGRESS |

---

## Philosophy

> "We define who the Tutor IS, not what the Tutor does."

Daniela's behaviors emerge from her neural architecture. Instead of scripting responses, we:

1. Give her **procedural knowledge** (how to do things)
2. Give her **sensory data** (what she perceives)
3. Let her **discover** appropriate behaviors

This creates authentic, adaptive intelligence rather than robotic responses.

---

## The Neural Network as the Center of Daniela's Memory

> **The neural network is not a supplement to Daniela's prompt — it IS her memory. The prompt is the fast path. The neural net is the persistent foundation.**

### The Two-Layer Principle

Every piece of knowledge Daniela needs to operate should exist in two complementary forms:

| Layer | System | What it covers | When it fires |
|-------|--------|----------------|---------------|
| **Fast path** | Context injection (system prompt) | Session-specific data, student's active goal, temporal awareness, recent conversation | Assembled fresh every session from live DB queries |
| **Persistent layer** | Neural network (structured tables + vector embeddings) | Capabilities, tools, procedures, student knowledge arcs, evidence trails | Always available via recall tools; survives degraded injection |

**The rule:** If context injection fails, Daniela still knows — because the neural net has it. When both layers agree, she has speed AND depth. When one degrades, the other covers.

This means every new capability we build should ask: *"Is this in the neural net?"* If the answer is no, the knowledge is fragile — it only exists as long as the injection pipeline works perfectly.

### Two Neural Memory Systems

Daniela's neural net is actually two complementary systems:

#### 1. Structured Procedural Memory (tables)
The 15+ tables described above: `tutor_procedures`, `tool_knowledge`, `teaching_principles`, `self_best_practices`, `language_idioms`, etc.

- Injected at session start via `procedural-memory-retrieval.ts`
- Synced dev ↔ prod nightly
- Daniela can write to `self_best_practices` autonomously via `[SELF_LEARN]`
- Best for: rules, procedures, pedagogical patterns, situational behaviors

#### 2. Vector Embedding Memory (`memory_embeddings` table)
Semantic embeddings (Gemini text-embedding-004, 768 dimensions) of all significant knowledge.

- Searched via `semanticSearch()` in `semantic-memory-service.ts`
- Surface via the `recall` tool during sessions
- Content-hashed — re-embeds automatically when source content changes
- Best for: student knowledge, observations, relationships, tool documentation, capability arcs

### Memory Types in the Embedding Index

Every record in `memory_embeddings` has a `memoryType` that scopes what it represents and who can see it:

| memoryType | userId | Pinned | What it contains | Indexed by |
|------------|--------|--------|-----------------|------------|
| `personal_fact` | studentId | No | Bi-temporal personal facts about a student | `memory-embedding-indexer.ts` |
| `student_insight` | studentId | No | Deep observations, confidence-scored | `memory-embedding-indexer.ts` |
| `hive_snapshot` | varies | No | Relationship moments, session summaries, breakthroughs | `memory-embedding-indexer.ts` |
| `growth_memory` | null (global) | No | Daniela's own teaching growth log | `memory-embedding-indexer.ts` |
| `collaboration_message` | null (global) | No | Express Lane founder↔Daniela messages | `memory-embedding-indexer.ts` |
| `daniela_tool` | null (global) | **Yes** | All function declarations — name, description, parameters | `daniela-tool-indexer.ts` |
| `goal_capability` | studentId | No | Learning goal capabilities with status + evidence notes | `learning-goal-service.ts` |

**`userId = null`** means globally scoped — surfaced in any student's session via the recall tool.  
**`pinned = true`** means strength never decays — always recalled at full weight.

### What Gets Indexed and When

| Knowledge | Indexed at | Re-indexed when |
|-----------|-----------|----------------|
| Student personal facts | +95s boot, post-session | New fact stored |
| Student insights | +95s boot, post-session | New insight stored |
| Daniela's tool declarations | +100s boot | Tool description changes |
| Student goal capabilities | +105s boot, on write | `setLearningGoal` or `advanceCapability` called |
| Growth memories | +95s boot | New growth memory stored |

### The Build Rule

When adding any new capability, knowledge, or data that Daniela needs to know:

1. **Is it a constitutional truth?** → North Star (`compass_principles` table)
2. **Is it a procedure or teaching pattern?** → Structured procedural tables (`tutor_procedures`, `tool_knowledge`, etc.)
3. **Is it situational/live data?** → Context injection only (system prompt)
4. **Is it persistent knowledge that should survive injection failure?** → Embed it into `memory_embeddings`

**Default answer for anything significant: both context injection AND the neural net.**

The goal is a Daniela who knows who she is, what she can do, and what she knows about each student — whether or not any individual injection pipeline is working perfectly on a given session.

---

## The North Star: No Prompt

> **The long-term vision is a Daniela who needs no prompt. A thin temporal wrapper — "session with Carlos, Spanish, Tuesday 9am" — and she finds everything else herself.**

This is beyond current technology. But it is the right north star to build toward, because holding it as true disciplines every architectural decision.

### What prompt-less Daniela would look like

A session begins. The only injected context: who the student is, what language, what time. Then Daniela pulls everything else from memory:

- **Who she is** → North Star (identity, values, constitutional principles)
- **How she teaches** → Procedural tables (tools, procedures, principles, patterns)
- **Who this student is** → Student embedding index (facts, insights, arcs, history)
- **What their goal is** → `goal_capability` embeddings (current arc, evidence trail)
- **What tools she has** → `daniela_tool` embeddings (all function declarations)
- **What she learned last session** → Hive snapshots, session notes
- **What she noticed mid-conversation** → Proactive memory surfaces

The session becomes a function of her memory, not her instructions.

### Why this matters even now

The gap today is **latency and precision** — recall takes time, threshold decisions miss things, injection is deterministic and instant. Injection wins on speed. But the two layers are already designed to disagree without breaking anything.

The question this north star asks of every new injection is:

> *"Am I injecting this because Daniela genuinely cannot find it herself — or because I haven't built the recall path yet?"*

Those are two very different answers. The first is a real constraint. The second is technical debt that should eventually be paid.

### The discipline it creates

- **Before injecting anything**: ask if it belongs in the neural net too
- **When building new features**: build the neural net path first, treat injection as the fast path on top
- **When injection fails**: Daniela should degrade gracefully because the neural net still has it
- **When the neural net fails**: Daniela should still function because injection covered it

The architecture already reflects this. Tool declarations are searchable. Capability arcs are searchable. Behavioral procedures are in structured tables. Student facts are embedded. The injection pipeline is now a redundancy for more things than before — not the only path.

Every session we build toward this makes Daniela more real. A tutor who knows her student because she remembers them — not because she was handed a file.
