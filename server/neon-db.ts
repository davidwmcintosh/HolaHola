import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const NEON_SHARED_URL = process.env.NEON_SHARED_DATABASE_URL;
const NEON_USER_URL = process.env.NEON_USER_DATABASE_URL;

/**
 * Table Routing for Dual-Database Architecture
 * 
 * SHARED DATABASE: Daniela's intelligence, curriculum, Wren insights
 * - Both dev and prod environments connect here
 * - "One Daniela Everywhere"
 * 
 * USER DATABASE: Per-environment user data
 * - Isolated between dev/prod
 * - User accounts, conversations, progress
 */

// Tables that go to SHARED database (Daniela + Curriculum + Wren)
export const SHARED_TABLES = new Set([
  // Daniela Intelligence
  'agent_observations',
  'support_observations', 
  'system_alerts',
  'self_best_practices',
  'tutor_procedures',
  'teaching_principles',
  'tool_knowledge',
  'situational_patterns',
  'linguistic_bridges',
  'language_idioms',
  'cultural_nuances',
  'learner_error_patterns',
  'dialect_variations',
  'subtlety_cues',
  'emotional_patterns',
  'creativity_templates',
  'compass_principles',
  'compass_understanding',
  'compass_examples',
  'daniela_growth_memories',
  'daniela_recommendations',
  'daniela_beacons',
  'daniela_suggestions',
  'daniela_suggestion_actions',
  'synthesized_insights',
  'pedagogical_insights',
  'reflection_triggers',
  'ai_suggestions',
  
  // Wren Intelligence
  'wren_insights',
  'wren_proactive_triggers',
  'wren_mistakes',
  'wren_lessons',
  'wren_commitments',
  'wren_mistake_resolutions',
  'wren_session_notes',
  'wren_predictions',
  'wren_confidence_records',
  'wren_calibration_stats',
  'architectural_decision_records',
  
  // Curriculum Content
  'curriculum_paths',
  'curriculum_units',
  'curriculum_lessons',
  'curriculum_drill_items',
  'can_do_statements',
  'grammar_competencies',
  'cultural_tips',
  'cultural_tip_media',
  'lesson_can_do_statements',
  'lesson_cultural_tips',
  'lesson_visual_aids',
  'topics',
  'class_types',
  'tutor_voices',
  'grammar_exercises',
  'lesson_drafts',
  
  // Hive/Collaboration
  'hive_snapshots',
  'agent_collab_messages',
  'agent_collab_threads',
  'founder_sessions',
  'express_lane_sessions',
  'express_lane_messages',
  'collaboration_messages',  // Express Lane collaboration history
  
  // Architect/Wren Notes
  'architect_notes',
  
  // Sync cursors (must be with founder_sessions for FK constraint)
  'sync_cursors',
  
  // Support Knowledge (global)
  'support_knowledge_base',
  'support_patterns',
  'neural_network_telemetry',
  'feature_sprints',
  
  // Daniela's learner memory (shared so she remembers students across envs)
  'learner_personal_facts',
  'learner_memory_candidates',
  
  // Post-flight reports and beacons
  'post_flight_reports',
  'topic_competency_observations',
  
  // Teacher/Class Management (shared so classes work across dev/prod)
  'teacher_classes',
  'class_enrollments',
  'class_curriculum_units',
  'class_curriculum_lessons',
  'class_hour_packages',
  
  // Conversations (shared so Daniela remembers all conversations across envs)
  'conversations',
  'messages',
  'message_media',
  'voice_sessions',
  'tutor_sessions',
  'tutor_session_topics',
  'conversation_topics',
  // Vocabulary (shared so Daniela tracks all words learned across envs, FK to conversations)
  'vocabulary_words',
  'vocabulary_word_topics',
  
  // Textbook Visual Assets (shared curriculum content)
  'textbook_visual_assets',
]);

// Tables that go to USER database (per-environment)
export const USER_TABLES = new Set([
  // User & Authentication
  'users',
  'user_credentials',
  'auth_tokens',
  'pending_invites',
  'sessions',
  
  // Conversations & Voice Sessions (moved to SHARED for cross-env memory)
  'surgery_sessions',
  'surgery_turns',
  'consultation_threads',
  'consultation_messages',
  
  // Editor/Collaboration (per-environment user data)
  'collaboration_events',
  'collaboration_participants',
  'collaboration_channels',
  'editor_listening_snapshots',
  'editor_beacon_queue',
  
  // Progress & Learning
  'user_progress',
  'user_lesson_items',
  'user_lessons',
  'user_drill_progress',
  'user_grammar_progress',
  'student_insights',
  'student_can_do_progress',
  'student_lesson_progress',
  'student_tier_signals',
  'syllabus_progress',
  'pronunciation_scores',
  'pronunciation_audio',
  'phoneme_struggles',
  'actfl_assessment_events',
  
  // Student Memory (per-user, but historical data)
  'people_connections',
  'learning_motivations',
  'recurring_struggles',
  'session_notes',
  'predicted_struggles',
  'user_motivation_alerts',
  
  // Usage tracking (user-specific)
  'usage_ledger',
  
  // Self-practice
  'self_practice_sessions',
  
  // Interactive Textbook Progress
  'textbook_section_progress',
  'textbook_user_position',
  
  // Support (per-user data)
  'support_tickets',
  'support_messages',
  'sofia_issue_reports',
  
  // Stripe/Billing (user-specific)
  'stripe_customers',
  'stripe_subscriptions',
  'stripe_invoices',
  'stripe_charges',
  'stripe_payment_intents',
  'stripe_payment_methods',
  'stripe_setup_intents',
  'stripe_disputes',
  'stripe_refunds',
  'stripe_credit_notes',
  'stripe_checkout_sessions',
  'stripe_early_fraud_warnings',
  'stripe_tax_ids',
  
  // Sync infrastructure (will be removed post-migration)
  'sync_runs',
  // 'sync_cursors' moved to SHARED_TABLES (FK to founder_sessions)
  'sync_conflicts',
  'sync_verification_results',
]);

/**
 * Get the database type for a given table name
 */
export function getTableDatabase(tableName: string): 'shared' | 'user' | 'unknown' {
  if (SHARED_TABLES.has(tableName)) return 'shared';
  if (USER_TABLES.has(tableName)) return 'user';
  return 'unknown';
}

/**
 * Get the appropriate Drizzle db instance for a table
 */
export function getDbForTable(tableName: string) {
  const dbType = getTableDatabase(tableName);
  if (dbType === 'shared') return getSharedDb();
  if (dbType === 'user') return getUserDb();
  throw new Error(`Unknown table routing for: ${tableName}. Add it to SHARED_TABLES or USER_TABLES in neon-db.ts`);
}

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
