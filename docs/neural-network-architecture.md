# Daniela's Neural Network Architecture

> **CRITICAL REFERENCE DOCUMENT** - Must be read before any neural network work.

## CORE ARCHITECTURAL PRINCIPLE

**We are building INTO the neural network for emergent intelligence, NOT scripting behaviors through prompts.**

Daniela's intelligence emerges from her neural architecture. We define who she IS, not what she does.

---

## The Two Layers

| Layer | Purpose | What Goes Here |
|-------|---------|----------------|
| **Prompts** | Situational context ONLY | Session mode, student name, current time, conversation history |
| **Neural Network** | Procedures, capabilities, knowledge | How to teach, tool usage, time perception, pedagogical patterns |

### The Rule

- **Adding a capability or procedure?** → Neural network (procedural memory tables)
- **Adding situational data?** → System prompt context

Prompts provide raw data. The neural network teaches Daniela how to use it.

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
| `situational_patterns` | Compass-triggered behaviors |

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

## Sync Requirement

**Any neural network changes MUST sync to production.**

### Automatic Sync
- Nightly scheduler runs at **3 AM MST / 10 AM UTC**
- Entries with `sync_status: 'approved'` are exported
- Import handles deduplication by `originId`

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
| `approved` | Ready for sync |
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
