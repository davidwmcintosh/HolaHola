/**
 * Applies the additive context-lineage ledger schema and verifies that its
 * database-level immutability guards exist.
 *
 * This script intentionally does not enable CONTEXT_LINEAGE_LEDGER_ENABLED.
 * Schema presence is separate from runtime producer coverage.
 *
 * Usage:
 *   npx tsx server/scripts/apply-context-lineage-ledger.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

import { getMonitoringDb } from "../db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../..");
const migrationPath = resolve(root, "migrations/0017_context_lineage_ledger.sql");

export function splitSqlStatements(source: string): string[] {
  // SQL line comments are not string literals. Strip them before quote tracking:
  // an apostrophe in prose such as "Daniela's" must not turn the rest of the
  // migration into one apparent single-quoted literal.
  const sqlSource = source.replace(/^--.*$/gm, "");
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;

  for (let index = 0; index < sqlSource.length; index += 1) {
    const char = sqlSource[index];
    const next = sqlSource[index + 1];

    if (!inSingleQuote && !inDoubleQuote && char === "$" && next === "$") {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      index += 1;
      continue;
    }
    if (!inDollarQuote && !inDoubleQuote && char === "'" && sqlSource[index - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (!inDollarQuote && !inSingleQuote && char === '"' && sqlSource[index - 1] !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export async function applyContextLineageLedger(): Promise<void> {
  const migration = readFileSync(migrationPath, "utf8");
  const statements = splitSqlStatements(migration);
  const db = getMonitoringDb();

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }

  const verification = await db.execute(sql`
    SELECT
      (SELECT count(*)::int
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('context_lineage_events', 'context_lineage_links')) AS table_count,
      (SELECT count(*)::int
       FROM pg_trigger
       WHERE NOT tgisinternal
         AND tgname IN ('context_lineage_events_immutable', 'context_lineage_links_immutable')) AS trigger_count
  `);
  const row = (verification as any).rows?.[0] ?? (verification as any)[0];
  if (Number(row?.table_count) !== 2 || Number(row?.trigger_count) !== 2) {
    throw new Error(
      `Context-lineage verification failed: tables=${row?.table_count ?? "unknown"}, triggers=${row?.trigger_count ?? "unknown"}`,
    );
  }

  console.log("[context-lineage] ✓ ledger tables and immutable triggers verified");
}

// Exact basename is required. A test file such as
// apply-context-lineage-ledger.test.ts must be able to import the pure splitter
// without treating the import as permission to apply the shared schema.
const invokedDirectly = basename(process.argv[1] ?? "") === "apply-context-lineage-ledger.ts";
if (invokedDirectly) {
  applyContextLineageLedger().catch((error) => {
    console.error("[context-lineage] apply failed:", error);
    process.exitCode = 1;
  });
}