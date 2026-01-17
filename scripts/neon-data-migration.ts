import { Pool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const SHARED_TABLES = [
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
];

const USER_TABLES = [
  'schema_migrations',
  'sessions',
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
  'surgery_sessions',
  'surgery_turns',
  'self_surgery_proposals',
  'consultation_threads',
  'consultation_messages',
  'people_connections',
  'learning_motivations',
  'user_motivation_alerts',
  'phoneme_struggles',
  'predicted_struggles',
  'recurring_struggles',
  'post_flight_reports',
  'aris_drill_assignments',
  'aris_drill_results',
  'collaboration_channels',
  'collaboration_participants',
  'collaboration_messages',
  'collaboration_events',
  'agent_collaboration_events',
  'lesson_drafts',
  'feature_sprints',
  'sprint_templates',
  'sprint_stage_transitions',
  'agenda_queue',
  'editor_beacon_queue',
  'editor_listening_snapshots',
  'project_context_snapshots',
  'project_health_metrics',
  'promotion_queue',
  'architect_notes',
  'neural_network_telemetry',
  'teaching_suggestion_effectiveness',
  'teaching_tool_events',
];

const RETIRE_TABLES = [
  'sync_runs',
  'sync_import_receipts',
  'sync_anomalies',
  'sync_cursors',
  'sync_log',
];

const BATCH_SIZE = 5000;
const LARGE_TABLE_BATCH_SIZE = 10000;

async function migrateTable(
  sourcePool: pg.Pool,
  targetPool: Pool,
  tableName: string,
  targetDb: string
): Promise<{ table: string; rows: number; success: boolean; error?: string }> {
  try {
    const countResult = await sourcePool.query(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    const totalRows = parseInt(countResult.rows[0].count);

    if (totalRows === 0) {
      return { table: tableName, rows: 0, success: true };
    }

    console.log(`  Migrating ${tableName}: ${totalRows.toLocaleString()} rows to ${targetDb}...`);

    const columnsResult = await sourcePool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows.map((r: any) => r.column_name);
    const columnList = columns.map((c: string) => `"${c}"`).join(', ');

    const batchSize = totalRows > 100000 ? LARGE_TABLE_BATCH_SIZE : BATCH_SIZE;
    let offset = 0;
    let migratedRows = 0;

    while (offset < totalRows) {
      const dataResult = await sourcePool.query(
        `SELECT ${columnList} FROM "${tableName}" ORDER BY 1 LIMIT ${batchSize} OFFSET ${offset}`
      );

      if (dataResult.rows.length === 0) break;

      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const row of dataResult.rows) {
        const rowPlaceholders: string[] = [];
        for (const col of columns) {
          values.push(row[col]);
          rowPlaceholders.push(`$${paramIndex++}`);
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const insertQuery = `
        INSERT INTO "${tableName}" (${columnList})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT DO NOTHING
      `;

      await targetPool.query(insertQuery, values);
      
      migratedRows += dataResult.rows.length;
      offset += batchSize;

      if (totalRows > batchSize) {
        const progress = Math.round((migratedRows / totalRows) * 100);
        process.stdout.write(`\r    Progress: ${progress}% (${migratedRows.toLocaleString()}/${totalRows.toLocaleString()})`);
      }
    }

    if (totalRows > batchSize) {
      console.log('');
    }

    return { table: tableName, rows: migratedRows, success: true };
  } catch (error: any) {
    console.error(`\n    ERROR in ${tableName}: ${error.message}`);
    return { table: tableName, rows: 0, success: false, error: error.message };
  }
}

async function runMigration() {
  const replitUrl = process.env.DATABASE_URL;
  const neonSharedUrl = process.env.NEON_SHARED_DATABASE_URL;
  const neonUserUrl = process.env.NEON_USER_DATABASE_URL;

  if (!replitUrl || !neonSharedUrl || !neonUserUrl) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           NEON DATABASE MIGRATION                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const sourcePool = new pg.Pool({ connectionString: replitUrl });
  const sharedPool = new Pool({ connectionString: neonSharedUrl });
  const userPool = new Pool({ connectionString: neonUserUrl });

  console.log('Connections established.\n');

  const existingTablesResult = await sourcePool.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  const existingTables = new Set(existingTablesResult.rows.map((r: any) => r.tablename));

  const sharedResults: any[] = [];
  const userResults: any[] = [];

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 1: Migrating SHARED tables (Daniela + Curriculum)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const table of SHARED_TABLES) {
    if (existingTables.has(table)) {
      const result = await migrateTable(sourcePool, sharedPool, table, 'SHARED');
      sharedResults.push(result);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2: Migrating USER tables');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const table of USER_TABLES) {
    if (existingTables.has(table)) {
      const result = await migrateTable(sourcePool, userPool, table, 'USER');
      userResults.push(result);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('MIGRATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sharedSuccess = sharedResults.filter(r => r.success);
  const sharedFailed = sharedResults.filter(r => !r.success);
  const sharedRows = sharedResults.reduce((sum, r) => sum + r.rows, 0);

  console.log('SHARED Database:');
  console.log(`  ✓ Tables migrated: ${sharedSuccess.length}`);
  console.log(`  ✓ Total rows: ${sharedRows.toLocaleString()}`);
  if (sharedFailed.length > 0) {
    console.log(`  ✗ Failed tables: ${sharedFailed.map(r => r.table).join(', ')}`);
  }

  const userSuccess = userResults.filter(r => r.success);
  const userFailed = userResults.filter(r => !r.success);
  const userRows = userResults.reduce((sum, r) => sum + r.rows, 0);

  console.log('\nUSER Database:');
  console.log(`  ✓ Tables migrated: ${userSuccess.length}`);
  console.log(`  ✓ Total rows: ${userRows.toLocaleString()}`);
  if (userFailed.length > 0) {
    console.log(`  ✗ Failed tables: ${userFailed.map(r => r.table).join(', ')}`);
  }

  console.log('\nRETIRED (not migrated):');
  console.log(`  ${RETIRE_TABLES.join(', ')}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TOP TABLES BY ROW COUNT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allResults = [...sharedResults, ...userResults]
    .filter(r => r.rows > 0)
    .sort((a, b) => b.rows - a.rows)
    .slice(0, 15);

  for (const r of allResults) {
    const db = sharedResults.includes(r) ? 'SHARED' : 'USER';
    console.log(`  ${r.table.padEnd(35)} ${r.rows.toLocaleString().padStart(12)} → ${db}`);
  }

  await sourcePool.end();
  await sharedPool.end();
  await userPool.end();

  console.log('\n✓ Migration complete!');
  
  return {
    shared: {
      success: sharedSuccess.length,
      failed: sharedFailed.length,
      rows: sharedRows,
      failedTables: sharedFailed.map(r => r.table)
    },
    user: {
      success: userSuccess.length,
      failed: userFailed.length,
      rows: userRows,
      failedTables: userFailed.map(r => r.table)
    },
    retired: RETIRE_TABLES
  };
}

// Export for API use
export { runMigration };

// Only run directly when called as script (not when imported)
if (require.main === module) {
  runMigration().catch(console.error);
}
