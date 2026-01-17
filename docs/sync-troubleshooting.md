# Sync Troubleshooting Guide

Last Updated: January 17, 2025

---

## January 17, 2025 - Investigation: Production Not Receiving All Batches

### Symptoms
The Sync Control Center shows:
- **Push**: All green (Today) - Development successfully pushing TO production
- **Data**: Some batches show "2 days ago" or "Never" - Production NOT pushing back

### Batches Receiving Data (Working)
| Batch | Last Received |
|-------|---------------|
| `product-config` | Today 16:56 |
| `hive-snapshots` | Today 16:56 |
| `advanced-intel-b` | Today 16:56 |
| `founder-context` | Today 11:44 |
| `express-lane` | Today 11:44 |
| `neural-core` | Today 11:00 |

### Batches NOT Receiving Data (Problem)
| Batch | Status |
|-------|--------|
| `daniela-memories` | Never received |
| `beta-usage` | Never received |
| `aggregate-analytics` | Never received |
| `advanced-intel-a` | Stale (not in recent imports) |

### Root Cause Analysis
1. **Production scheduler may not include all batches** - The sync scheduler on production might only push certain batches
2. **Some batches may be empty on production** - If production has no data for a batch, it won't push anything
3. **Schema mismatch** - Production may not have v40 schema changes yet (needs `db:push`)

### Diagnostic Queries
```sql
-- Check last received time per batch
SELECT DISTINCT batch_id, MAX(received_at) as last_received
FROM sync_import_receipts 
GROUP BY batch_id
ORDER BY last_received DESC;

-- Check recent sync runs
SELECT id, direction, status, started_at, completed_batches, error_message
FROM sync_runs 
ORDER BY started_at DESC 
LIMIT 10;
```

### Resolution Steps
1. **Verify production is awake**: `curl https://holahola.replit.app/api/sync/health`
2. **Check production code version**: Should be `2025-01-16-v40-delta-sync-all`
3. **Push schema to production**: Run `npm run db:push` on production
4. **Manually trigger full sync from production**: Use Sync Control Center on production to push all batches

---

## Current Version

**SYNC_BRIDGE_CODE_VERSION**: `2025-01-16-v40-delta-sync-all`

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
