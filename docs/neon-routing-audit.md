# Neon Database Routing Audit

**Date:** January 2026  
**Status:** Phase 2 - Routing Validation  
**Scope:** This audit covers `server/services/*.ts` only. Additional directories (`server/`, `server/scripts/`, `server/middleware/`) need separate review.

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

## Services Needing Routing Review ⚠️

### High Priority (Actively Used in Teaching/Revenue)

1. **competency-verifier.ts**
   - `db.insert(syllabusProgress)` → should use `getUserDb()`
   
2. **fluency-wiring-service.ts** 
   - `db.insert(studentCanDoProgress)` → `getUserDb()`
   - `db.insert(actflAssessmentEvents)` → `getUserDb()`

3. **conversation-tagger.ts**
   - `db.insert(conversationTopics)` → `getUserDb()`

4. **usage-service.ts**
   - Billing/usage tables - user data, affects revenue reporting
   - `db.execute()` calls → needs `getUserDb()`

5. **azure-pronunciation-service.ts**
   - `phonemeStruggles` - affects learning feedback loops
   - `db.select/insert/update()` → needs `getUserDb()`

### Medium Priority (Editor/Collaboration Features)

4. **collaboration-hub-service.ts**
   - `collaborationEvents` table - check if shared or user

5. **editor-feedback-service.ts**
   - Various editor tables - likely user data

6. **editor-persona-service.ts**
   - Mixed tables - needs audit

7. **editor-realtime-dispatcher.ts**
   - Beacon queue tables - likely user data

### Lower Priority (Admin/Surgery Features)

6. **architect-voice-service.ts**
   - `architectNotes` - check table classification

7. **daniela-reflection.ts**
   - `danielaSuggestions` - shared (Daniela intelligence), needs `getSharedDb()`

8. **surgery-insight-service.ts**
   - Neural network tables - shared, needs `getSharedDb()`

## Deprecated (No Fix Needed) 🗑️

These files are marked for removal in Phase 3:

- `sync-bridge.ts` - 8,000 lines, replaced by Neon routing
- `sync-scheduler.ts` - Coordinates sync-bridge, no longer needed

## Table Classification Reference

See `server/neon-db.ts` for authoritative table lists:

- `SHARED_TABLES` - Route to Neon Shared database
- `USER_TABLES` - Route to Neon User database (branched)

## Next Steps

1. **Phase 2 (Current)**: Fix remaining ~12 services
2. **Phase 3**: Remove sync-bridge system
3. **Phase 4**: Disable `USE_NEON_ROUTING` flag (always use Neon)

## Phase 3 Exit Criteria

Before removing sync-bridge.ts and sync-scheduler.ts:

1. **Zero direct `db` usage** for shared/user tables in all server code
2. **Verification scripts pass**: `scripts/check-neon-full-status.ts`, `scripts/check-all-shared-tables.ts`
3. **Production shadow run** confirms no writes to Replit DB when `USE_NEON_ROUTING=true`
4. **Operational tests** cover teaching, usage/billing, and pronunciation flows
5. **One week soak period** with no data inconsistencies reported
