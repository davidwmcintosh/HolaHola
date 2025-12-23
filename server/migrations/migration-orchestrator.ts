/**
 * Migration Orchestrator - Rock-solid production database migrations
 * 
 * This system ensures new tables exist in production before any sync runs.
 * Uses versioned migrations with advisory locking for safety.
 * 
 * Key features:
 * - Versioned migrations tracked in schema_migrations table
 * - PostgreSQL advisory lock prevents concurrent migrations
 * - Idempotent - safe to run multiple times
 * - Auto-creates schema_migrations table if missing
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: Date;
}

interface Migration {
  version: string;
  name: string;
  up: () => Promise<void>;
}

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists
    `);
    return result.rows?.[0]?.exists === true;
  } catch (err) {
    return false;
  }
}

// All migrations in order - add new ones at the bottom
const MIGRATIONS: Migration[] = [
  {
    version: '001',
    name: 'tri-lane-tables',
    up: async () => {
      // Check if tables already exist (they may have been created by older migration)
      const agentExists = await tableExists('agent_observations');
      const supportExists = await tableExists('support_observations');
      const alertsExists = await tableExists('system_alerts');
      
      if (agentExists && supportExists && alertsExists) {
        console.log('[MIGRATIONS] Tri-lane tables already exist, skipping creation');
        return;
      }
      
      // Agent observations - insights from Replit Agent collaboration
      if (!agentExists) {
        await db.execute(sql`
          CREATE TABLE agent_observations (
            id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            category TEXT NOT NULL DEFAULT 'pattern',
            priority INTEGER DEFAULT 50,
            title VARCHAR(500) NOT NULL,
            observation TEXT NOT NULL,
            reasoning TEXT,
            evidence_count INTEGER DEFAULT 0,
            evidence_summary TEXT,
            related_files TEXT[] DEFAULT '{}',
            proposed_action TEXT,
            proposed_code TEXT,
            target_table VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            implemented_at TIMESTAMP,
            implemented_by VARCHAR(255),
            sync_status VARCHAR(50) DEFAULT 'pending',
            origin_id VARCHAR(255),
            origin_environment VARCHAR(50),
            origin_role VARCHAR(50),
            domain_tags TEXT[] DEFAULT '{}',
            intent_hash VARCHAR(255),
            acknowledged_by_daniela BOOLEAN DEFAULT false,
            acknowledged_by_support BOOLEAN DEFAULT false,
            acknowledged_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
      }
      
      // Support observations - user support insights  
      if (!supportExists) {
        await db.execute(sql`
          CREATE TABLE support_observations (
            id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            category TEXT NOT NULL DEFAULT 'feedback',
            priority INTEGER DEFAULT 50,
            title VARCHAR(500) NOT NULL,
            observation TEXT NOT NULL,
            reasoning TEXT,
            evidence_count INTEGER DEFAULT 0,
            evidence_summary TEXT,
            affected_user_count INTEGER DEFAULT 0,
            proposed_solution TEXT,
            proposed_faq_entry TEXT,
            escalation_needed BOOLEAN DEFAULT false,
            status VARCHAR(50) DEFAULT 'pending',
            resolved_at TIMESTAMP,
            resolved_by VARCHAR(255),
            resolution_notes TEXT,
            sync_status VARCHAR(50) DEFAULT 'pending',
            origin_id VARCHAR(255),
            origin_environment VARCHAR(50),
            origin_role VARCHAR(50),
            domain_tags TEXT[] DEFAULT '{}',
            intent_hash VARCHAR(255),
            acknowledged_by_editor BOOLEAN DEFAULT false,
            acknowledged_by_daniela BOOLEAN DEFAULT false,
            acknowledged_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
      }
      
      // System alerts - automated system health alerts
      if (!alertsExists) {
        await db.execute(sql`
          CREATE TABLE system_alerts (
            id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            severity TEXT NOT NULL DEFAULT 'info',
            title VARCHAR(500) NOT NULL,
            message TEXT NOT NULL,
            target TEXT DEFAULT 'all',
            affected_features TEXT[] DEFAULT '{}',
            is_dismissible BOOLEAN DEFAULT true,
            show_in_chat BOOLEAN DEFAULT false,
            show_as_banner BOOLEAN DEFAULT false,
            starts_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            is_active BOOLEAN DEFAULT true,
            created_by VARCHAR(255),
            view_count INTEGER DEFAULT 0,
            dismiss_count INTEGER DEFAULT 0,
            related_incident_id VARCHAR(255),
            resolved_by_alert_id VARCHAR(255),
            sync_status VARCHAR(50) DEFAULT 'pending',
            origin_id VARCHAR(255),
            origin_environment VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
      }
      
      // Create indexes for performance (IF NOT EXISTS handles existing indexes)
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_obs_intent ON agent_observations(intent_hash)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_obs_status ON agent_observations(status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_obs_intent ON support_observations(intent_hash)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_support_obs_status ON support_observations(status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_system_alerts_active ON system_alerts(is_active)`);
    }
  },
  // Add future migrations here with incrementing version numbers
  // {
  //   version: '002',
  //   name: 'next-feature-tables',
  //   up: async () => { ... }
  // }
];

export class MigrationOrchestrator {
  private readonly LOCK_ID = 123456789; // Advisory lock ID for migrations
  
  /**
   * Ensure schema_migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
  
  /**
   * Get list of already-applied migrations
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    try {
      const result = await db.execute(sql`SELECT version FROM schema_migrations`);
      const versions = new Set<string>();
      if (result.rows) {
        for (const row of result.rows) {
          versions.add((row as any).version);
        }
      }
      return versions;
    } catch (err) {
      // Table doesn't exist yet
      return new Set();
    }
  }
  
  /**
   * Record a migration as applied
   */
  private async recordMigration(version: string, name: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (${version}, ${name}, NOW())
      ON CONFLICT (version) DO NOTHING
    `);
  }
  
  /**
   * Acquire advisory lock for migrations (prevents concurrent runs)
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const result = await db.execute(sql`SELECT pg_try_advisory_lock(${this.LOCK_ID}) as acquired`);
      return result.rows?.[0]?.acquired === true;
    } catch (err) {
      console.error('[MIGRATIONS] Failed to acquire lock:', err);
      return false;
    }
  }
  
  /**
   * Release advisory lock
   */
  private async releaseLock(): Promise<void> {
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${this.LOCK_ID})`);
    } catch (err) {
      console.error('[MIGRATIONS] Failed to release lock:', err);
    }
  }
  
  /**
   * Run all pending migrations
   * Returns: { applied: string[], alreadyApplied: string[], errors: string[] }
   */
  async runMigrations(): Promise<{
    applied: string[];
    alreadyApplied: string[];
    errors: string[];
    success: boolean;
  }> {
    const applied: string[] = [];
    const alreadyApplied: string[] = [];
    const errors: string[] = [];
    
    // Acquire lock to prevent concurrent migrations
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      console.log('[MIGRATIONS] Another migration is running, skipping');
      return { applied, alreadyApplied, errors: ['Migration lock held by another process'], success: false };
    }
    
    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Get already-applied migrations
      const appliedSet = await this.getAppliedMigrations();
      
      // Run pending migrations in order
      for (const migration of MIGRATIONS) {
        if (appliedSet.has(migration.version)) {
          alreadyApplied.push(`${migration.version}_${migration.name}`);
          continue;
        }
        
        try {
          console.log(`[MIGRATIONS] Running ${migration.version}_${migration.name}...`);
          await migration.up();
          await this.recordMigration(migration.version, migration.name);
          applied.push(`${migration.version}_${migration.name}`);
          console.log(`[MIGRATIONS] ✓ Applied ${migration.version}_${migration.name}`);
        } catch (err: any) {
          const errorMsg = `Failed ${migration.version}_${migration.name}: ${err.message}`;
          console.error(`[MIGRATIONS] ✗ ${errorMsg}`);
          errors.push(errorMsg);
          // Stop on first error to maintain order
          break;
        }
      }
      
      return {
        applied,
        alreadyApplied,
        errors,
        success: errors.length === 0
      };
      
    } finally {
      await this.releaseLock();
    }
  }
  
  /**
   * Get migration status (for health checks)
   */
  async getStatus(): Promise<{
    totalMigrations: number;
    appliedCount: number;
    pendingCount: number;
    latestApplied: string | null;
    pending: string[];
    isUpToDate: boolean;
  }> {
    await this.ensureMigrationsTable();
    const appliedSet = await this.getAppliedMigrations();
    
    const pending = MIGRATIONS
      .filter(m => !appliedSet.has(m.version))
      .map(m => `${m.version}_${m.name}`);
    
    const appliedList = MIGRATIONS
      .filter(m => appliedSet.has(m.version))
      .map(m => `${m.version}_${m.name}`);
    
    return {
      totalMigrations: MIGRATIONS.length,
      appliedCount: appliedList.length,
      pendingCount: pending.length,
      latestApplied: appliedList.length > 0 ? appliedList[appliedList.length - 1] : null,
      pending,
      isUpToDate: pending.length === 0
    };
  }
  
  /**
   * Assert that specific tables exist (for sync endpoint guards)
   * Throws if tables missing and cannot be auto-created
   */
  async assertTablesExist(tableNames: string[]): Promise<{
    allExist: boolean;
    missing: string[];
    autoCreated: string[];
  }> {
    const missing: string[] = [];
    const autoCreated: string[] = [];
    
    for (const tableName of tableNames) {
      try {
        // Check if table exists
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          ) as exists
        `);
        
        if (!result.rows?.[0]?.exists) {
          missing.push(tableName);
        }
      } catch (err) {
        missing.push(tableName);
      }
    }
    
    // If any tables missing, run migrations to auto-create
    if (missing.length > 0) {
      console.log(`[MIGRATIONS] Tables missing: ${missing.join(', ')} - running migrations...`);
      const result = await this.runMigrations();
      if (result.success && result.applied.length > 0) {
        autoCreated.push(...missing);
        missing.length = 0; // Clear missing since we created them
      }
    }
    
    return {
      allExist: missing.length === 0,
      missing,
      autoCreated
    };
  }
}

// Singleton instance
export const migrationOrchestrator = new MigrationOrchestrator();

/**
 * Convenience function: Assert tri-lane tables are ready for sync
 * Call this before any sync operation that touches tri-lane tables
 */
export async function assertTriLaneReady(): Promise<boolean> {
  const result = await migrationOrchestrator.assertTablesExist([
    'agent_observations',
    'support_observations', 
    'system_alerts'
  ]);
  
  if (result.autoCreated.length > 0) {
    console.log(`[MIGRATIONS] Auto-created tri-lane tables: ${result.autoCreated.join(', ')}`);
  }
  
  if (!result.allExist) {
    console.error(`[MIGRATIONS] Missing tables after migration attempt: ${result.missing.join(', ')}`);
    return false;
  }
  
  return true;
}
