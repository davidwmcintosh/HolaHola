import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const CROSS_DB_CONSTRAINTS = [
  { table: 'actfl_assessment_events', constraint: 'actfl_assessment_events_conversation_id_conversations_id_fk' },
  { table: 'actfl_assessment_events', constraint: 'actfl_assessment_events_voice_session_id_voice_sessions_id_fk' },
  { table: 'class_hour_packages', constraint: 'class_hour_packages_purchaser_id_users_id_fk' },
  { table: 'compass_examples', constraint: 'compass_examples_student_id_users_id_fk' },
  { table: 'consultation_threads', constraint: 'consultation_threads_sprint_id_feature_sprints_id_fk' },
  { table: 'curriculum_paths', constraint: 'curriculum_paths_created_by_users_id_fk' },
  { table: 'daniela_recommendations', constraint: 'daniela_recommendations_user_id_users_id_fk' },
  { table: 'learning_motivations', constraint: 'learning_motivations_source_conversation_id_conversations_id_fk' },
  { table: 'people_connections', constraint: 'people_connections_source_conversation_id_conversations_id_fk' },
  { table: 'pronunciation_audio', constraint: 'pronunciation_audio_vocabulary_word_id_vocabulary_words_id_fk' },
  { table: 'pronunciation_scores', constraint: 'pronunciation_scores_conversation_id_conversations_id_fk' },
  { table: 'pronunciation_scores', constraint: 'pronunciation_scores_message_id_messages_id_fk' },
  { table: 'self_practice_sessions', constraint: 'self_practice_sessions_lesson_id_curriculum_lessons_id_fk' },
  { table: 'session_notes', constraint: 'session_notes_conversation_id_conversations_id_fk' },
  { table: 'student_lesson_progress', constraint: 'student_lesson_progress_conversation_id_conversations_id_fk' },
  { table: 'student_lesson_progress', constraint: 'student_lesson_progress_lesson_id_curriculum_lessons_id_fk' },
  { table: 'student_tier_signals', constraint: 'student_tier_signals_class_id_teacher_classes_id_fk' },
  { table: 'student_tier_signals', constraint: 'student_tier_signals_lesson_id_curriculum_lessons_id_fk' },
  { table: 'syllabus_progress', constraint: 'syllabus_progress_class_id_teacher_classes_id_fk' },
  { table: 'syllabus_progress', constraint: 'syllabus_progress_evidence_conversation_id_conversations_id_fk' },
  { table: 'syllabus_progress', constraint: 'syllabus_progress_lesson_id_curriculum_lessons_id_fk' },
  { table: 'topic_competency_observations', constraint: 'topic_competency_observations_user_id_users_id_fk' },
  { table: 'usage_ledger', constraint: 'usage_ledger_class_id_teacher_classes_id_fk' },
  { table: 'usage_ledger', constraint: 'usage_ledger_voice_session_id_voice_sessions_id_fk' },
  { table: 'user_drill_progress', constraint: 'user_drill_progress_drill_item_id_curriculum_drill_items_id_fk' },
  { table: 'user_lesson_items', constraint: 'user_lesson_items_conversation_id_conversations_id_fk' },
  { table: 'user_lesson_items', constraint: 'user_lesson_items_vocabulary_word_id_vocabulary_words_id_fk' },
  { table: 'vocabulary_words', constraint: 'vocabulary_words_user_id_users_id_fk' },
];

async function fixCrossDbConstraints() {
  console.log("🔧 Dropping cross-database FK constraints...\n");

  let dropped = 0;
  let alreadyGone = 0;
  let errors = 0;

  for (const { table, constraint } of CROSS_DB_CONSTRAINTS) {
    try {
      await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
      console.log(`  ✅ Dropped: ${constraint}`);
      dropped++;
    } catch (err: any) {
      if (err.message.includes('does not exist')) {
        console.log(`  ⏭️  Already gone: ${constraint}`);
        alreadyGone++;
      } else {
        console.log(`  ❌ Error: ${constraint} - ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Dropped: ${dropped}`);
  console.log(`   Already gone: ${alreadyGone}`);
  console.log(`   Errors: ${errors}`);

  await pool.end();
}

fixCrossDbConstraints().catch(console.error);
