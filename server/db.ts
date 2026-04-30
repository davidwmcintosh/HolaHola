import { Pool, neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import ws from "ws";
import { createRequire } from 'module';
import path from 'path';
import * as schema from "@shared/schema";

// Patch ws ErrorEvent.message to add a no-op setter.
// Fixes: ws 8.18.x+ made ErrorEvent.message getter-only, but @neondatabase/serverless
// 0.10.x does `event.message = "..."` directly (strict-mode ESM → TypeError → FATAL crash).
// The setter is intentionally a no-op: Neon only sets it for its own logging purposes.
try {
  const _require = createRequire(import.meta.url);
  // ws/lib/event-target is not in ws's exports map; use direct file path to bypass
  const wsRoot = path.dirname(_require.resolve('ws/package.json'));
  const eventTargetPath = path.join(wsRoot, 'lib', 'event-target.js');
  const { ErrorEvent: WsErrorEvent } = _require(eventTargetPath) as Record<string, any>;
  if (WsErrorEvent?.prototype) {
    const desc = Object.getOwnPropertyDescriptor(WsErrorEvent.prototype, 'message');
    if (desc?.get && !desc.set) {
      Object.defineProperty(WsErrorEvent.prototype, 'message', {
        get: desc.get,
        set(_value: string) { /* intentional no-op: prevents FATAL crash */ },
        enumerable: desc.enumerable ?? true,
        configurable: true,
      });
      console.log('[DB] Applied ws ErrorEvent.message compatibility patch');
    }
  }
} catch (patchErr) {
  console.warn('[DB] ws ErrorEvent patch skipped (non-fatal):', patchErr);
}

neonConfig.webSocketConstructor = ws;

// ===== SINGLE DATABASE ARCHITECTURE =====
// Consolidated to one Neon database for simplicity.
// All tables now live in the same database.
const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("[DB] FATAL: NEON_SHARED_DATABASE_URL is required");
}
console.log("[DB] ✓ Neon database configured");

let pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 25,
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 20000,
    });
    _db = drizzle({ client: pool, schema });
    console.log("[DB] Database pool initialized (max: 25, idle: 2min, timeout: 20s)");

    // Keepalive heartbeat — prevents Neon serverless compute from auto-suspending.
    // Neon suspends after ~5min idle; a query every 3min keeps it warm and avoids
    // the 5-20s cold-start penalty that was stacking into 38s+ connection timeouts.
    const keepaliveInterval = setInterval(async () => {
      if (!pool) return;
      try {
        await pool.query('SELECT 1');
      } catch {
        // Pool will reconnect automatically on next real query
      }
    }, 3 * 60 * 1000);
    keepaliveInterval.unref(); // don't block process exit
  }
  return _db!;
}

// HTTP transport for read-only monitoring queries.
// Unlike the WebSocket pool, neon() sends each query as a plain HTTPS request —
// no persistent connection, no WebSocket, no connection pool exhaustion.
// Use for SELECT-only calls; use getDb()/getUserDb() for writes.
let _httpDb: ReturnType<typeof drizzleHttp<typeof schema>> | null = null;
export function getMonitoringDb() {
  if (!_httpDb) {
    const httpSql = neon(DATABASE_URL!);
    _httpDb = drizzleHttp(httpSql, { schema });
  }
  return _httpDb;
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

export async function closeDbConnections(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    _db = null;
    console.log("[DB] Database pool closed");
  }
}

// Legacy exports for compatibility
export { pool };
export const db = getDb();
