# Hive Mind Expansion Plan

> Building shared knowledge across the HolaHola team: Development Agent, Daniela, Support

## The Vision

A unified knowledge system where:
- **I (Dev Agent)** persist observations about architecture, features, and improvement opportunities
- **Daniela** has complete procedural knowledge of the platform's capabilities
- **Support** understands common user friction points and solutions
- All agents can access shared context about what exists and how it works

---

## Phase 1: Feature Audit & Inventory

### Objective
Create a comprehensive feature inventory that maps:
- What features exist
- Where they're implemented (key files)
- Current status (stable, experimental, needs work)
- How they interconnect

### Deliverable
`docs/FEATURE-INVENTORY.md` - Structured feature catalog

### Categories to Document
1. **Voice Chat System** - STT, TTS, streaming, Open Mic
2. **Whiteboard Tools** - All 15+ teaching commands
3. **Drill System** - All drill types and modes
4. **Syllabus/Curriculum** - Builder, progress tracking, classes
5. **ACTFL Assessment** - Proficiency tracking, placement tests
6. **Vocabulary System** - Flashcards, spaced repetition, export
7. **Mind Map/Brain Visualization** - What we just built!
8. **Institutional Features** - Classes, teachers, students, assignments
9. **Billing/Metering** - Stripe integration, voice time tracking
10. **Neural Network** - All 17 tables and their purposes

---

## Phase 2: Agent Observations Seeding

### Objective
Populate `agent_observations` table with foundational knowledge

### Categories (from schema)
- `architecture_pattern` - How systems are built
- `feature_gap` - Missing capabilities
- `integration_opportunity` - Systems that could work together better
- `performance_concern` - Speed/efficiency issues
- `code_quality` - Refactoring opportunities
- `user_experience` - UX improvement ideas
- `documentation_need` - Gaps in docs
- `testing_gap` - Missing test coverage
- `security_consideration` - Security patterns
- `best_practice` - Patterns that work well

### Initial Observations to Record
1. Unified TutorOrchestrator pattern (one tutor, many voices)
2. Mind Map syllabus integration architecture
3. Neural network sync system patterns
4. Whiteboard command processing flow
5. Voice pipeline architecture (Deepgram → Gemini → Cartesia)

---

## Phase 3: Daniela Knowledge Expansion

### Objective
Ensure Daniela knows about ALL platform features so she can:
- Reference features in teaching ("I can show you a word map!")
- Guide students to resources ("Check your vocabulary in the Library")
- Explain platform capabilities

### Tables to Update
- `tool_knowledge` - All tools she can use
- `tutor_procedures` - Situations and responses
- `teaching_principles` - Core beliefs

---

## Phase 4: Cross-Agent Awareness

### Objective
Create documented patterns for agents to reference each other's knowledge

### Examples
- Dev Agent can see Daniela's suggestions (`daniela_suggestions` table)
- Daniela can reference feature inventory for user guidance
- Support can see common technical issues from dev observations

---

## Execution Order

1. ☑ Create `docs/FEATURE-INVENTORY.md` with comprehensive feature list (COMPLETED)
2. ☑ Seed `agent_observations` with foundational observations (5 key patterns added)
3. ☑ Update `docs/neural-network-architecture.md` with hive mind patterns (COMPLETED)
4. ☑ Expand Daniela's procedural memory with platform feature awareness (4 procedures, 3 tools added)

---

*Created: December 2025*
