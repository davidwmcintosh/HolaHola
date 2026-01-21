import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { SHARED_TABLES, getTableDatabase } from './neon-db';

neonConfig.webSocketConstructor = ws;

// ===== NEON-ONLY DATABASE ARCHITECTURE =====
// Replit DB has been fully retired. All tables route to Neon exclusively.
// - SHARED database: Daniela's intelligence, curriculum, hive collaboration
// - USER database: Per-environment user data (accounts, progress, sessions)

const NEON_SHARED_URL = process.env.NEON_SHARED_DATABASE_URL;
const NEON_USER_URL = process.env.NEON_USER_DATABASE_URL;

// Validate required Neon credentials
if (!NEON_SHARED_URL) {
  throw new Error("[DB] FATAL: NEON_SHARED_DATABASE_URL is required. Replit DB has been retired.");
}
if (!NEON_USER_URL) {
  throw new Error("[DB] FATAL: NEON_USER_DATABASE_URL is required. Replit DB has been retired.");
}

console.log("[DB] ✓ Neon SHARED database configured");
console.log("[DB] ✓ Neon USER database configured");
console.log("[DB] 🎉 Replit DB fully retired - all tables route to Neon");

let neonSharedPool: Pool | null = null;
let neonUserPool: Pool | null = null;
let _neonSharedDb: ReturnType<typeof drizzle> | null = null;
let _neonUserDb: ReturnType<typeof drizzle> | null = null;

export function isNeonRoutingEnabled(): boolean {
  return true; // Always true now - Neon only
}

export function getNeonSharedDb() {
  if (!neonSharedPool) {
    neonSharedPool = new Pool({ connectionString: NEON_SHARED_URL });
    _neonSharedDb = drizzle({ client: neonSharedPool, schema });
    console.log("[DB] Neon shared database pool initialized");
  }
  return _neonSharedDb!;
}

export function getNeonUserDb() {
  if (!neonUserPool) {
    neonUserPool = new Pool({ connectionString: NEON_USER_URL });
    _neonUserDb = drizzle({ client: neonUserPool, schema });
    console.log("[DB] Neon user database pool initialized");
  }
  return _neonUserDb!;
}

export function getDbForTable(tableName: string) {
  const dbType = getTableDatabase(tableName);
  if (dbType === 'shared') {
    return getNeonSharedDb();
  }
  if (dbType === 'user') {
    return getNeonUserDb();
  }
  throw new Error(`[DB] Unknown table routing for: ${tableName}. Add it to SHARED_TABLES or USER_TABLES in neon-db.ts`);
}

export function getSharedDb() {
  return getNeonSharedDb();
}

export function getUserDb() {
  return getNeonUserDb();
}

// Legacy exports for compatibility (both point to Neon now)
export const pool = neonSharedPool;
export const db = getNeonSharedDb();

export { SHARED_TABLES };
