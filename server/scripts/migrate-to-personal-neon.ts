/**
 * migrate-to-personal-neon.ts
 *
 * Copies all data from NEON_SHARED_DATABASE_URL (source) to
 * NEON_SHARED_DATABASE_URL_NEW (target).  Schema must already exist on target
 * (run db:push first).  Run with:
 *
 *   npx tsx server/scripts/migrate-to-personal-neon.ts
 *
 * Safe to re-run: TRUNCATEs each table before inserting.
 */

import { Pool } from 'pg';

const SRC_URL = process.env.NEON_SHARED_DATABASE_URL;
const DST_URL = process.env.NEON_SHARED_DATABASE_URL_NEW;

if (!SRC_URL) { console.error('NEON_SHARED_DATABASE_URL not set'); process.exit(1); }
if (!DST_URL) { console.error('NEON_SHARED_DATABASE_URL_NEW not set'); process.exit(1); }

const src = new Pool({ connectionString: SRC_URL, ssl: { rejectUnauthorized: false }, max: 5 });
const dst = new Pool({ connectionString: DST_URL, ssl: { rejectUnauthorized: false }, max: 5 });

const SKIP_TABLES = new Set(['__drizzle_migrations', 'spatial_ref_sys']);
const BATCH_SIZE  = 200; // rows per INSERT

async function query(pool: Pool, sql: string, params: any[] = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function getTables(pool: Pool): Promise<string[]> {
  const res = await query(pool, `
    SELECT tablename FROM pg_tables
    WHERE  schemaname = 'public'
    ORDER  BY tablename
  `);
  return res.rows.map(r => r.tablename).filter((t: string) => !SKIP_TABLES.has(t));
}

async function getRowCount(pool: Pool, table: string): Promise<number> {
  const res = await query(pool, `SELECT COUNT(*) AS cnt FROM "${table}"`);
  return Number(res.rows[0].cnt);
}

async function copyTable(table: string): Promise<number> {
  const total = await getRowCount(src, table);
  if (total === 0) {
    await query(dst, `TRUNCATE TABLE "${table}" CASCADE`);
    process.stdout.write(`  ✓ ${table}: 0 rows\n`);
    return 0;
  }

  // Read all rows from source
  const res = await query(src, `SELECT * FROM "${table}"`);
  const rows = res.rows;
  if (rows.length === 0) return 0;

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');

  await query(dst, `TRUNCATE TABLE "${table}" CASCADE`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Build multi-row INSERT: INSERT INTO t (c1,c2) VALUES ($1,$2),($3,$4),...
    const placeholders: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    for (const row of batch) {
      const rowPlaceholders = cols.map(() => `$${paramIdx++}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      for (const col of cols) values.push(row[col]);
    }

    await query(
      dst,
      `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values
    );
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}   `);
  }
  process.stdout.write(`\r  ✓ ${table}: ${inserted} rows\n`);
  return inserted;
}

async function main() {
  console.log('=== HolaHola DB Migration ===');
  console.log('Source:', SRC_URL!.match(/@([^/]+)/)?.[1] ?? 'source');
  console.log('Target:', DST_URL!.match(/@([^/]+)/)?.[1] ?? 'target');
  console.log('');

  const srcTables = await getTables(src);
  const dstTables = new Set(await getTables(dst));

  console.log(`Source tables: ${srcTables.length}`);
  console.log(`Target tables: ${dstTables.size}`);

  const missing = srcTables.filter(t => !dstTables.has(t));
  if (missing.length > 0) {
    console.warn(`\n⚠️  Tables in source but not in target — run db:push first:`);
    missing.forEach(t => console.warn(`   - ${t}`));
    process.exit(1);
  }

  // Disable all FK triggers on target tables for the duration of the copy.
  // Neon does not allow session_replication_role, so we disable triggers table-by-table.
  console.log('Disabling FK triggers on target...');
  for (const table of srcTables) {
    try { await query(dst, `ALTER TABLE "${table}" DISABLE TRIGGER ALL`); } catch { /* skip */ }
  }

  let totalCopied = 0;
  const failed: string[] = [];

  for (const table of srcTables) {
    try {
      totalCopied += await copyTable(table);
    } catch (err: any) {
      console.error(`\n  ✗ ${table}: ${err.message}`);
      failed.push(table);
    }
  }

  console.log('\nRe-enabling FK triggers on target...');
  for (const table of srcTables) {
    try { await query(dst, `ALTER TABLE "${table}" ENABLE TRIGGER ALL`); } catch { /* skip */ }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Total rows copied: ${totalCopied}`);

  if (failed.length > 0) {
    console.warn(`\nFailed tables (${failed.length}): ${failed.join(', ')}`);
    process.exit(1);
  }

  // Spot-check key tables
  const checks: [string, string][] = [
    ['memory_embeddings',    'memory_embeddings'],
    ['conversation_memories','conversation_memories'],
    ['users',                'users'],
  ];

  console.log('\n=== Spot Check ===');
  let allMatch = true;
  for (const [label, table] of checks) {
    const s = await getRowCount(src, table);
    const d = await getRowCount(dst, table);
    const ok = s === d;
    if (!ok) allMatch = false;
    console.log(`  ${label}: src=${s} dst=${d} ${ok ? '✓' : '✗ MISMATCH'}`);
  }

  await src.end();
  await dst.end();

  if (!allMatch) {
    console.error('\nRow count mismatch — do not cut over yet.');
    process.exit(1);
  }

  console.log(`
✅ Migration verified. Next steps:
  1. In Replit Secrets: update NEON_SHARED_DATABASE_URL to your personal Neon URL
  2. Delete NEON_SHARED_DATABASE_URL_NEW secret
  3. Update your local .env to match
  4. git pull + restart the app
`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  src.end().catch(() => {});
  dst.end().catch(() => {});
  process.exit(1);
});
