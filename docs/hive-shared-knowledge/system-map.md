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
| **Beacons** | `collaborationBeacons` table | Capability gaps, Feature requests |
| **Self-Surgery** | `BrainSurgeryTab`, `self-surgery-routes.ts` | Neural network modifications |

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
| Voice features | ImmersiveTutor, TutorOrchestrator, Cartesia/Deepgram |
| Chat features | chat.tsx, conversation-routes, TutorOrchestrator |
| Teaching tools | Neural Network, Procedural Memory, Whiteboard commands |
| Class features | teacher-routes, syllabi, assignments |
| Admin features | CommandCenter tabs, admin-routes |
| AI behavior | TutorOrchestrator, Neural Network, Voice styles |
| Development workflow | Feature Sprints, Express Lane, Beacons |

---

*Last updated: December 15, 2025*
