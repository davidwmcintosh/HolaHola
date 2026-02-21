import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;

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

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function isNeonConfigured(): boolean {
  return Boolean(DATABASE_URL);
}

function getDb() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    db = drizzle({ client: pool, schema });
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
    const testPool = new Pool({ connectionString: DATABASE_URL });
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
