import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function testNeonConnections() {
  console.log("\n=== Testing Neon Database Connections ===\n");
  
  const sharedUrl = process.env.NEON_SHARED_DATABASE_URL;
  const userUrl = process.env.NEON_USER_DATABASE_URL;
  
  console.log("Shared URL configured:", sharedUrl ? "YES" : "NO");
  console.log("User URL configured:", userUrl ? "YES" : "NO");
  
  if (sharedUrl) {
    console.log("\n--- Testing SHARED database ---");
    try {
      const pool = new Pool({ connectionString: sharedUrl });
      const result = await pool.query('SELECT current_database() as db, current_user as usr, version() as ver');
      console.log("✓ Connected to:", result.rows[0].db);
      console.log("  User:", result.rows[0].usr);
      console.log("  Version:", result.rows[0].ver.substring(0, 50) + "...");
      
      const tables = await pool.query("SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'");
      console.log("  Tables in public schema:", tables.rows[0].cnt);
      
      await pool.end();
    } catch (err: any) {
      console.log("✗ Failed:", err.message);
    }
  }
  
  if (userUrl) {
    console.log("\n--- Testing USER database ---");
    try {
      const pool = new Pool({ connectionString: userUrl });
      const result = await pool.query('SELECT current_database() as db, current_user as usr');
      console.log("✓ Connected to:", result.rows[0].db);
      console.log("  User:", result.rows[0].usr);
      
      const tables = await pool.query("SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'");
      console.log("  Tables in public schema:", tables.rows[0].cnt);
      
      await pool.end();
    } catch (err: any) {
      console.log("✗ Failed:", err.message);
    }
  }
  
  console.log("\n=== Test Complete ===\n");
}

testNeonConnections().catch(console.error);
