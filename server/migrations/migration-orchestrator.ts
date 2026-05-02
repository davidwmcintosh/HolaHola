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
  {
    version: '002',
    name: 'bust-greeting-image-cache-for-character-profiles',
    up: async () => {
      // Greeting and farewell image prompts were updated to embed consistent
      // recurring character descriptions (Daniela+Marco for Spanish, Sophie+Pierre
      // for French, Anna+Klaus for German, Giulia+Luca for Italian, Ana+João for
      // Portuguese). Delete stale cached images so they regenerate with the new
      // character-consistent prompts on next access.
      //
      // NOTE: This migration was applied in environments where it ran correctly,
      // but a normalization gap was later identified. Migration 003 handles the
      // complete bust using GREETINGS_CACHE_KEYS. This entry is preserved for
      // idempotency tracking only — 003 is the definitive one.
      console.log('[MIGRATIONS] 002: bust-greeting-image-cache-for-character-profiles (superseded by 003, no-op if 003 applied)');
    },
  },
  {
    version: '003',
    name: 'bust-greeting-image-cache-complete',
    up: async () => {
      // Authoritative cache bust for greeting/farewell images updated with
      // CHARACTER_PROFILES character descriptions.
      //
      // Uses bustVocabImageCache (which delegates to GREETINGS_CACHE_KEYS /
      // toCacheKey normalization) so that:
      //  1. Exact phrase keys are deleted (e.g. vocab_french_excusezmoi).
      //  2. Fallback component-word keys for multi-word phrases are also deleted
      //     (e.g. vocab_spanish_buenos + vocab_spanish_dias for "buenos dias"),
      //     preventing stale individual-word cache hits from being served instead
      //     of a freshly generated character-consistent phrase image.
      const { GREETINGS_CACHE_KEYS, bustVocabImageCache } = await import('../services/vocab-image-seed-service');
      const languages = ['spanish', 'french', 'german', 'italian', 'portuguese'];

      // Verify media_files table exists before running deletes
      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'media_files'
        ) AS exists
      `);
      if (!tableCheck.rows?.[0]?.exists) {
        console.log('[MIGRATIONS] 003: media_files table not found — skipping greeting cache bust');
        return;
      }

      let totalDeleted = 0;
      for (const lang of languages) {
        const keys = GREETINGS_CACHE_KEYS[lang] ?? [];
        if (keys.length > 0) {
          try {
            const deleted = await bustVocabImageCache(keys);
            totalDeleted += deleted;
          } catch (err: any) {
            console.warn(`[MIGRATIONS] 003: Error busting cache for ${lang}:`, err.message);
          }
        }
      }
      console.log(`[MIGRATIONS] 003: Cleared ${totalDeleted} stale greeting image cache entries (including fallback component keys) across 5 languages`);
    },
  },
  {
    version: '004',
    name: 'elder-characters-english-cache-and-see-you-soon-drills',
    up: async () => {
      // ── Part A: Bust English greeting cache + elder-character farewell words ──
      // Migration 003 busted ES/FR/DE/IT/PT but missed English entirely.
      // Additionally, farewell words in FR/DE/IT/PT/EN now use grandmother/elder
      // character prompts (grandmère Colette, Oma Helga, nonna Carmela, avó Maria,
      // grandma Dorothy) matching the Spanish abuela Rosa pattern. Their cached
      // images must be deleted so they regenerate with the new warm family scenes.
      const { bustVocabImageCache, toCacheKey, GREETINGS_CACHE_KEYS } = await import('../services/vocab-image-seed-service');

      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'media_files'
        ) AS exists
      `);

      if (tableCheck.rows?.[0]?.exists) {
        let totalDeleted = 0;

        // A1: Bust ALL English greetings (absent from migration 003)
        const englishKeys = GREETINGS_CACHE_KEYS['english'] ?? [];
        if (englishKeys.length > 0) {
          totalDeleted += await bustVocabImageCache(englishKeys);
        }

        // A2: Bust farewell words across other languages that now use elder characters
        const elderFarewells: Record<string, string[]> = {
          french:     ['au revoir', 'à bientôt'],
          german:     ['auf Wiedersehen', 'bis später'],
          italian:    ['arrivederci', 'a presto'],
          portuguese: ['adeus', 'até logo'],
        };
        for (const [lang, words] of Object.entries(elderFarewells)) {
          const keys = words.map((w: string) => toCacheKey(lang, w));
          try {
            totalDeleted += await bustVocabImageCache(keys);
          } catch (err: any) {
            console.warn(`[MIGRATIONS] 004: Error busting ${lang} farewell keys:`, err.message);
          }
        }

        console.log(`[MIGRATIONS] 004: Cleared ${totalDeleted} stale image entries for English greetings + elder-character farewells`);
      } else {
        console.log('[MIGRATIONS] 004: media_files table not found — skipping cache bust');
      }

      // ── Part B: Add "see you soon" as curriculum drill items ──
      // "hasta pronto" (ES), "à bientôt" (FR), "bis später" (DE), "a presto" (IT),
      // "até logo" (PT), "see you soon" (EN) have scene overrides and cached images
      // but are absent from curriculum_drill_items — so they never appear in the
      // textbook Visual Vocabulary grid.
      const lessonsCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'curriculum_lessons'
        ) AS exists
      `);
      if (!lessonsCheck.rows?.[0]?.exists) {
        console.log('[MIGRATIONS] 004: curriculum_lessons not found — skipping drill items');
        return;
      }

      // [targetText, englishPrompt, targetLanguage]
      const drillWords: Array<[string, string, string]> = [
        ['hasta pronto', 'see you soon', 'spanish'],
        ['à bientôt',    'see you soon', 'french'],
        ['bis später',   'see you soon', 'german'],
        ['a presto',     'see you soon', 'italian'],
        ['até logo',     'see you soon', 'portuguese'],
        ['see you soon', 'see you soon', 'english'],
      ];

      let drillItemsAdded = 0;

      for (const [targetText, englishPrompt, targetLanguage] of drillWords) {
        // Find the greetings lesson for this language
        // Note: curriculum_paths uses "language" column (not "target_language")
        const lessonResult = await db.execute(sql`
          SELECT cl.id
          FROM curriculum_lessons cl
          JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
          JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
          WHERE cp.language = ${targetLanguage}
            AND (
              cl.name ILIKE '%Greetings%Farewells%'
              OR cl.name ILIKE '%Salutations%'
            )
          ORDER BY cl.order_index ASC
          LIMIT 1
        `);

        if (!lessonResult.rows || lessonResult.rows.length === 0) {
          console.log(`[MIGRATIONS] 004: No greetings lesson found for ${targetLanguage} — skipping "${targetText}"`);
          continue;
        }

        const lessonId = (lessonResult.rows[0] as any).id;

        // Get next available order_index
        const orderResult = await db.execute(sql`
          SELECT COALESCE(MAX(order_index), 0) + 1 AS next_idx
          FROM curriculum_drill_items
          WHERE lesson_id = ${lessonId}
        `);
        let nextIndex = Number((orderResult.rows?.[0] as any)?.next_idx ?? 1);

        // Insert listen_repeat if absent
        const listenExists = await db.execute(sql`
          SELECT 1 FROM curriculum_drill_items
          WHERE lesson_id = ${lessonId}
            AND target_text = ${targetText}
            AND item_type = 'listen_repeat'
          LIMIT 1
        `);
        if (!listenExists.rows || listenExists.rows.length === 0) {
          await db.execute(sql`
            INSERT INTO curriculum_drill_items
              (id, lesson_id, item_type, order_index, prompt, target_text, target_language, difficulty, created_at, updated_at)
            VALUES
              (gen_random_uuid(), ${lessonId}, 'listen_repeat', ${nextIndex}, ${targetText}, ${targetText}, ${targetLanguage}, 1, NOW(), NOW())
          `);
          nextIndex++;
          drillItemsAdded++;
        }

        // Insert translate_speak if absent
        const translateExists = await db.execute(sql`
          SELECT 1 FROM curriculum_drill_items
          WHERE lesson_id = ${lessonId}
            AND target_text = ${targetText}
            AND item_type = 'translate_speak'
          LIMIT 1
        `);
        if (!translateExists.rows || translateExists.rows.length === 0) {
          await db.execute(sql`
            INSERT INTO curriculum_drill_items
              (id, lesson_id, item_type, order_index, prompt, target_text, target_language, difficulty, created_at, updated_at)
            VALUES
              (gen_random_uuid(), ${lessonId}, 'translate_speak', ${nextIndex}, ${englishPrompt}, ${targetText}, ${targetLanguage}, 1, NOW(), NOW())
          `);
          drillItemsAdded++;
        }
      }

      console.log(`[MIGRATIONS] 004: Added ${drillItemsAdded} new drill items for "see you soon" words across languages`);
    },
  },
  {
    version: '005',
    name: 'beta-launch-columns',
    up: async () => {
      // Add tos_accepted_at to users table (Terms of Service acceptance tracking)
      try {
        await db.execute(sql`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMP
        `);
        console.log('[MIGRATIONS] 005: Added tos_accepted_at column to users table');
      } catch (err: any) {
        if (!err.message?.includes('already exists')) throw err;
        console.log('[MIGRATIONS] 005: tos_accepted_at column already exists, skipping');
      }
    },
  },
  {
    version: '006',
    name: 'daniela-diary-entries',
    up: async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daniela_diary_entries (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id VARCHAR NOT NULL,
          language VARCHAR DEFAULT 'english',
          entry_title VARCHAR(200),
          narrative TEXT NOT NULL,
          emotional_tone VARCHAR(50),
          themes TEXT[],
          source_conversation_ids TEXT[],
          entry_date TIMESTAMP,
          significance REAL DEFAULT 0.7,
          generated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_diary_student_date
        ON daniela_diary_entries(student_id, entry_date DESC)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_diary_student_active
        ON daniela_diary_entries(student_id, is_active)
      `);
      console.log('[MIGRATIONS] 006: Created daniela_diary_entries table');
    },
  },
  {
    version: '007',
    name: 'daniela-absence-nudges',
    up: async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daniela_absence_nudges (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL,
          notified_at TIMESTAMP NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMP,
          resolution_type VARCHAR,
          suppress_until TIMESTAMP,
          last_session_date TIMESTAMP,
          days_since_last_session INTEGER
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_daniela_absence_nudges_user
        ON daniela_absence_nudges(user_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_daniela_absence_nudges_resolved
        ON daniela_absence_nudges(resolved_at)
      `);
      console.log('[MIGRATIONS] 007: Created daniela_absence_nudges table');
    },
  },
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
