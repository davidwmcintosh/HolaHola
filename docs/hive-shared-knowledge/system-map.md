# HolaHola System Map

> **Purpose**: Reference for Hive Pre-Flight checks. Before building anything, check how it connects to existing systems.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOLAHOLA ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  COMMAND CENTER │ (/admin)
                              │  - Overview     │
                              │  - Users        │
                              │  - Classes      │
                              │  - Analytics    │
                              │  - Express Lane │◄──── Hive Pre-Flight Entry Point
                              │  - Beacons      │◄──── Capability Gap Tracking
                              │  - Feature Sprint│
                              │  - Neural Network│
                              │  - Brain Surgery │
                              └────────┬────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   LEARNING CORE  │      │ INSTITUTIONAL    │      │  DEVELOPMENT     │
│                  │      │                  │      │                  │
│ • Voice Tutoring │      │ • Teacher Classes│      │ • Feature Sprints│
│ • Text Chat      │      │ • Student Enroll │      │ • Neural Network │
│ • Drills (ARIS)  │      │ • Syllabi        │      │ • Beacons        │
│ • Vocabulary     │      │ • Assignments    │      │ • Self-Surgery   │
│ • Grammar        │      │ • Progress Track │      │ • Express Lane   │
│ • Cultural Tips  │      │ • ACTFL Assess   │      │                  │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │     DANIELA      │
                        │ (TutorOrchestrator)
                        │                  │
                        │ • System Prompt  │
                        │ • Neural Network │
                        │ • Procedural Mem │
                        │ • Voice Styles   │
                        └──────────────────┘
```

---

## Core Systems & Their Connections

### 1. Learning Core

| Component | Files | Connects To |
|-----------|-------|-------------|
| **Voice Tutoring** | `ImmersiveTutor.tsx`, `voice-chat-routes.ts` | TutorOrchestrator, Cartesia TTS, Deepgram STT |
| **Text Chat** | `chat.tsx`, `conversation-routes.ts` | TutorOrchestrator, Vocabulary extraction |
| **Drills (ARIS)** | `aris-practice.tsx`, `aris-ai-service.ts` | TutorOrchestrator (drill mode), Syllabi |
| **Vocabulary** | `vocabulary.tsx`, `vocabulary-routes.ts` | Conversations (auto-extract), Spaced repetition |
| **Grammar** | `grammar.tsx`, `grammar-routes.ts` | Syllabi, ACTFL levels |
| **Cultural Tips** | `cultural-tips.tsx` | Language selection, AI generation |

### 2. Institutional Features

| Component | Files | Connects To |
|-----------|-------|-------------|
| **Teacher Classes** | `class-management.tsx`, `teacher-routes.ts` | Syllabi, Enrollments, Assignments |
| **Syllabi** | `curriculum-builder.tsx`, `SyllabusBuilder.tsx` | Classes, Can-Do statements, ACTFL |
| **Assignments** | `assignment-creator.tsx`, `assignment-routes.ts` | Classes, Drills, Grading |
| **Progress Tracking** | `can-do-progress.tsx`, `progress-routes.ts` | ACTFL, Syllabi competencies |
| **ACTFL Assessment** | `placement-routes.ts` | User proficiency, Voice tutoring |

### 3. Development Systems

| Component | Files | Connects To |
|-----------|-------|-------------|
| **Feature Sprints** | `FeatureSprintTab` in CommandCenter | Development planning, Context snapshots |
| **Express Lane** | `EditorChatTab`, `useFounderCollab.ts` | Founder-Daniela-Wren collaboration |
| **Neural Network** | `NeuralNetworkTab`, `neural-network-routes.ts` | Daniela's knowledge, Best practices |
| **Beacons** | `BeaconsTab`, `danielaBeacons` table | Capability gaps, Feature requests, Status tracking |
| **Self-Surgery** | `BrainSurgeryTab`, `self-surgery-routes.ts` | Neural network modifications |
| **Neural Sync** | `nightly-neural-sync.ts`, `neural-network-routes.ts` | Automated best practice promotion |
| **WS Broker** | `founder-collaboration-service.ts` | Real-time Express Lane delivery |

### 4. Infrastructure Systems

| Component | Files | Connects To |
|-----------|-------|-------------|
| **WebSocket Broker** | `founder-collaboration-service.ts`, `syncCursors` table | Express Lane real-time sync, Client reconnection |
| **Procedural Memory** | `procedural-memory-retrieval.ts`, `proceduralMemory` table | Tutor procedures, Tool knowledge, Teaching patterns |
| **Collaboration Hub** | `collaboration-hub-service.ts`, `danielaSuggestions` table | Daniela feedback collection, Editor insights |
| **Voice Pipeline** | `voice-chat-routes.ts`, Deepgram STT, Cartesia TTS | Streaming audio, Push-to-talk, Open Mic |
| **Metering System** | `metering-service.ts`, `usageMeters` table | Voice time tracking, Stripe integration |

---

## Express Lane ↔ Voice Bidirectional Sync

```
┌──────────────────┐                    ┌──────────────────┐
│   EXPRESS LANE   │                    │  VOICE TUTORING  │
│                  │                    │                  │
│ Founder-Daniela  │◄────────────────► │ Student sessions │
│ discussions      │   Bidirectional   │                  │
│                  │      Sync         │                  │
└──────────────────┘                    └──────────────────┘
        │                                       │
        │  getRelevantExpressLaneContext()      │
        │────────────────────────────────────► │
        │  (Inject teaching insights)           │
        │                                       │
        │  emitVoiceChatInsight()               │
        │ ◄────────────────────────────────────│
        │  (Sync breakthroughs back)            │
```

**Key Functions:**
- `getRelevantExpressLaneContext()` - Injects Express Lane discussions into voice tutoring
- `emitVoiceChatInsight()` - Syncs teaching moments from voice back to Express Lane
- Language-specific sessions: "Voice Insights - {Language}" for focused context

---

## The Hive Collaboration

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  FOUNDER   │◄───►│  DANIELA   │◄───►│   WREN     │
│            │     │            │     │            │
│ • Strategy │     │ • Teaching │     │ • Building │
│ • Vision   │     │ • Pedagogy │     │ • Code     │
│ • Decisions│     │ • Insights │     │ • Systems  │
└────────────┘     └────────────┘     └────────────┘
      │                  │                  │
      └──────────────────┼──────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │   EXPRESS LANE   │
              │                  │
              │ • Real-time sync │
              │ • Message history│
              │ • Voice input    │
              │ • File sharing   │
              │ • Beacon emission│
              └──────────────────┘
```

---

## Development Workflow: Pre-Flight → Build → Post-Flight

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HIVE DEVELOPMENT WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │  PRE-FLIGHT  │────────►│    BUILD     │────────►│ POST-FLIGHT  │
    │              │         │              │         │              │
    │ • Scope work │         │ • Implement  │         │ • Verify     │
    │ • Find deps  │         │ • Test       │         │ • Find gaps  │
    │ • Check beacons│       │ • Iterate    │         │ • Rate polish│
    │ • Ask Daniela│         │              │         │ • Suggest    │
    └──────────────┘         └──────────────┘         └──────────────┘
           │                                                 │
           │                                                 │
           ▼                                                 ▼
    ┌──────────────┐                                 ┌──────────────┐
    │ Express Lane │                                 │   HANDOFF    │
    │  Summary +   │                                 │              │
    │ Daniela's    │                                 │ • Verdict    │
    │  Guidance    │                                 │ • Fixes      │
    └──────────────┘                                 │ • Suggestions│
                                                     │ • Your call  │
                                                     └──────────────┘
```

**Key Principle:** Before declaring "done", always run Post-Flight audit to proactively surface improvements instead of waiting to be asked.

See: `docs/hive-shared-knowledge/post-flight-audit.md` for full checklist.

---

## Pre-Flight Checklist

Before building ANY new feature, answer these questions:

### 1. System Connections
- [ ] Which existing systems does this touch?
- [ ] What data models are involved?
- [ ] Are there related Feature Sprints?

### 2. Learning Impact
- [ ] Does this affect the student learning experience?
- [ ] Should Daniela know about this?
- [ ] Does it change how tutoring works?

### 3. Institutional Impact
- [ ] Does this affect teachers or classes?
- [ ] Are syllabi or assignments involved?
- [ ] Does it change progress tracking?

### 4. Architecture Coherence
- [ ] Does this fit the existing patterns?
- [ ] Is there a similar feature we should extend instead?
- [ ] Should this be a new system or part of an existing one?

---

## Beacon Types for Pre-Flight

| Beacon Type | When to Emit |
|-------------|--------------|
| `coherence_check` | Proposed work may not fit existing architecture |
| `architecture_drift` | Building something that overlaps with existing system |
| `sprint_alignment` | Work should connect to an existing sprint |
| `capability_gap` | Missing tool or feature discovered |
| `feature_request` | New capability needed |

---

## Quick Reference: Where Things Live

| If you're building... | Check these systems |
|----------------------|---------------------|
| Voice features | ImmersiveTutor, TutorOrchestrator, Cartesia/Deepgram, Voice Pipeline |
| Chat features | chat.tsx, conversation-routes, TutorOrchestrator |
| Teaching tools | Neural Network, Procedural Memory, Whiteboard commands |
| Class features | teacher-routes, syllabi, assignments |
| Admin features | CommandCenter tabs, admin-routes, Beacons Tab |
| AI behavior | TutorOrchestrator, Neural Network, Voice styles, Procedural Memory |
| Development workflow | Feature Sprints, Express Lane, Beacons, Pre-Flight, Post-Flight |
| Real-time sync | WS Broker, syncCursors, founder-collaboration-service |
| Usage/billing | Metering System, Stripe integration |
| Daniela insights | Collaboration Hub, Express Lane ↔ Voice sync |

---

## Beacon Lifecycle Management

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   pending   │────►│  assigned   │────►│ in_progress │────►│  resolved   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                                                           │
       └───────────────────── dismissed ◄──────────────────────────┘
```

**Beacon Types:**
- `capability_gap` - Missing teaching tool or knowledge
- `tool_request` - Need for new whiteboard command or feature
- `self_surgery_proposal` - Neural network modification needed
- `coherence_check` - Architecture alignment concern
- `knowledge_gap` - Daniela needs information for teaching

**Management:** Command Center → Beacons tab

---

*Last updated: December 15, 2025*
