import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function ensureTriLaneTables(): Promise<void> {
  console.log('[Migration] Checking tri-lane tables...');
  
  try {
    // Create enum types if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE agent_observation_category AS ENUM (
          'architecture_pattern',
          'code_quality',
          'performance_opportunity',
          'security_consideration',
          'user_experience',
          'technical_debt',
          'integration_suggestion',
          'documentation_gap',
          'testing_improvement',
          'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE support_observation_category AS ENUM (
          'common_question',
          'user_confusion',
          'feature_request',
          'bug_pattern',
          'onboarding_friction',
          'documentation_need',
          'accessibility_issue',
          'localization_gap',
          'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE system_alert_severity AS ENUM (
          'info',
          'warning',
          'error',
          'critical'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE system_alert_target AS ENUM (
          'all',
          'students',
          'teachers',
          'founders'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    // Create agent_observations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_observations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        category agent_observation_category NOT NULL,
        priority INTEGER DEFAULT 50,
        title VARCHAR NOT NULL,
        observation TEXT NOT NULL,
        reasoning TEXT,
        evidence_count INTEGER DEFAULT 1,
        evidence_summary TEXT,
        related_files TEXT[],
        proposed_action TEXT,
        proposed_code TEXT,
        target_table VARCHAR,
        status VARCHAR DEFAULT 'active',
        implemented_at TIMESTAMP,
        implemented_by VARCHAR,
        sync_status VARCHAR DEFAULT 'local',
        origin_id VARCHAR,
        origin_environment VARCHAR,
        intent_hash VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create support_observations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS support_observations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        category support_observation_category NOT NULL,
        priority INTEGER DEFAULT 50,
        title VARCHAR NOT NULL,
        observation TEXT NOT NULL,
        reasoning TEXT,
        evidence_count INTEGER DEFAULT 1,
        evidence_summary TEXT,
        affected_user_count INTEGER,
        proposed_solution TEXT,
        proposed_faq_entry TEXT,
        escalation_needed BOOLEAN DEFAULT FALSE,
        status VARCHAR DEFAULT 'active',
        resolved_at TIMESTAMP,
        resolved_by VARCHAR,
        resolution_notes TEXT,
        sync_status VARCHAR DEFAULT 'local',
        origin_id VARCHAR,
        origin_environment VARCHAR,
        intent_hash VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create system_alerts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_alerts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        severity system_alert_severity NOT NULL,
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        target system_alert_target DEFAULT 'all',
        affected_features TEXT[],
        is_dismissible BOOLEAN DEFAULT TRUE,
        show_in_chat BOOLEAN DEFAULT TRUE,
        show_as_banner BOOLEAN DEFAULT FALSE,
        starts_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR,
        view_count INTEGER DEFAULT 0,
        dismiss_count INTEGER DEFAULT 0,
        related_incident_id VARCHAR,
        sync_status VARCHAR DEFAULT 'local',
        origin_id VARCHAR,
        origin_environment VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('[Migration] Tri-lane tables ready');
  } catch (error: any) {
    console.error('[Migration] Failed to create tri-lane tables:', error.message);
    // Don't throw - allow server to continue even if migration fails
  }
}
