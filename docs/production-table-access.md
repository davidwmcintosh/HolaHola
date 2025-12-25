# Production Database Table Access

This document lists which tables are accessed in production and their access patterns.

## Access Patterns Legend

| Symbol | Meaning |
|--------|---------|
| **R** | Read from production |
| **W** | Write to production |
| **RW** | Read and write in production |
| **LOCAL** | Stays in each environment, not synced |
| **PUSH** | Synced from dev → prod |
| **PULL** | Synced from prod → dev |

---

## Student/User Data Tables (LOCAL - Not Synced)

These tables contain user-specific data and stay local to each environment:

| Table | Production Access | Notes |
|-------|-------------------|-------|
| `users` | RW | User accounts - NOT synced between envs |
| `user_credentials` | RW | Auth credentials - LOCAL only |
| `auth_tokens` | RW | Session tokens - LOCAL only |
| `conversations` | RW | Student conversations - LOCAL only |
| `messages` | RW | Chat messages - LOCAL only |
| `vocabulary_words` | RW | Student vocabulary - LOCAL only |
| `user_progress` | RW | ACTFL progress - LOCAL only |
| `actfl_progress` | RW | Level tracking - LOCAL only |
| `voice_sessions` | RW | Voice session metadata - PULL via beta-usage |
| `usage_ledger` | RW | Credit usage - PULL via beta-usage |

---

## Neural Network Tables (Bidirectional Sync)

### PUSH: Dev → Prod (Approved Knowledge Out)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `self_best_practices` | neural-core | Daniela's learned strategies |
| `tool_knowledge` | neural-core | How to use whiteboard commands |
| `tutor_procedures` | neural-core | Teaching procedures |
| `teaching_principles` | neural-core | Pedagogical beliefs |
| `situational_patterns` | neural-core | Context-triggered behaviors |
| `curriculum_paths` | neural-core | Syllabus structure |
| `curriculum_units` | neural-core | Unit definitions |
| `curriculum_lessons` | neural-core | Lesson definitions |
| `topics` | neural-core | Conversation topics |
| `curriculum_drill_items` | neural-core | Drill exercises |
| `grammar_exercises` | neural-core | Grammar content |
| `can_do_statements` | neural-core | ACTFL statements |
| `cultural_tips` | neural-core | Cultural knowledge (legacy) |

### PULL: Prod → Dev (Content Growth Back)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `language_idioms` | prod-content-growth | Daniela-authored idioms |
| `cultural_nuances` | prod-content-growth | Daniela-authored nuances |
| `learner_error_patterns` | prod-content-growth | Daniela-discovered errors |
| `dialect_variations` | prod-content-growth | Regional variations |
| `linguistic_bridges` | prod-content-growth | Cross-language connections |

---

## Intelligence Tables (Dev → Prod Only)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `wren_insights` | advanced-intel-a | Wren's learned knowledge |
| `wren_proactive_triggers` | advanced-intel-a | Wren's proactive behaviors |
| `architectural_decision_records` | advanced-intel-a | ADRs |
| `wren_mistakes` | advanced-intel-a | Wren's mistakes log |
| `wren_lessons` | advanced-intel-a | Wren's lessons |
| `wren_commitments` | advanced-intel-a | Wren's commitments |
| `trilane_signals` | advanced-intel-b | Session phase signals |
| `compass_principles` | advanced-intel-b | North Star principles |
| `compass_understanding` | advanced-intel-b | North Star understanding |
| `compass_examples` | advanced-intel-b | North Star examples |
| `daniela_recommendations` | advanced-intel-a | Daniela's drill recommendations |
| `daniela_feature_feedback` | advanced-intel-a | Daniela's feature feedback |

---

## Collaboration Tables (Bidirectional)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `founder_sessions` | express-lane | EXPRESS Lane sessions |
| `collaboration_messages` | express-lane | Hive chat messages |
| `hive_snapshots` | hive-snapshots | Context snapshots |
| `daniela_growth_memories` | daniela-memories | Daniela's growth memories |

---

## Config Tables (Dev → Prod)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `tutor_voices` | product-config | Voice configurations |
| `class_types` | product-config | Class type definitions |

---

## Beta Testing Tables (Prod → Dev Pull)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `voice_sessions` | beta-usage | Voice session analytics |
| `usage_ledger` | beta-usage | Credit consumption |

---

## Founder Context Tables (Bidirectional)

| Table | Sync Batch | Notes |
|-------|------------|-------|
| `learner_personal_facts` | founder-context | Founder's personal facts only (same Daniela in dev/prod) |

**Note:** Only syncs the founder's (user ID `49847136`) personal facts. Other students' data remains local to each environment.

---

## How Daniela Writes to Production

During voice chat in production, Daniela can:

1. **Autonomous Learning** (`[SELF_LEARN]` tag):
   - Writes directly to `self_best_practices` table
   - No approval needed (North Star bounds apply)
   - Syncs back to dev via beacons for visibility

2. **Content Growth** (`[SAVE_*]` tags):
   - Writes to neural network expansion tables
   - `syncStatus: 'local'` until pulled to dev
   - Founder reviews via `prod-content-growth` batch

3. **Student Data**:
   - All student interactions write locally
   - `voice_sessions`, `usage_ledger` pulled for analytics only
