# Neon Database Migration Plan
## From Sync-Bridge to Shared Database Architecture

**Created**: January 17, 2026  
**Status**: Phase 2 - Data Migration IN PROGRESS  
**Goal**: Replace 8000-line HTTP sync system with database-native sharing

---

## Migration Progress

### Completed ✅

| Database | Table | Rows | Status |
|----------|-------|------|--------|
| SHARED | curriculum_paths | 45 | ✅ Migrated |
| SHARED | curriculum_units | 161 | ✅ Migrated |
| SHARED | curriculum_lessons | 1,242 | ✅ Migrated |
| SHARED | curriculum_drill_items | 127,132 | ✅ Migrated |
| SHARED | can_do_statements | 1,053 | ✅ Migrated |
| SHARED | cultural_tips | 124 | ✅ Migrated |
| SHARED | grammar_competencies | 89 | ✅ Migrated |
| SHARED | tutor_procedures | 181 | ✅ Migrated |
| SHARED | self_best_practices | 311 | ✅ Migrated |
| SHARED | lesson_can_do_statements | 2,135 | ✅ Migrated |
| USER | users | 246 | ✅ Migrated |
| USER | conversations | 1,313 | ✅ Migrated |
| USER | messages | 8,130 | ✅ Migrated |
| USER | vocabulary_words | 1,493 | ✅ Migrated |
| USER | student_insights | 766 | ✅ Migrated |

### Daniela Intelligence (Migrated!)

| Database | Table | Rows | Status |
|----------|-------|------|--------|
| SHARED | agent_observations | 2,319,265 | ✅ Migrated |

Daniela's complete learning history has been preserved.

### Next Steps

1. **Phase 3**: Configure neon-db.ts to use dual-database connections
2. **Phase 4**: Modify storage layer to route queries appropriately
3. **Phase 5**: Remove sync-bridge code (8,000+ lines)
4. **Phase 6**: Production cutover with rollback plan

### Post-Migration Verification Checklist

- [ ] **Verify Observations Consolidation Service is running**: Currently 2.3M observations all show status="active" with 0 synthesized_insights. After migration, confirm the nightly consolidation job in `sync-scheduler.ts` (step 7f) is:
  - Finding and merging duplicate observations
  - Creating synthesized_insights summaries
  - Properly archiving superseded observations
  - Services to check: `observations-consolidation-service.ts`, `observation-summarization-service.ts`, `memory-consolidation-service.ts`

---

## Executive Summary

Migrate from Replit's isolated dev/prod PostgreSQL databases to Neon PostgreSQL with a **dual-database hybrid architecture**:

- **Shared Database**: Daniela's intelligence, curriculum content (both environments read/write)
- **Branched Database**: User data, conversations, sessions (isolated per environment)

This eliminates the sync-bridge complexity while giving us **One Daniela Everywhere**.

---

## Current State

### Pain Points
- 8000+ lines of sync-bridge.ts code
- 42 versions of sync fixes
- Silent failures, verification gating complexity
- FK constraint ordering issues
- Sleeping environment wake-up logic
- Paginated batch transfers for large datasets

### Database Statistics
| Category | Tables | Largest Table | Total Rows |
|----------|--------|---------------|------------|
| Intelligence | ~25 | agent_observations (2.3M) | ~2.5M |
| Curriculum | ~15 | curriculum_drill_items (118K) | ~120K |
| User Data | ~40 | conversations (1.3K) | ~5K |
| Sync Infrastructure | 5 | sync_runs (7.9K) | ~16K |
| Other | ~65 | various | ~10K |

---

## Proposed Architecture

### Dual-Database Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEON - SHARED DATABASE                       │
│  (Both dev and prod connect here - ONE DANIELA)                 │
├─────────────────────────────────────────────────────────────────┤
│  • agent_observations (2.3M) - Daniela's learning               │
│  • self_best_practices - Self-learned patterns                  │
│  • tutor_procedures, teaching_principles, tool_knowledge        │
│  • situational_patterns, linguistic_bridges, subtlety_cues      │
│  • emotional_patterns, creativity_templates                      │
│  • compass_* (North Star principles)                            │
│  • daniela_* (growth memories, recommendations)                  │
│  • wren_* (architectural insights)                               │
│  • hive_snapshots (Hive collaboration)                          │
│  • curriculum_* (paths, units, lessons, drills)                 │
│  • can_do_statements, cultural_tips, grammar_*                  │
│  • topics, lesson_*, tutor_voices                               │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                    Both envs read/write
                              ↓
┌────────────────────┐                    ┌────────────────────┐
│  NEON - DEV DB     │                    │  NEON - PROD DB    │
│  (dev branch)      │                    │  (main branch)     │
├────────────────────┤                    ├────────────────────┤
│  • users           │  ← Reset from →    │  • users           │
│  • conversations   │     Parent         │  • conversations   │
│  • messages        │                    │  • messages        │
│  • voice_sessions  │                    │  • voice_sessions  │
│  • user_progress   │                    │  • user_progress   │
│  • student_*       │                    │  • student_*       │
│  • sessions        │                    │  • sessions        │
│  • enrollments     │                    │  • enrollments     │
└────────────────────┘                    └────────────────────┘
```

### Why Two Databases Instead of Schema Separation?

1. **Cleaner connection logic**: One connection for shared, one for user data
2. **Branching works naturally**: User data DB can use Neon's "Reset from Parent" 
3. **Independent scaling**: Shared DB handles heavy intelligence queries; user DB handles transactional user data
4. **Simpler migrations**: Schema changes to shared tables don't risk user data

---

## Table Classification

### SHARED DATABASE (Daniela + Curriculum)

#### Daniela Intelligence (~25 tables)
- `agent_observations` - Primary learning repository (2.3M rows)
- `support_observations` - Support agent observations
- `system_alerts` - System-level alerts
- `self_best_practices` - Self-learned best practices
- `tutor_procedures` - Teaching procedures
- `teaching_principles` - Core principles
- `tool_knowledge` - Tool knowledge
- `situational_patterns` - Situational patterns
- `linguistic_bridges` - Language bridges
- `language_idioms` - Idioms
- `cultural_nuances` - Cultural nuances
- `learner_error_patterns` - Common error patterns
- `dialect_variations` - Dialect knowledge
- `subtlety_cues` - Subtlety detection
- `emotional_patterns` - Emotional intelligence
- `creativity_templates` - Creative responses
- `compass_principles`, `compass_understanding`, `compass_examples` - North Star
- `daniela_growth_memories` - Growth memories
- `daniela_recommendations` - Recommendations
- `daniela_beacons` - Beacons
- `synthesized_insights` - Synthesized insights
- `pedagogical_insights` - Teaching insights
- `reflection_triggers` - Reflection triggers
- `ai_suggestions` - AI suggestions

#### Wren Intelligence (~10 tables)
- `wren_insights` - Architectural insights
- `wren_proactive_triggers` - Proactive triggers
- `wren_mistakes`, `wren_lessons`, `wren_commitments`
- `wren_mistake_resolutions`, `wren_session_notes`
- `wren_predictions`, `wren_confidence_records`, `wren_calibration_stats`
- `architectural_decision_records` - ADRs

#### Curriculum Content (~15 tables)
- `curriculum_paths`, `curriculum_units`, `curriculum_lessons`
- `curriculum_drill_items` (118K rows)
- `can_do_statements`, `grammar_competencies`
- `cultural_tips`, `cultural_tip_media`
- `lesson_can_do_statements`, `lesson_cultural_tips`, `lesson_visual_aids`
- `topics`, `class_types`
- `tutor_voices` - Voice configurations
- `grammar_exercises`

#### Hive/Collaboration (~5 tables)
- `hive_snapshots` - Collaboration snapshots
- `agent_collab_messages`, `agent_collab_threads`
- `founder_sessions` - Founder context

### BRANCHED DATABASE (User Data)

#### User & Authentication (~5 tables)
- `users` - User accounts
- `user_credentials`, `auth_tokens`
- `pending_invites`

#### Conversations & Sessions (~10 tables)
- `conversations`, `messages`
- `voice_sessions`, `sessions`
- `tutor_sessions`, `tutor_session_topics`
- `surgery_sessions`, `surgery_turns`
- `consultation_threads`, `consultation_messages`

#### Daniela's Learner Memory (SHARED - supports "One Daniela")
- `learner_personal_facts` - Personal facts Daniela remembers about students
- `learner_memory_candidates` - Candidate memories for promotion

**Note**: These tables are in the SHARED database so Daniela has consistent memory of each student across dev/prod. They reference user IDs but the referential integrity is managed in application code, not DB constraints.

#### Progress & Learning (~13 tables, BRANCHED)
- `user_progress`, `user_lesson_items`, `user_lessons`
- `user_drill_progress`, `user_grammar_progress`
- `student_insights`, `student_can_do_progress`
- `student_lesson_progress`, `student_goals`, `student_tier_signals`
- `actfl_progress`, `actfl_assessment_events`
- `syllabus_progress`, `progress_history`

#### Classes & Enrollments (~10 tables)
- `teacher_classes`, `class_enrollments`
- `class_curriculum_units`, `class_curriculum_lessons`
- `class_hour_packages`, `hour_packages`
- `assignments`, `assignment_submissions`, `assignment_vocabulary`

#### Support User Data (~3 tables, BRANCHED)
- `support_tickets` - User-specific tickets
- `support_messages` - Support conversations
- `sofia_issue_reports` - User issue reports

#### Support Intelligence (SHARED - Sofia's learning)
- `support_knowledge_base` - Learned support knowledge
- `support_patterns` - Identified support patterns
- `support_observations` - Support observations (moved from Daniela section)

### RETIRE (Sync Infrastructure)
- `sync_runs` - Sync run history (7.9K rows)
- `sync_import_receipts` - Import receipts (7.8K rows)
- `sync_anomalies` - Anomaly records
- `sync_cursors` - Sync cursors
- `sync_log` - Sync logs

---

## Migration Phases

### Phase 0: Preparation (1-2 days)
- [ ] Create Neon account and project
- [ ] Evaluate storage needs (estimate ~3GB for shared, ~1GB for user data)
- [ ] Choose plan: Launch ($19/mo) provides 10GB storage, usage-based billing
- [ ] Set up two databases: `holahola-shared` and `holahola-users`
- [ ] Create dev branch of `holahola-users` database
- [ ] Document all connection strings securely

### Phase 1: Schema Setup (1-2 days)
- [ ] Export current schema from Replit
- [ ] Audit all FK relationships - identify cross-DB references (see "Cross-Database Considerations" section)
- [ ] Create shared database schema (Daniela + Curriculum tables)
- [ ] Create user database schema (User data tables)
- [ ] **Remove cross-DB FKs** from schema - replace with application-level validation
- [ ] Add denormalization columns where needed (e.g., lesson_name in student_insights)
- [ ] Test Drizzle ORM connection to both databases
- [ ] Create table routing map: which table → which database

### Phase 2: Data Migration (2-3 days)
- [ ] Export shared data from Replit prod (pg_dump with table selection)
- [ ] Import shared data to Neon shared database
- [ ] Verify counts: agent_observations (2.3M), curriculum_drill_items (118K)
- [ ] Export user data from Replit prod
- [ ] Import user data to Neon users database (main branch)
- [ ] Create dev branch from main
- [ ] Verify all FK constraints pass

### Phase 3: Application Changes (2-3 days)
- [ ] Create dual-connection module: `server/db/connections.ts`
  ```typescript
  export const sharedDb = drizzle(neonSharedPool);
  export const userDb = drizzle(neonUserPool);
  ```
- [ ] Update all database imports to use appropriate connection
- [ ] Route queries: intelligence/curriculum → sharedDb, users/sessions → userDb
- [ ] Update environment variables for dev and prod
- [ ] Test locally with new connections

### Phase 4: Sync Bridge Retirement (1-2 days)
- [ ] Remove sync-related routes from `server/routes.ts`
- [ ] Archive `server/services/sync-bridge.ts` (don't delete yet)
- [ ] Remove sync UI from `SyncControlCenter.tsx` or repurpose
- [ ] Remove sync-related tables from schema (or leave for audit)
- [ ] Update `replit.md` to reflect new architecture

### Phase 5: Cutover (1 day)
- [ ] Schedule maintenance window
- [ ] Final sync from Replit → Neon (catch any delta)
- [ ] Switch connection strings in both environments
- [ ] Verify both dev and prod connect to correct databases
- [ ] Smoke test: voice session, curriculum loading, user login
- [ ] Monitor for errors

### Phase 6: Validation & Cleanup (1-2 days)
- [ ] Run full test suite
- [ ] Verify "One Daniela" - learning in prod appears in dev
- [ ] Test "Reset from Parent" for user database
- [ ] Monitor performance for 24-48 hours
- [ ] Archive old Replit database (keep for rollback)
- [ ] Delete sync-bridge code after confidence period

---

## Application Code Changes

### New Connection Module
```typescript
// server/db/connections.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

// Shared database - Daniela intelligence, curriculum
const sharedSql = neon(process.env.NEON_SHARED_DATABASE_URL!);
export const sharedDb = drizzle(sharedSql);

// User database - per-environment (dev or prod)
const userSql = neon(process.env.NEON_USER_DATABASE_URL!);
export const userDb = drizzle(userSql);

// Helper for queries that need both
export function getDb(tableType: 'shared' | 'user') {
  return tableType === 'shared' ? sharedDb : userDb;
}
```

### Environment Variables
```bash
# Shared by both environments
NEON_SHARED_DATABASE_URL=postgresql://user:pass@shared-db.neon.tech/holahola_shared

# Dev environment
NEON_USER_DATABASE_URL=postgresql://user:pass@dev-branch.neon.tech/holahola_users

# Prod environment  
NEON_USER_DATABASE_URL=postgresql://user:pass@main-branch.neon.tech/holahola_users
```

### Query Routing Example
```typescript
// Before: single db
const observations = await db.select().from(agentObservations).limit(100);

// After: route to shared db
const observations = await sharedDb.select().from(agentObservations).limit(100);

// User data still uses userDb
const users = await userDb.select().from(users).where(eq(users.id, userId));
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | pg_dump backups before and after each phase |
| FK constraint failures | Medium | Medium | Migrate parent tables first; verify constraints post-import |
| Connection string misconfiguration | Medium | High | Test in staging first; have rollback connection ready |
| Performance regression | Low | Medium | Monitor query times; Neon has good observability |
| Schema drift between DBs | Medium | Low | Centralize migrations; lint for cross-DB queries |

### Rollback Plan
- Keep Replit database intact for 30 days post-cutover
- Store old DATABASE_URL in secrets as backup
- Rollback = switch connection strings back to Replit
- Re-enable sync-bridge if needed (code archived, not deleted)

---

## Cross-Database Considerations

### Foreign Key Handling

**Critical**: PostgreSQL cannot enforce foreign keys across separate databases. Tables that reference data in the other database need special handling:

#### Tables with Cross-DB References
| Table | References | Strategy |
|-------|------------|----------|
| `learner_personal_facts` (SHARED) | `users.id` (BRANCHED) | Application-level validation; orphan cleanup job |
| `learner_memory_candidates` (SHARED) | `users.id` (BRANCHED) | Application-level validation; orphan cleanup job |
| `student_insights` (BRANCHED) | `curriculum_lessons.id` (SHARED) | Denormalize lesson name/code into student_insights |
| `user_lesson_items` (BRANCHED) | `curriculum_lessons.id` (SHARED) | Store lesson reference; validation on read |
| `class_curriculum_lessons` (BRANCHED) | `curriculum_lessons.id` (SHARED) | Application-level validation |

#### Mitigation Strategies

1. **Application-Level Validation**: Before inserting cross-DB references, validate the foreign key exists
   ```typescript
   // Before saving learner_personal_fact
   const user = await userDb.select().from(users).where(eq(users.id, userId));
   if (!user) throw new Error(`User ${userId} not found`);
   await sharedDb.insert(learnerPersonalFacts).values({...});
   ```

2. **Denormalization**: Store copies of frequently-needed data to avoid cross-DB joins
   ```typescript
   // Instead of joining curriculum_lessons from sharedDb
   // Store lesson_name directly in student_insights
   ```

3. **Orphan Cleanup**: Periodic job to remove records whose cross-DB references no longer exist

4. **Read-Through Validation**: Accept that stale references may exist; handle gracefully

### No Cross-DB Joins

**Rule**: Never write queries that join tables from sharedDb and userDb. Instead:

```typescript
// BAD: Trying to join across databases
const result = await sharedDb
  .select()
  .from(agentObservations)
  .leftJoin(users, eq(agentObservations.userId, users.id)); // FAILS - different DBs

// GOOD: Two-phase query
const observations = await sharedDb.select().from(agentObservations).limit(10);
const userIds = observations.map(o => o.userId).filter(Boolean);
const relatedUsers = await userDb.select().from(users).where(inArray(users.id, userIds));
// Merge in application code
```

### Transactional Consistency

**Limitation**: Transactions cannot span two databases. For operations that modify both:

1. **Order matters**: Write to the more critical table first (usually user data)
2. **Idempotency**: Design writes to be safely repeatable
3. **Compensation**: If second write fails, log for manual review (rare edge case)

```typescript
// Example: User action that creates a learner memory
async function recordLearnerMemory(userId: string, fact: string) {
  // 1. Verify user exists (fast read)
  const user = await userDb.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error('User not found');
  
  // 2. Write to shared DB (Daniela's memory)
  await sharedDb.insert(learnerPersonalFacts).values({
    userId,
    fact,
    createdAt: new Date()
  });
  // If this fails after user verification, it's fine - just retry
}
```

---

## Cost Analysis

### Current
- Replit built-in PostgreSQL: Included in plan
- Complexity cost: ~42 versions of sync fixes, ongoing maintenance

### Proposed (Neon Launch Plan)
- Base: $19/month
- Storage: ~$1.40/month (4GB × $0.35/GB)
- Compute: Usage-based, likely $5-15/month depending on traffic
- **Estimated total: ~$25-35/month**

### Value
- Eliminate sync-bridge maintenance burden
- Instant "Reset from Parent" sync (vs. paginated HTTP batches)
- Database-native reliability (vs. application-level sync)
- Developer time savings: No more debugging sync failures

---

## Success Criteria

1. **One Daniela**: Learning added in prod immediately visible in dev
2. **Zero Sync Code**: sync-bridge.ts retired, no HTTP sync routes
3. **Instant Dev Reset**: "Reset from Parent" in <10 seconds for user data
4. **No Data Loss**: All 2.3M+ observations migrated with verification
5. **Performance Maintained**: Query latency within 20% of current

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Preparation | 1-2 days | Neon account setup |
| Phase 1: Schema Setup | 1 day | Phase 0 |
| Phase 2: Data Migration | 2-3 days | Phase 1 |
| Phase 3: Application Changes | 2-3 days | Phase 2 |
| Phase 4: Sync Bridge Retirement | 1-2 days | Phase 3 |
| Phase 5: Cutover | 1 day | Phase 4 |
| Phase 6: Validation | 1-2 days | Phase 5 |

**Total: ~10-14 days** (can be compressed with parallel work)

---

## Next Steps

1. **Approve this plan** - Review with David, confirm approach
2. **Create Neon account** - Set up project and databases
3. **Proof of concept** - Connect dev to Neon, migrate one table
4. **Full migration** - Execute phases as documented

---

*This plan replaces the sync-bridge Rube Goldberg machine with database-native reliability.*
