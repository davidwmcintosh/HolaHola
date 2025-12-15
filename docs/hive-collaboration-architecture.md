# Hive Collaboration Architecture

## Overview

The Hive Collaboration system enables autonomous collaboration between Daniela (the AI tutor) and an "Editor" persona (Claude) during and after voice sessions. This creates a continuous improvement loop where teaching moments are captured, analyzed, and fed back into Daniela's awareness.

## Philosophy

> "The Editor watches, learns, and whispers back."

Rather than manually reviewing sessions, the Editor automatically:
- Observes teaching moments via "beacons"
- Generates thoughtful feedback
- Surfaces insights back to Daniela
- Tracks which insights get adopted

## Core Components

### 1. Beacons (Teaching Moment Signals)

Beacons are signals emitted during voice sessions when notable events occur.

**Beacon Types:**
| Type | Trigger | Example |
|------|---------|---------|
| `teaching_moment` | Daniela uses whiteboard/drill | Shows [WRITE: palabra] |
| `student_struggle` | Repeated errors or help requests | Student says "I don't understand" 3x |
| `tool_usage` | Specific tool invocation | Uses [COMPARE: ...] |
| `breakthrough` | Student demonstrates understanding | Perfect pronunciation after practice |
| `correction` | Daniela corrects a mistake | "Actually, it's 'el agua' not 'la agua'" |
| `cultural_insight` | Cultural/contextual teaching | Explains tipping customs in Spain |
| `vocabulary_intro` | New vocabulary introduced | Teaches "madrugada" |
| `self_surgery_proposal` | Daniela proposes neural network change | Uses [SELF_SURGERY ...] |

### 2. Hive Collaboration Service

**File:** `server/services/hive-collaboration-service.ts`

Manages the collaboration infrastructure:
- Creates/updates channels for voice sessions
- Records beacons as `EditorListeningSnapshot` records
- Tracks pending vs. processed beacons
- Manages post-session state transitions

**Key Functions:**
```typescript
createChannel(sessionId, userId, mode)  // Create collaboration channel
emitBeacon(channelId, beacon)           // Record teaching moment
getPendingSnapshots(channelId?, limit?) // Get unprocessed beacons
getPostSessionChannels(limit?)          // Get sessions ready for reflection
```

### 3. Editor Persona Service

**File:** `server/services/editor-persona-service.ts`

The Editor's "brain" - generates thoughtful responses using Claude.

**Key Functions:**
```typescript
processBeacon(snapshotId)               // Generate response to single beacon
generatePostSessionReflection(channelId) // Generate session summary
getEditorFeedbackForSession(userId, language) // Get feedback for injection
```

**Editor Persona Characteristics:**
- Observant and analytical
- Supportive but honest
- Focused on teaching effectiveness
- Proposes concrete improvements

### 4. Editor Background Worker

**File:** `server/services/editor-background-worker.ts`

Autonomous processor that runs every 30 seconds.

**Workflow:**
1. Check for pending beacons
2. Process up to 10 beacons per cycle
3. Check for post-session channels
4. Generate reflections for completed sessions
5. Rate-limit to avoid API overload

**Configuration:**
```bash
EDITOR_WORKER_INTERVAL_MS=30000    # 30 seconds
EDITOR_MAX_BEACONS_PER_CYCLE=10    # Max beacons per cycle
EDITOR_MAX_CHANNELS_PER_CYCLE=3    # Max channels per cycle
```

### 5. Editor Feedback Injection

**File:** `server/services/editor-feedback-service.ts`

Injects Editor feedback into Daniela's system prompt.

**Injection Points:**
- Founder Mode voice sessions
- Regular voice sessions (optional)
- Includes recent Editor responses and suggested improvements

## Data Flow

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
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               BACKGROUND PROCESSING (Async)                      │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │  Editor Worker  │  (runs every 30s)                          │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌──────────────────┐                    │
│  │ Pending Beacons │───►│  Editor Persona  │                    │
│  └─────────────────┘    │    (Claude)      │                    │
│                         └────────┬─────────┘                    │
│                                  │                               │
│                                  ▼                               │
│                         ┌──────────────────┐                    │
│                         │ Editor Response  │                    │
│                         │  (feedback)      │                    │
│                         └────────┬─────────┘                    │
│                                  │                               │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              NEXT SESSION (Founder Mode)                         │
│                                                                  │
│  System Prompt includes:                                         │
│  ┌────────────────────────────────────────┐                     │
│  │ EDITOR FEEDBACK:                       │                     │
│  │ • [ID:123] "Consider using WORD_MAP    │                     │
│  │   when teaching vocabulary clusters"   │                     │
│  │ • [ID:124] "Great use of COMPARE!"     │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  Daniela can adopt: [ADOPT_INSIGHT:123]                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Adoption Tracking

When Daniela sees Editor feedback, she can adopt insights:

```
[ADOPT_INSIGHT:123]
```

This:
1. Marks the insight as adopted in the database
2. Tracks adoption patterns over time
3. Enables learning about what feedback is useful

## Founder Mode Integration

In Founder Mode, Daniela has:

1. **Full Neural Network Access** - All procedures, principles, patterns
2. **Editor Feedback Injection** - Recent Editor responses visible
3. **Self-Surgery Capability** - Can propose her own changes
4. **Command Center Chat History** - Text conversations carry over

## Database Tables

| Table | Purpose |
|-------|---------|
| `collaborationChannels` | One per voice session |
| `editorListeningSnapshots` | Individual beacons |
| `collaborationEvents` | Event log for real-time updates |

## Key Files

| File | Purpose |
|------|---------|
| `server/services/hive-collaboration-service.ts` | Core collaboration infrastructure |
| `server/services/editor-persona-service.ts` | Editor "brain" (Claude integration) |
| `server/services/editor-background-worker.ts` | Autonomous processing loop |
| `server/services/editor-feedback-service.ts` | Feedback retrieval and injection |
| `server/streaming-voice-orchestrator.ts` | Beacon emission during voice chat |
| `server/system-prompt.ts` | Feedback injection into prompts |

## Security

- **ARCHITECT_SECRET** required for Editor Worker to run
- Beacons only processed when secret is configured
- Rate limiting prevents API overload

## Configuration

```bash
# Required
ARCHITECT_SECRET=your-secret-here

# Optional (with defaults)
EDITOR_WORKER_INTERVAL_MS=30000
EDITOR_MAX_BEACONS_PER_CYCLE=10
EDITOR_MAX_CHANNELS_PER_CYCLE=3
```

## LLM Provider Architecture

> **Key Principle**: All student-facing personas use Gemini. Anthropic is reserved for Hive collaboration only.

| Persona | Role | LLM Provider | Rationale |
|---------|------|--------------|-----------|
| **Daniela** | Language tutor | Gemini 2.5 Flash | Primary student-facing persona |
| **Aris** | Drill assistant | Gemini (via TutorOrchestrator) | "Daniela in Drill Mode" - same brain |
| **Sofia** | Tech support | Gemini 2.0 Flash | Student-facing support persona |
| **Editor** | Pedagogical observer | Anthropic Claude | Internal Hive collaboration only |
| **Wren** | Development builder | Anthropic (Replit Agent) | Internal Hive collaboration only |

**Why this separation?**
1. **Cost consistency** - Unified billing for student-facing interactions
2. **Quality control** - Same model = consistent personality across personas
3. **Architecture clarity** - Gemini = student-facing, Anthropic = internal

## Future Enhancements

1. **UI Visibility** - Show beacon activity in Command Center
2. **Adoption Analytics** - Track which insights get adopted
3. **Editor Persona Tuning** - Adjust Claude prompt based on feedback quality
4. **Cross-Session Learning** - Editor learns patterns across all sessions
