import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PostgresPool } from 'pg';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";
import { getVerifiedCiDatabaseUrl } from './ci-database';

neonConfig.webSocketConstructor = ws;

const CI_DATABASE_URL = getVerifiedCiDatabaseUrl();
const DATABASE_URL = CI_DATABASE_URL ?? process.env.NEON_SHARED_DATABASE_URL;
const usesCiDatabase = Boolean(CI_DATABASE_URL);

// ===== SINGLE DATABASE ARCHITECTURE =====
// All tables now live in one database. These exports remain for backwards compatibility.

export const SHARED_TABLES = new Set<string>();
export const USER_TABLES = new Set<string>();

export function getTableDatabase(_tableName: string): 'shared' | 'user' | 'unknown' {
  return 'shared';
}

export function getDbForTable(_tableName: string) {
  return getSharedDb();
}

type ApplicationDb = ReturnType<typeof drizzle>;
let pool: NeonPool | PostgresPool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function isNeonConfigured(): boolean {
  return Boolean(DATABASE_URL);
}

function getDb() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  
  if (!pool) {
    const poolOptions = {
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    if (usesCiDatabase) {
      const ciPool = new PostgresPool(poolOptions);
      pool = ciPool;
      db = drizzlePostgres({ client: ciPool, schema }) as unknown as ApplicationDb;
    } else {
      const neonPool = new NeonPool(poolOptions);
      pool = neonPool;
      db = drizzle({ client: neonPool, schema });
    }
  }
  
  return db!;
}

export function getSharedDb() {
  return getDb();
}

export function getUserDb() {
  return getDb();
}

export async function testNeonConnection(): Promise<{ 
  shared: { success: boolean; message: string }; 
  user: { success: boolean; message: string };
}> {
  const result = { success: false, message: "Not tested" };
  
  if (!DATABASE_URL) {
    return {
      shared: { success: false, message: "DATABASE_URL not configured" },
      user: { success: false, message: "DATABASE_URL not configured" }
    };
  }
  
  try {
    const testPool = usesCiDatabase
      ? new PostgresPool({ connectionString: DATABASE_URL })
      : new NeonPool({ connectionString: DATABASE_URL });
    const queryResult = await testPool.query('SELECT current_database(), current_user, version()');
    const row = queryResult.rows[0];
    const successResult = { 
      success: true, 
      message: `Connected to ${row.current_database} as ${row.current_user}` 
    };
    await testPool.end();
    return { shared: successResult, user: successResult };
  } catch (error: any) {
    const failResult = { success: false, message: error.message };
    return { shared: failResult, user: failResult };
  }
}

export async function warmupNeonPool(): Promise<void> {
  if (!DATABASE_URL) return;
  try {
    const start = Date.now();
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    console.log(`[Neon] Pool warmed up in ${Date.now() - start}ms`);
  } catch (error: any) {
    console.warn('[Neon] Pool warm-up failed:', error.message);
  }
}

export async function closeNeonConnections(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    console.log("[Neon] Database pool closed");
  }
}

export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
  max: number;
  pressurePercent: number;
}

export function getPoolStats(): PoolStats {
  if (!pool) {
    return { total: 0, idle: 0, waiting: 0, max: 20, pressurePercent: 0 };
  }
  const total = (pool as any).totalCount ?? 0;
  const idle = (pool as any).idleCount ?? 0;
  const waiting = (pool as any).waitingCount ?? 0;
  const max = 20;
  const pressurePercent = max > 0 ? Math.round(((total - idle) / max) * 100) : 0;
  return { total, idle, waiting, max, pressurePercent };
}
