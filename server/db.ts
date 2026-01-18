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
const USE_NEON_ROUTING = process.env.USE_NEON_ROUTING === 'true';

// Startup health check for Neon routing
if (USE_NEON_ROUTING) {
  if (!NEON_SHARED_URL) {
    console.warn("[DB] ⚠️ USE_NEON_ROUTING=true but NEON_SHARED_DATABASE_URL is missing - falling back to Replit DB for shared tables");
  } else {
    console.log("[DB] ✓ Neon routing ENABLED for shared tables (lazy init)");
  }
  if (!NEON_USER_URL) {
    console.log("[DB] Note: NEON_USER_DATABASE_URL not set - user tables use Replit DB");
  }
} else {
  console.log("[DB] Neon routing DISABLED - all queries use Replit DB");
}

let neonSharedPool: Pool | null = null;
let neonUserPool: Pool | null = null;
let _neonSharedDb: ReturnType<typeof drizzle> | null = null;
let _neonUserDb: ReturnType<typeof drizzle> | null = null;

export function isNeonRoutingEnabled(): boolean {
  return USE_NEON_ROUTING && Boolean(NEON_SHARED_URL);
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
  if (!USE_NEON_ROUTING) {
    return db;
  }
  
  const dbType = getTableDatabase(tableName);
  if (dbType === 'shared' && NEON_SHARED_URL) {
    return getNeonSharedDb();
  }
  if (dbType === 'user' && NEON_USER_URL) {
    return getNeonUserDb();
  }
  
  return db;
}

export function getSharedDb() {
  if (USE_NEON_ROUTING && NEON_SHARED_URL) {
    return getNeonSharedDb();
  }
  return db;
}

export function getUserDb() {
  if (USE_NEON_ROUTING && NEON_USER_URL) {
    return getNeonUserDb();
  }
  return db;
}

export { SHARED_TABLES };
