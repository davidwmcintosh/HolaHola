import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// ===== SINGLE DATABASE ARCHITECTURE =====
// Consolidated to one Neon database for simplicity.
// All tables now live in the same database.

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("[DB] FATAL: DATABASE_URL is required");
}

console.log("[DB] ✓ Neon database configured");

let pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
    _db = drizzle({ client: pool, schema });
    console.log("[DB] Database pool initialized");
  }
  return _db!;
}

// Backwards compatibility - all point to same database now
export function getSharedDb() {
  return getDb();
}

export function getUserDb() {
  return getDb();
}

export function getNeonSharedDb() {
  return getDb();
}

export function getNeonUserDb() {
  return getDb();
}

export function getDbForTable(_tableName: string) {
  return getDb();
}

export function isNeonRoutingEnabled(): boolean {
  return true;
}

// Legacy exports for compatibility
export { pool };
export const db = getDb();
