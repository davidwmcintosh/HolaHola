# Sync Troubleshooting Guide

Last Updated: January 17, 2025

---

## January 17, 2025 - RESOLVED: FK Constraint Failures (v41)

### Problem Discovered
Push from dev to production was **silently failing** for most batches. The UI showed "success" but only `neural-core` was actually completing. All other batches failed with FK constraint errors.

### Root Cause
The `product-config` batch was pushing `catalogueClasses` (teacher_classes records) **before** the teacher users existed in production. This caused:
```
insert or update on table "teacher_classes" violates foreign key constraint "teacher_classes_teacher_id_users_id_fk"
```

### Fix Implemented (v41)
1. **Export**: The `product-config` batch now includes `classTeachers` - the teacher users who own the catalogue classes
2. **Import**: Teachers are imported BEFORE classes in `applyImportBundle()`
3. **New method**: `importClassTeacher()` upserts teacher users with proper conflict handling

### Key Code Changes
```typescript
// Export: Include teachers in product-config batch
const teacherIdSet = new Set(catalogueClasses.map(c => c.teacherId).filter(Boolean));
const teacherIds = Array.from(teacherIdSet);
if (teacherIds.length > 0) {
  const teachers = await db.select().from(users).where(inArray(users.id, teacherIds as string[]));
  bundle.classTeachers = teachers;
}

// Import: Process teachers BEFORE classes
if (bundle.classTeachers?.length) {
  await importWithCount('classTeachers', bundle.classTeachers,
    (teacher) => this.importClassTeacher(teacher));
}
// Then import catalogueClasses...
```

### Verification
After deploying v41, push operations should show teacher imports in logs:
```
[SYNC-BRIDGE v41] product-config: including 22 teachers for FK constraint
[SYNC-BRIDGE v41] Importing 22 Class Teachers (for FK constraint)...
```

---

## January 17, 2025 - Investigation: Production Not Receiving All Batches

### Initial Symptoms (Before v41 Fix)
The Sync Control Center showed:
- **Push**: All green (Today) - But this was misleading!
- **Data**: Some batches show "2 days ago" or "Never"

### Actual Issue
Looking at `sync_runs` table:
- Last "successful" push only completed `neural-core`
- All other batches had FK constraint errors logged in `error_message`

### Diagnostic Queries
```sql
-- Check last received time per batch
SELECT DISTINCT batch_id, MAX(received_at) as last_received
FROM sync_import_receipts 
GROUP BY batch_id
ORDER BY last_received DESC;

-- Check recent sync runs INCLUDING error_message
SELECT id, direction, status, started_at, completed_batches, 
       LEFT(error_message, 200) as error_preview
FROM sync_runs 
WHERE direction = 'push'
ORDER BY started_at DESC 
LIMIT 10;
```

### Lesson Learned
Always check `error_message` in sync_runs - the UI can show "success" even when batches fail.

---

## Current Version

**SYNC_BRIDGE_CODE_VERSION**: `2025-01-17-v41-fk-constraint-fix`

## Recent Changes (v40 - Delta Sync All)

### Problem Solved
Previously, curriculum syncs transferred the entire 98K+ drill items dataset on every sync operation. This was slow and bandwidth-intensive.

### Solution Implemented
Added `updatedAt` timestamps to all curriculum tables, enabling delta sync filtering. Now subsequent syncs only transfer records modified since the last successful push.

### Tables with Delta Sync Support
All curriculum tables now have `createdAt` and `updatedAt` columns:
- `grammarExercises`
- `culturalTips`
- `canDoStatements`
- `lessonCanDoStatements`
- `lessonCulturalTips`
- `lessonVisualAids`
- `culturalTipMedia`
- `curriculumDrillItems`
- `grammarCompetencies`

### How Delta Sync Works

1. **Export Phase**: When `incrementalSince` timestamp is provided:
   ```typescript
   // In sync-bridge.ts exportBundle()
   const drills = incrementalSince
     ? await db.select().from(curriculumDrillItems)
         .where(gt(curriculumDrillItems.updatedAt, incrementalSince))
     : await db.select().from(curriculumDrillItems);
   ```

2. **Import Phase**: All import methods preserve incoming `updatedAt`:
   ```typescript
   await db.update(table).set({
     ...fields,
     updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
   });
   ```

3. **Sync Control Center**: Automatically uses `lastSuccessfulPush` timestamp to trigger delta mode

## Sync Batches

| Batch | Contents | Size |
|-------|----------|------|
| `core` | Users, conversations, vocabulary, progress | Variable |
| `curriculum` | Lessons, units, modules | ~500 records |
| `actfl-core` | grammarCompetencies, canDoStatements, lessonCanDoStatements, culturalTips, lessonCulturalTips, culturalTipMedia | ~3K records |
| `curriculum-drills-p0`, `p1`, etc. | curriculumDrillItems (paginated 500/page), grammarExercises, lessonVisualAids | 98K+ drills |

## Common Issues

### Issue: 413 Request Entity Too Large
**Cause**: Attempting to sync curriculum-drills without pagination
**Solution**: v39 added pagination - drills sync in 500-item pages (`curriculum-drills-p0`, `curriculum-drills-p1`, etc.)

### Issue: Sync stuck at "running"
**Cause**: Previous sync failed mid-operation
**Solution**: v37 added resumable sync detection - the Sync Control Center shows a "Resume" button if a recent sync has progress

### Issue: Peer environment sleeping
**Cause**: Replit puts inactive apps to sleep
**Solution**: v36 added peer wake-up - system pings health endpoint with exponential backoff (10s, 20s, 40s) before sync

### Issue: Full sync taking too long
**Cause**: Syncing all 98K+ records on every push
**Solution**: v40 delta sync - only transfers records with `updatedAt > lastSuccessfulPush`

## Key Files

| File | Purpose |
|------|---------|
| `server/services/sync-bridge.ts` | Core sync logic, export/import methods |
| `shared/schema.ts` | Database schema with timestamp columns |
| `server/middleware/sync-auth.ts` | HMAC authentication for sync endpoints |
| `client/src/pages/admin/SyncControlCenter.tsx` | Admin UI for sync operations |

## Verification Steps

### Check Version
```bash
curl -s https://your-app.replit.dev/api/sync/health | jq '.codeVersion'
# Should return: "2025-01-16-v40-delta-sync-all"
```

### Check Delta Sync is Working
In sync logs, look for:
```
[SYNC-BRIDGE] actfl-core (delta): 0 grammar-comp, 2 can-do, 0 lesson-can-do...
[SYNC-BRIDGE] curriculum-drills page 0 (delta): 5 drills...
```

"delta" mode means only changed records are being synced. "full" means all records.

### Force Full Sync
If delta sync is missing records, remove `incrementalSince` from the sync request to force a full sync.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SYNC_SHARED_SECRET` | HMAC authentication key (must match between dev/prod) |
| `PEER_ENVIRONMENT_URL` | URL of the other environment for bidirectional sync |
| `NODE_ENV` | Determines if running in development or production |

## Rollback Procedure

If v40 causes issues:
1. Check database schema - ensure `updatedAt` columns exist on all curriculum tables
2. Run `npm run db:push` to sync schema
3. If import fails, check that incoming records have valid `updatedAt` values
4. Fall back to full sync by not providing `incrementalSince` parameter
