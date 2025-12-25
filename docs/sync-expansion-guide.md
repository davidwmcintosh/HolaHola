# Dev-Prod Sync Expansion Guide

This guide documents the complete process for adding new data types to the bidirectional sync system. Follow these steps when expanding the neural network or adding any new syncable data.

## Overview

The sync system uses a batched architecture to transfer data between development and production environments. Each batch type represents a category of data (e.g., `neural-core`, `advanced-intel-a`, `beta-usage`).

**Key Files:**
- `server/services/sync-bridge.ts` - Core sync logic
- `shared/schema.ts` - Database schema and types
- `client/src/pages/admin/SyncControlCenter.tsx` - Admin UI
- `server/routes.ts` - API endpoints

## Step-by-Step Process

### 1. Update Schema (if needed)

If your new data type requires new enum values or tables:

**For new enum values:**
```typescript
// shared/schema.ts
export const hiveSnapshotTypeEnum = pgEnum("hive_snapshot_type", [
  // ... existing values
  'your_new_type'  // Add here
]);

// Also update the TypeScript type
export type HiveSnapshotType = '...' | 'your_new_type';
```

**IMPORTANT:** After adding enum values to schema.ts, you must also add them to the database:
```sql
ALTER TYPE enum_name ADD VALUE IF NOT EXISTS 'new_value';
```

### 2. Update Sync Bridge Constants

In `server/services/sync-bridge.ts`:

**a) Add to SUPPORTED_BATCHES:**
```typescript
const SUPPORTED_BATCHES = [
  'neural-core',
  'advanced-intel-a',
  // ... existing batches
  'your-new-batch',  // Add here
] as const;
```

**b) Bump the version:**
```typescript
const SYNC_BRIDGE_CODE_VERSION = "YYYY-MM-DD-vXX-description";
```

### 3. Add Export Logic

In `collectExportBundle()` method of sync-bridge.ts:

```typescript
// BATCH: your-new-batch - Description of what this exports
if (!batchType || batchType === 'your-new-batch') {
  try {
    const data = await this.exportYourNewData();
    bundle.yourNewData = data;
    console.log(`[SYNC-BRIDGE] your-new-batch: ${data.length} items`);
  } catch (err: any) {
    const errMsg = `your-new-batch export failed: ${err.message}`;
    console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
    batchErrors.push(errMsg);
    bundle.yourNewData = [];
  }
}
```

### 4. Add Import Logic

In `applyImportBundle()` method of sync-bridge.ts:

```typescript
// Import your new data
if (bundle.yourNewData && Array.isArray(bundle.yourNewData)) {
  console.log(`[SYNC-BRIDGE] Importing ${bundle.yourNewData.length} items...`);
  for (const item of bundle.yourNewData) {
    try {
      // Upsert logic here
      await db.insert(yourTable).values(item)
        .onConflictDoUpdate({
          target: yourTable.id,
          set: { ...item, updatedAt: new Date() }
        });
      counts['yourNewData'] = (counts['yourNewData'] || 0) + 1;
    } catch (err: any) {
      errors.push(`yourNewData ${item.id}: ${err.message}`);
    }
  }
}
```

### 5. Update SyncBundle Interface

In sync-bridge.ts, add to the SyncBundle interface:

```typescript
interface SyncBundle {
  // ... existing fields
  yourNewData?: YourDataType[];
}
```

### 6. Update UI (for selective sync)

In `client/src/pages/admin/SyncControlCenter.tsx`:

**For push batches (dev → prod):**
```typescript
const PUSH_BATCHES = [
  // ... existing
  { id: 'your-new-batch', label: 'Your Label', description: 'Brief description' },
];
```

**For pull batches (prod → dev):**
```typescript
const PULL_BATCHES = [
  // ... existing
  { id: 'your-new-batch', label: 'Your Label', description: 'Brief description' },
];
```

### 7. Update Pull Logic (if adding pull-only batches)

In `pullFromPeer()` method, update the batch types array:

```typescript
const allBatchTypes = [
  'neural-core', 'advanced-intel-a', 'advanced-intel-b',
  // ... existing
  'your-new-batch'  // Add here
];
```

### 8. Deploy & Database Sync

**Development:**
1. Make all code changes
2. Add enum values to dev database: `ALTER TYPE enum_name ADD VALUE IF NOT EXISTS 'new_value';`
3. Test locally

**Production:**
1. Publish to production
2. Add enum values to prod database (via production database pane or migration)
3. Verify capabilities match in Sync Control Center

### 9. Test the Sync

1. Go to `/admin/sync` (Sync Control Center)
2. Check that both environments show the same version (green checkmark)
3. Test push/pull with your new batch selected
4. Verify data appears correctly in target environment

## Batch Naming Conventions

- Use kebab-case: `neural-core`, `beta-usage`
- Group related data: `advanced-intel-a`, `advanced-intel-b`
- Prefix pull-only batches descriptively: `beta-usage`, `aggregate-analytics`

## Capability Negotiation

The sync system gracefully handles version mismatches:
- Unknown batch types are logged but don't break sync (soft-fail)
- Version comparison shows in UI to guide deploy workflow
- Deploy code to both environments before syncing new batch types

## Common Issues

### "invalid input value for enum"
The database enum doesn't have the new value. Run:
```sql
ALTER TYPE enum_name ADD VALUE IF NOT EXISTS 'new_value';
```

### "Unknown batch type" in logs
The receiving environment doesn't have code for the new batch. Deploy code first.

### Timeout errors
Large datasets may timeout. Consider:
- Splitting into multiple batches (like `advanced-intel-a` and `advanced-intel-b`)
- Adding pagination (see observations pattern in `advanced-intel-b`)

## Pagination Pattern

For large datasets, implement pagination:

```typescript
if (batchType === 'your-large-batch' || batchType.startsWith('your-large-batch-p')) {
  const page = batchType.match(/-p(\d+)$/)?.[1] || 0;
  const offset = Number(page) * PAGE_SIZE;
  
  const data = await db.select().from(yourTable)
    .limit(PAGE_SIZE)
    .offset(offset);
  
  bundle.yourData = data;
  bundle.pagination = {
    offset,
    limit: PAGE_SIZE,
    hasMore: data.length === PAGE_SIZE
  };
}
```

## Checklist

- [ ] Schema updated (if new tables/enums)
- [ ] Database enum values added (both dev and prod)
- [ ] SUPPORTED_BATCHES updated
- [ ] SYNC_BRIDGE_CODE_VERSION bumped
- [ ] Export logic added in collectExportBundle()
- [ ] Import logic added in applyImportBundle()
- [ ] SyncBundle interface updated
- [ ] UI batch lists updated (PUSH_BATCHES/PULL_BATCHES)
- [ ] Pull logic updated (if pull-only batch)
- [ ] Code deployed to both environments
- [ ] Tested push/pull works correctly
