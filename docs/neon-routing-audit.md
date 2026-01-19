# Neon Database Routing Audit

**Date:** January 2026  
**Status:** Phase 2 - COMPLETE ✅  
**Scope:** All `server/services/*.ts`, `server/routes.ts`, `server/reporting-service.ts` have been migrated. Seed/migration/test scripts use direct `db` access (acceptable for dev-only files).

## Architecture Summary

HolaHola uses a dual-database architecture with Neon PostgreSQL:

- **Shared Database**: Daniela's intelligence, curriculum content, Wren insights, Hive collaboration
- **User Database**: Per-environment user data (accounts, conversations, sessions, progress)

Routing is controlled by:
- `USE_NEON_ROUTING=true` environment variable
- `getSharedDb()` for shared tables
- `getUserDb()` for user tables
- Direct `db` reference goes to Replit DB (legacy, avoid in new code)

## Services Using Proper Routing ✅

These services have been updated to use `getSharedDb()`/`getUserDb()`:

- `agent-collaboration-service.ts`
- `ai-lesson-generator.ts`
- `beacon-sync-service.ts`
- `brain-surgery-service.ts`
- `curriculum-sync-service.ts`
- `daniela-memory-service.ts`
- `drill-lifecycle-service.ts`
- `fluency-wiring-service.ts` (partial - needs getUserDb for some tables)
- `founder-collaboration-service.ts`
- `teaching-suggestions.ts`
- `voice-diagnostics-service.ts`
- `voice-intelligence-service.ts`
- `wren-commitments-service.ts`
- `wren-dreams-service.ts`
- `wren-intelligence-service.ts`
- `wren-proactive-intelligence-service.ts`
- `syllabus-analytics-service.ts` (FIXED Jan 2026)
- `streaming-voice-orchestrator.ts` (FIXED Jan 2026 - MEMORY_LOOKUP, EXPRESS_LANE_LOOKUP)
- `competency-verifier.ts` (FIXED Jan 2026 - syllabusProgress to getUserDb)
- `fluency-wiring-service.ts` (FIXED Jan 2026 - studentCanDoProgress, actflAssessmentEvents to getUserDb)
- `conversation-tagger.ts` (FIXED Jan 2026 - conversationTopics, conversations to getUserDb)
- `usage-service.ts` (FIXED Jan 2026 - syllabus_progress query to getUserDb)
- `azure-pronunciation-service.ts` (FIXED Jan 2026 - phonemeStruggles to getUserDb)
- `daniela-reflection.ts` (FIXED Jan 2026 - danielaSuggestions to getSharedDb)
- `surgery-insight-service.ts` (FIXED Jan 2026 - tutorProcedures, teachingPrinciples, toolKnowledge, situationalPatterns to getSharedDb)
- `collaboration-hub-service.ts` (FIXED Jan 2026 - collaborationEvents, collaborationParticipants to getUserDb)
- `editor-feedback-service.ts` (FIXED Jan 2026 - editorListeningSnapshots, collaborationChannels to getUserDb) [DEPRECATED]
- `editor-realtime-dispatcher.ts` (FIXED Jan 2026 - editorBeaconQueue, editorListeningSnapshots to getUserDb) [DEPRECATED]
- `architect-voice-service.ts` (FIXED Jan 2026 - architectNotes to getSharedDb)
- `hive-collaboration-service.ts` (FIXED Jan 2026 - collaborationChannels, editorListeningSnapshots, editorBeaconQueue, collaborationEvents to getUserDb)
- `support-persona-service.ts` (FIXED Jan 2026 - supportKnowledgeBase, supportPatterns to getSharedDb; supportTickets, supportMessages, sofiaIssueReports to getUserDb)
- `neural-memory-search.ts` (FIXED Jan 2026 - student memory tables to getUserDb, curriculum tables to getSharedDb)
- `procedural-memory-retrieval.ts` (FIXED Jan 2026 - voiceSessions, userProgress to getUserDb; learnerPersonalFacts to getSharedDb)
- `hive-consciousness-service.ts` (FIXED Jan 2026 - featureSprints to getSharedDb)
- `hive-context-service.ts` (FIXED Jan 2026 - teacherClasses to getUserDb, curriculum/insights to getSharedDb)
- `founder-collaboration-service.ts` (FIXED Jan 2026 - syncCursors to getUserDb)
- `phoneme-analytics-service.ts` (FIXED Jan 2026 - phonemeStruggles to getUserDb)
- `pedagogical-insights-service.ts` (FIXED Jan 2026 - teachingToolEvents to getSharedDb)
- `observations-consolidation-service.ts` (FIXED Jan 2026 - agentObservations, supportObservations to getSharedDb)
- `password-auth-service.ts` (FIXED Jan 2026 - users, userCredentials, authTokens to getUserDb)
- `neural-network-sync.ts` (FIXED Jan 2026 - toolKnowledge, teachingSuggestionEffectiveness to getSharedDb)
- `memory-consolidation-service.ts` (FIXED Jan 2026 - danielaGrowthMemories to getSharedDb)
- `pronunciation-drill-service.ts` (FIXED Jan 2026 - hiveSnapshots to getSharedDb, recurringStruggles to getUserDb)
- `phase-transition-service.ts` (FIXED Jan 2026 - hiveSnapshots to getSharedDb)
- `memory-insight-extraction-service.ts` (FIXED Jan 2026 - danielaGrowthMemories to getSharedDb)
- `historical-memory-migration-service.ts` (FIXED Jan 2026 - danielaGrowthMemories, hiveSnapshots to getSharedDb)
- `historical-personal-facts-migration-service.ts` (FIXED Jan 2026 - hiveSnapshots to getSharedDb)
- `session-compass-service.ts` (FIXED Jan 2026 - tutorSessions to getUserDb)

## Additional Files Fixed (Jan 2026)

- **routes.ts** - All 85+ db usages routed properly
- **reporting-service.ts** - All db usages routed properly

## Services Needing No Changes ✅

All services in `server/services/*.ts` now use proper Neon routing.

### Deprecated (Will Be Removed in Phase 3)

- **sync-bridge.ts** - 286 db usages, deprecated (replaced by Neon routing)
- **sync-scheduler.ts** - 4 db usages, deprecated
- **editor-persona-service.ts** - 11 db usages, deprecated

## Deprecated (No Fix Needed) 🗑️

These files are marked for removal in Phase 3:

- `sync-bridge.ts` - 8,000 lines, replaced by Neon routing
- `sync-scheduler.ts` - Coordinates sync-bridge, no longer needed

## Table Classification Reference

See `server/neon-db.ts` for authoritative table lists:

- `SHARED_TABLES` - Route to Neon Shared database
- `USER_TABLES` - Route to Neon User database (branched)

## Next Steps

1. ~~**Phase 2 (Complete)**~~: All services and routes now use proper Neon routing ✅
2. **Phase 3 (Next)**: Remove deprecated sync-bridge system (sync-bridge.ts, sync-scheduler.ts, editor-persona-service.ts)
3. **Phase 4**: Disable `USE_NEON_ROUTING` flag (always use Neon)

## Files Using Direct `db` Access (Acceptable)

These files are development/seed scripts and can retain direct `db` access:

- `server/seed-*.ts` - Database seed scripts
- `server/curriculum-seed.ts` - Curriculum seed data
- `server/topic-seed.ts` - Topic seed data
- `server/seeds/*.ts` - Additional seed scripts
- `server/migrations/*.ts` - Migration orchestrators
- `server/tests/*.ts` - Test files
- `server/scripts/*.ts` - Admin scripts

## Phase 3 Exit Criteria

Before removing sync-bridge.ts and sync-scheduler.ts:

1. ✅ **Zero direct `db` usage** for shared/user tables in all server code (COMPLETE)
2. **Verification scripts pass**: `scripts/check-neon-full-status.ts`, `scripts/check-all-shared-tables.ts`
3. **Production shadow run** confirms no writes to Replit DB when `USE_NEON_ROUTING=true`
4. **Operational tests** cover teaching, usage/billing, and pronunciation flows
5. **One week soak period** with no data inconsistencies reported

## Phase 3 Actions (Deprecated Code Removal)

Files to remove:
- `server/services/sync-bridge.ts` (~8,000 lines) - Replaced by Neon routing
- `server/services/sync-scheduler.ts` (~200 lines) - Coordinated sync-bridge
- `server/services/editor-persona-service.ts` (~500 lines) - Editor system deprecated

Related cleanup:
- Remove sync-bridge imports from `server/routes.ts`
- Remove sync-bridge initialization from server startup
- Remove sync-related API routes (if any)

## Phase 4 Preparation

**Goal**: Remove `USE_NEON_ROUTING` flag and always use Neon

**Prerequisites**:
1. Phase 3 deprecated code removal complete
2. All verification scripts passing
3. Production running on Neon for 2+ weeks without issues
4. Data consistency verified between shared/user databases

**Actions**:
1. Remove `USE_NEON_ROUTING` environment variable check from `server/db.ts`
2. Simplify `getSharedDb()` and `getUserDb()` to always return Neon pools
3. Remove legacy Replit DB connection from `db.ts`
4. Update all documentation to reflect Neon-only architecture
5. Archive sync-bridge documentation

**Environment Changes**:
- Remove `USE_NEON_ROUTING` from dev/prod secrets
- Ensure `NEON_SHARED_DATABASE_URL` and `NEON_USER_DATABASE_URL` are set
- Update deployment documentation

## Migration Verification Commands

```bash
# Check for remaining direct db usage (excluding deprecated/seeds)
grep -r "\bdb\." server/services/*.ts | grep -v "sync-bridge\|sync-scheduler\|editor-persona"

# Verify Neon routing is enabled at startup
# Look for: [DB] ✓ Neon routing ENABLED for shared tables

# Run verification scripts
npx tsx scripts/check-neon-full-status.ts
npx tsx scripts/check-all-shared-tables.ts
```

## Current Status Summary

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Infrastructure setup (neon-db.ts, db.ts routing) |
| Phase 2 | ✅ Complete | All services migrated to getUserDb/getSharedDb |
| Phase 3 | 🔜 Next | Remove deprecated sync-bridge system |
| Phase 4 | Pending | Disable USE_NEON_ROUTING flag (always Neon) |
