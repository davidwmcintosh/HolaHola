import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const NEON_SHARED_URL = process.env.NEON_SHARED_DATABASE_URL;
const NEON_USER_URL = process.env.NEON_USER_DATABASE_URL;

let sharedPool: Pool | null = null;
let userPool: Pool | null = null;
let sharedDb: ReturnType<typeof drizzle> | null = null;
let userDb: ReturnType<typeof drizzle> | null = null;

export function isNeonConfigured(): boolean {
  return Boolean(NEON_SHARED_URL) && Boolean(NEON_USER_URL);
}

export function getSharedDb() {
  if (!NEON_SHARED_URL) {
    throw new Error("NEON_SHARED_DATABASE_URL is not configured");
  }
  
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: NEON_SHARED_URL });
    sharedDb = drizzle({ client: sharedPool, schema });
    console.log("[Neon] Shared database pool initialized");
  }
  
  return sharedDb!;
}

export function getUserDb() {
  if (!NEON_USER_URL) {
    throw new Error("NEON_USER_DATABASE_URL is not configured");
  }
  
  if (!userPool) {
    userPool = new Pool({ connectionString: NEON_USER_URL });
    userDb = drizzle({ client: userPool, schema });
    console.log("[Neon] User database pool initialized");
  }
  
  return userDb!;
}

export async function testNeonConnection(): Promise<{ 
  shared: { success: boolean; message: string }; 
  user: { success: boolean; message: string };
}> {
  const results = {
    shared: { success: false, message: "Not tested" },
    user: { success: false, message: "Not tested" }
  };
  
  if (!NEON_SHARED_URL) {
    results.shared = { success: false, message: "NEON_SHARED_DATABASE_URL not configured" };
  } else {
    try {
      const testPool = new Pool({ connectionString: NEON_SHARED_URL });
      const result = await testPool.query('SELECT current_database(), current_user, version()');
      const row = result.rows[0];
      results.shared = { 
        success: true, 
        message: `Connected to ${row.current_database} as ${row.current_user}` 
      };
      await testPool.end();
    } catch (error: any) {
      results.shared = { success: false, message: error.message };
    }
  }
  
  if (!NEON_USER_URL) {
    results.user = { success: false, message: "NEON_USER_DATABASE_URL not configured" };
  } else {
    try {
      const testPool = new Pool({ connectionString: NEON_USER_URL });
      const result = await testPool.query('SELECT current_database(), current_user, version()');
      const row = result.rows[0];
      results.user = { 
        success: true, 
        message: `Connected to ${row.current_database} as ${row.current_user}` 
      };
      await testPool.end();
    } catch (error: any) {
      results.user = { success: false, message: error.message };
    }
  }
  
  return results;
}

export async function closeNeonConnections(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
    sharedDb = null;
    console.log("[Neon] Shared database pool closed");
  }
  
  if (userPool) {
    await userPool.end();
    userPool = null;
    userDb = null;
    console.log("[Neon] User database pool closed");
  }
}
