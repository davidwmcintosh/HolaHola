import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function testNeonConnection() {
  console.log("\n=== Testing Neon Database Connection ===\n");
  
  const dbUrl = process.env.DATABASE_URL;
  
  console.log("DATABASE_URL configured:", dbUrl ? "YES" : "NO");
  
  if (dbUrl) {
    console.log("\n--- Testing database connection ---");
    try {
      const pool = new Pool({ connectionString: dbUrl });
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
  } else {
    console.log("DATABASE_URL not configured");
  }
  
  console.log("\n=== Test Complete ===\n");
}

testNeonConnection().catch(console.error);
