#!/usr/bin/env npx tsx
/**
 * FULL DATABASE COMPARISON: Replit DB vs Neon DB
 * 
 * Compares ALL tables between old Replit PostgreSQL and Neon
 * to ensure complete migration coverage.
 * 
 * Run: npx tsx scripts/full-db-comparison.ts
 * 
 * Requirements:
 * - Old Replit PostgreSQL must be running/accessible
 * - Neon DATABASE_URL must be configured
 */

import { Pool } from 'pg';

// Tables that should be migrated (from neon-data-migration.ts)
const ALL_TABLES = [
  // Shared tables (Daniela's intelligence)
  'agent_observations',
  'self_best_practices',
  'tutor_procedures',
  'teaching_principles',
  'tool_knowledge',
  'situational_patterns',
  'linguistic_bridges',
  'language_idioms',
  'cultural_nuances',
  'dialect_variations',
  'learner_error_patterns',
  'subtlety_cues',
  'emotional_patterns',
  'creativity_templates',
  'north_star_principles',
  'north_star_understanding',
  'north_star_examples',
  'daniela_growth_memories',
  'daniela_recommendations',
  'daniela_beacons',
  'daniela_suggestions',
  'daniela_suggestion_actions',
  'daniela_feature_feedback',
  'synthesized_insights',
  'pedagogical_insights',
  'reflection_triggers',
  'ai_suggestions',
  'support_observations',
  'support_knowledge_base',
  'support_patterns',
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
  'curriculum_paths',
  'curriculum_units',
  'curriculum_lessons',
  'curriculum_drill_items',
  'can_do_statements',
  'grammar_competencies',
  'grammar_exercises',
  'cultural_tips',
  'cultural_tip_media',
  'lesson_can_do_statements',
  'lesson_cultural_tips',
  'lesson_visual_aids',
  'topics',
  'class_types',
  'tutor_voices',
  'hive_snapshots',
  'agent_collab_messages',
  'agent_collab_threads',
  'founder_sessions',
  'learner_personal_facts',
  'learner_memory_candidates',
  'system_alerts',
  
  // User tables (student data, classes, etc.)
  'users',
  'user_credentials',
  'auth_tokens',
  'pending_invites',
  'user_language_preferences',
  'conversations',
  'messages',
  'vocabulary_words',
  'vocabulary_word_topics',
  'user_progress',
  'actfl_progress',
  'progress_history',
  'pronunciation_scores',
  'pronunciation_audio',
  'user_grammar_progress',
  'grammar_errors',
  'grammar_assignments',
  'grammar_assignment_submissions',
  'user_drill_progress',
  'user_lessons',
  'user_lesson_items',
  'self_practice_sessions',
  'voice_sessions',
  'usage_ledger',
  'hour_packages',
  'class_hour_packages',
  'product_config',
  'admin_audit_log',
  
  // CRITICAL: Class-related tables
  'teacher_classes',
  'class_enrollments',
  'class_curriculum_units',
  'class_curriculum_lessons',
  'assignments',
  'assignment_submissions',
  'assignment_vocabulary',
  'syllable_progress',
  'syllabus_progress',
  'student_can_do_progress',
  'student_lesson_progress',
  'student_insights',
  'student_goals',
  'student_tier_signals',
  'student_tool_preferences',
  'topic_competency_observations',
  'actfl_assessment_events',
  'tutor_sessions',
  'tutor_session_topics',
  'tutor_parking_items',
  'conversation_topics',
  'session_notes',
  'session_cost_summary',
  'media_files',
  'message_media',
  'video_lessons',
  'support_tickets',
  'support_messages',
  'sofia_issue_reports',
];

interface TableComparison {
  table: string;
  replitCount: number;
  neonCount: number;
  difference: number;
  status: 'OK' | 'MISSING_IN_NEON' | 'REPLIT_EMPTY' | 'NEON_ONLY' | 'MISMATCH' | 'TABLE_NOT_EXIST';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// High priority tables that MUST be migrated
const HIGH_PRIORITY_TABLES = [
  'users',
  'teacher_classes',
  'class_enrollments',
  'conversations',
  'messages',
  'voice_sessions',
  'vocabulary_words',
  'user_progress',
  'assignments',
  'syllabus_progress',
];

async function countTableRows(pool: Pool, tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error: any) {
    if (error.code === '42P01') { // Table doesn't exist
      return -1;
    }
    return -2; // Other error
  }
}

async function getAllTables(pool: Pool): Promise<string[]> {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows.map(r => r.table_name);
  } catch (error) {
    console.error('Error getting tables:', error);
    return [];
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         FULL DATABASE COMPARISON: REPLIT vs NEON                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Get connection strings
  const neonUrl = process.env.DATABASE_URL;
  
  // For Replit DB, we need the old connection - user will need to provide or start local PG
  // Check if we can connect to localhost
  const replitUrl = process.env.OLD_REPLIT_DB_URL || 'postgresql://localhost:5432/replit';

  if (!neonUrl) {
    console.error('❌ DATABASE_URL (Neon) not configured');
    process.exit(1);
  }

  console.log('Connecting to databases...');
  console.log(`  Neon: ${neonUrl.split('@')[1]?.split('/')[0] || 'configured'}`);
  console.log(`  Replit: ${replitUrl.includes('localhost') ? 'localhost:5432' : 'configured'}\n`);

  const neonPool = new Pool({ connectionString: neonUrl });
  const replitPool = new Pool({ connectionString: replitUrl });

  // Test connections
  try {
    await neonPool.query('SELECT 1');
    console.log('✅ Neon connection successful');
  } catch (error) {
    console.error('❌ Neon connection failed:', error);
    process.exit(1);
  }

  try {
    await replitPool.query('SELECT 1');
    console.log('✅ Replit connection successful\n');
  } catch (error: any) {
    console.error('❌ Replit connection failed:', error.message);
    console.log('\n⚠️  To compare databases, you need to:');
    console.log('   1. Start the old Replit PostgreSQL service');
    console.log('   2. Or set OLD_REPLIT_DB_URL environment variable');
    console.log('   3. Or access via Replit Database panel and export data\n');
    await neonPool.end();
    process.exit(1);
  }

  // Get all tables from both databases
  console.log('Discovering tables...');
  const replitTables = await getAllTables(replitPool);
  const neonTables = await getAllTables(neonPool);
  
  console.log(`  Replit tables: ${replitTables.length}`);
  console.log(`  Neon tables: ${neonTables.length}\n`);

  // Combine all known tables
  const allTablesToCheck = new Set([...ALL_TABLES, ...replitTables, ...neonTables]);
  
  const comparisons: TableComparison[] = [];
  const tablesNeedingMigration: TableComparison[] = [];

  console.log(`Comparing ${allTablesToCheck.size} tables...\n`);

  for (const tableName of Array.from(allTablesToCheck).sort()) {
    const replitCount = await countTableRows(replitPool, tableName);
    const neonCount = await countTableRows(neonPool, tableName);
    
    let status: TableComparison['status'] = 'OK';
    let difference = 0;
    
    if (replitCount === -1 && neonCount === -1) {
      status = 'TABLE_NOT_EXIST';
    } else if (replitCount === -1) {
      status = 'NEON_ONLY';
    } else if (neonCount === -1) {
      status = 'MISSING_IN_NEON';
      difference = replitCount;
    } else if (replitCount === 0 && neonCount === 0) {
      status = 'REPLIT_EMPTY';
    } else if (replitCount > 0 && neonCount === 0) {
      status = 'MISSING_IN_NEON';
      difference = replitCount;
    } else if (replitCount === 0 && neonCount > 0) {
      status = 'NEON_ONLY';
      difference = -neonCount;
    } else if (replitCount !== neonCount) {
      status = 'MISMATCH';
      difference = replitCount - neonCount;
    }
    
    const priority = HIGH_PRIORITY_TABLES.includes(tableName) ? 'HIGH' : 
                     difference > 100 ? 'MEDIUM' : 'LOW';
    
    const comp: TableComparison = {
      table: tableName,
      replitCount: replitCount < 0 ? 0 : replitCount,
      neonCount: neonCount < 0 ? 0 : neonCount,
      difference,
      status,
      priority,
    };
    
    comparisons.push(comp);
    
    if (status === 'MISSING_IN_NEON' || (status === 'MISMATCH' && difference > 0)) {
      tablesNeedingMigration.push(comp);
    }
  }

  // Print results - prioritize issues
  console.log('┌────────────────────────────────────┬──────────┬──────────┬──────────┬────────┬───────────────────┐');
  console.log('│ Table                              │ Replit   │ Neon     │ Diff     │ Prior. │ Status            │');
  console.log('├────────────────────────────────────┼──────────┼──────────┼──────────┼────────┼───────────────────┤');
  
  // Sort: problems first, then by priority
  const sortedComparisons = [...comparisons].sort((a, b) => {
    const statusOrder = { 'MISSING_IN_NEON': 0, 'MISMATCH': 1, 'OK': 2, 'NEON_ONLY': 3, 'REPLIT_EMPTY': 4, 'TABLE_NOT_EXIST': 5 };
    const prioOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return prioOrder[a.priority] - prioOrder[b.priority];
  });
  
  for (const comp of sortedComparisons) {
    if (comp.status === 'TABLE_NOT_EXIST' || comp.status === 'REPLIT_EMPTY') continue;
    
    const tablePadded = comp.table.substring(0, 34).padEnd(34);
    const replitPadded = comp.replitCount.toString().padStart(8);
    const neonPadded = comp.neonCount.toString().padStart(8);
    const diffPadded = (comp.difference > 0 ? '+' + comp.difference : comp.difference.toString()).padStart(8);
    const prioPadded = comp.priority.padEnd(6);
    
    let statusIcon = '';
    switch (comp.status) {
      case 'OK':
        statusIcon = '✅ OK';
        break;
      case 'MISSING_IN_NEON':
        statusIcon = '🔴 MISSING';
        break;
      case 'NEON_ONLY':
        statusIcon = '📦 NEON ONLY';
        break;
      case 'MISMATCH':
        statusIcon = comp.difference > 0 ? '⚠️  BEHIND' : '📦 AHEAD';
        break;
    }
    
    console.log(`│ ${tablePadded}│ ${replitPadded} │ ${neonPadded} │ ${diffPadded} │ ${prioPadded} │ ${statusIcon.padEnd(17)} │`);
  }
  
  console.log('└────────────────────────────────────┴──────────┴──────────┴──────────┴────────┴───────────────────┘\n');

  // Summary
  const totalReplit = comparisons.reduce((sum, c) => sum + c.replitCount, 0);
  const totalNeon = comparisons.reduce((sum, c) => sum + c.neonCount, 0);
  const okCount = comparisons.filter(c => c.status === 'OK').length;
  const missingCount = comparisons.filter(c => c.status === 'MISSING_IN_NEON').length;
  const mismatchCount = comparisons.filter(c => c.status === 'MISMATCH' && c.difference > 0).length;
  
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log(`  Total Replit rows:      ${totalReplit.toLocaleString()}`);
  console.log(`  Total Neon rows:        ${totalNeon.toLocaleString()}`);
  console.log(`  Missing rows:           ${(totalReplit - totalNeon).toLocaleString()}`);
  console.log(`  Tables synced:          ${okCount}`);
  console.log(`  Tables missing data:    ${missingCount}`);
  console.log(`  Tables with gaps:       ${mismatchCount}`);
  console.log('══════════════════════════════════════════════════════════════════════\n');

  if (tablesNeedingMigration.length > 0) {
    console.log('🔴 TABLES NEEDING MIGRATION (sorted by priority):');
    
    const highPriority = tablesNeedingMigration.filter(t => t.priority === 'HIGH');
    const mediumPriority = tablesNeedingMigration.filter(t => t.priority === 'MEDIUM');
    const lowPriority = tablesNeedingMigration.filter(t => t.priority === 'LOW');
    
    if (highPriority.length > 0) {
      console.log('\n  🚨 HIGH PRIORITY:');
      for (const t of highPriority) {
        console.log(`     ${t.table}: ${t.replitCount} in Replit, ${t.neonCount} in Neon (missing ${t.difference})`);
      }
    }
    
    if (mediumPriority.length > 0) {
      console.log('\n  ⚠️  MEDIUM PRIORITY:');
      for (const t of mediumPriority) {
        console.log(`     ${t.table}: ${t.replitCount} in Replit, ${t.neonCount} in Neon (missing ${t.difference})`);
      }
    }
    
    if (lowPriority.length > 0) {
      console.log('\n  📋 LOW PRIORITY:');
      for (const t of lowPriority.slice(0, 10)) {
        console.log(`     ${t.table}: ${t.replitCount} in Replit, ${t.neonCount} in Neon (missing ${t.difference})`);
      }
      if (lowPriority.length > 10) {
        console.log(`     ... and ${lowPriority.length - 10} more tables`);
      }
    }
    console.log('');
  } else {
    console.log('✅ All tables are in sync!\n');
  }

  await replitPool.end();
  await neonPool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
