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
- `competency-verifier.ts` (FIXED Jan 2026 - syllabusProgress to getUserDb)
- `fluency-wiring-service.ts` (FIXED Jan 2026 - studentCanDoProgress, actflAssessmentEvents to getUserDb)
- `conversation-tagger.ts` (FIXED Jan 2026 - conversationTopics, conversations to getUserDb)
- `usage-service.ts` (FIXED Jan 2026 - syllabus_progress query to getUserDb)
- `azure-pronunciation-service.ts` (FIXED Jan 2026 - phonemeStruggles to getUserDb)
- `daniela-reflection.ts` (FIXED Jan 2026 - danielaSuggestions to getSharedDb)
- `surgery-insight-service.ts` (FIXED Jan 2026 - tutorProcedures, teachingPrinciples, toolKnowledge, situationalPatterns to getSharedDb)

## Services Needing Routing Review ⚠️

### High Priority (Actively Used in Teaching/Revenue) ✅ COMPLETE

All high-priority services have been fixed (Jan 2026):

1. ~~**competency-verifier.ts**~~ → FIXED
2. ~~**fluency-wiring-service.ts**~~ → FIXED
3. ~~**conversation-tagger.ts**~~ → FIXED
4. ~~**usage-service.ts**~~ → FIXED
5. ~~**azure-pronunciation-service.ts**~~ → FIXED

### Medium Priority (Editor/Collaboration Features) - BLOCKED

These services use tables not yet classified in `server/neon-db.ts`:

4. **collaboration-hub-service.ts** - `collaboration_events`, `collaboration_participants` (need classification)
5. **editor-feedback-service.ts** - `collaboration_channels`, `editor_listening_snapshots` (need classification)
6. **editor-realtime-dispatcher.ts** - `editor_beacon_queue`, `editor_listening_snapshots` (need classification)
7. **architect-voice-service.ts** - `architect_notes` (need classification)

**ACTION REQUIRED**: Add these tables to SHARED_TABLES or USER_TABLES in `server/neon-db.ts` before routing can proceed.

### Lower Priority (Admin/Surgery Features) ✅ MOSTLY COMPLETE

6. ~~**daniela-reflection.ts**~~ → FIXED (getSharedDb for danielaSuggestions)
7. ~~**surgery-insight-service.ts**~~ → FIXED (getSharedDb for neural network tables)

8. **architect-voice-service.ts** - `architectNotes` table not yet classified in neon-db.ts

### Deprecated (No Routing Changes Needed)

- **editor-persona-service.ts** - Marked deprecated in code, uses unclassified editor tables. Will be removed with editor system.

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
