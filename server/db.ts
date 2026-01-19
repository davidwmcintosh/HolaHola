import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { SHARED_TABLES, getTableDatabase } from './neon-db';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

const NEON_SHARED_URL = process.env.NEON_SHARED_DATABASE_URL;
const NEON_USER_URL = process.env.NEON_USER_DATABASE_URL;

// Neon is now the permanent default - no routing flag needed
if (!NEON_SHARED_URL) {
  console.error("[DB] ⚠️ NEON_SHARED_DATABASE_URL missing - shared tables will fail!");
} else {
  console.log("[DB] ✓ Neon SHARED database configured");
}
if (NEON_USER_URL) {
  console.log("[DB] ✓ Neon USER database configured");
} else {
  console.log("[DB] Note: USER tables use Replit DB (NEON_USER_DATABASE_URL not set)");
}

let neonSharedPool: Pool | null = null;
let neonUserPool: Pool | null = null;
let _neonSharedDb: ReturnType<typeof drizzle> | null = null;
let _neonUserDb: ReturnType<typeof drizzle> | null = null;

export function isNeonRoutingEnabled(): boolean {
  return Boolean(NEON_SHARED_URL);
}

export function getNeonSharedDb() {
  if (!NEON_SHARED_URL) {
    throw new Error("NEON_SHARED_DATABASE_URL is not configured");
  }
  
  if (!neonSharedPool) {
    neonSharedPool = new Pool({ connectionString: NEON_SHARED_URL });
    _neonSharedDb = drizzle({ client: neonSharedPool, schema });
    console.log("[DB] Neon shared database pool initialized");
  }
  
  return _neonSharedDb!;
}

export function getNeonUserDb() {
  if (!NEON_USER_URL) {
    throw new Error("NEON_USER_DATABASE_URL is not configured");
  }
  
  if (!neonUserPool) {
    neonUserPool = new Pool({ connectionString: NEON_USER_URL });
    _neonUserDb = drizzle({ client: neonUserPool, schema });
    console.log("[DB] Neon user database pool initialized");
  }
  
  return _neonUserDb!;
}

export function getDbForTable(tableName: string) {
  const dbType = getTableDatabase(tableName);
  if (dbType === 'shared' && NEON_SHARED_URL) {
    return getNeonSharedDb();
  }
  if (dbType === 'user' && NEON_USER_URL) {
    return getNeonUserDb();
  }
  
  // Fallback to Replit DB for user tables when NEON_USER_URL not set
  return db;
}

export function getSharedDb() {
  if (NEON_SHARED_URL) {
    return getNeonSharedDb();
  }
  // Should not happen in production - Neon is required
  console.warn("[DB] getSharedDb() called but NEON_SHARED_DATABASE_URL not set!");
  return db;
}

export function getUserDb() {
  if (NEON_USER_URL) {
    return getNeonUserDb();
  }
  // User tables fall back to Replit DB if Neon user URL not configured
  return db;
}

export { SHARED_TABLES };
