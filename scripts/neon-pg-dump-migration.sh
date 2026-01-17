#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           NEON DATABASE MIGRATION via pg_dump                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Key shared tables (Daniela intelligence + curriculum)
SHARED_TABLES=(
  "agent_observations"
  "self_best_practices"
  "tutor_procedures"
  "teaching_principles"
  "tool_knowledge"
  "situational_patterns"
  "linguistic_bridges"
  "language_idioms"
  "cultural_nuances"
  "dialect_variations"
  "learner_error_patterns"
  "subtlety_cues"
  "emotional_patterns"
  "creativity_templates"
  "curriculum_paths"
  "curriculum_units"
  "curriculum_lessons"
  "curriculum_drill_items"
  "can_do_statements"
  "grammar_competencies"
  "grammar_exercises"
  "cultural_tips"
  "lesson_can_do_statements"
  "topics"
  "class_types"
  "tutor_voices"
  "hive_snapshots"
  "wren_insights"
  "learner_personal_facts"
  "learner_memory_candidates"
  "daniela_growth_memories"
  "founder_sessions"
)

# Key user tables
USER_TABLES=(
  "users"
  "sessions"
  "conversations"
  "messages"
  "vocabulary_words"
  "user_progress"
  "actfl_progress"
  "voice_sessions"
  "student_insights"
  "class_curriculum_lessons"
  "teacher_classes"
  "class_enrollments"
  "tutor_sessions"
  "usage_ledger"
)

DUMP_DIR="/tmp/neon_migration"
mkdir -p $DUMP_DIR

echo "Step 1: Dumping data from Replit database..."
echo ""

# Dump shared tables
echo "Dumping SHARED tables..."
TABLE_ARGS=""
for table in "${SHARED_TABLES[@]}"; do
  TABLE_ARGS="$TABLE_ARGS -t $table"
done
pg_dump $DATABASE_URL --data-only --disable-triggers $TABLE_ARGS > $DUMP_DIR/shared_data.sql 2>/dev/null || true
echo "  Shared tables dump: $(wc -l < $DUMP_DIR/shared_data.sql) lines"

# Dump user tables
echo "Dumping USER tables..."
TABLE_ARGS=""
for table in "${USER_TABLES[@]}"; do
  TABLE_ARGS="$TABLE_ARGS -t $table"
done
pg_dump $DATABASE_URL --data-only --disable-triggers $TABLE_ARGS > $DUMP_DIR/user_data.sql 2>/dev/null || true
echo "  User tables dump: $(wc -l < $DUMP_DIR/user_data.sql) lines"

echo ""
echo "Step 2: Importing to Neon databases..."
echo ""

# Disable FK checks for import
echo "Importing to SHARED database..."
psql $NEON_SHARED_DATABASE_URL -c "SET session_replication_role = 'replica';" 2>/dev/null || true
psql $NEON_SHARED_DATABASE_URL < $DUMP_DIR/shared_data.sql 2>&1 | grep -v "already exists" | head -20 || true
psql $NEON_SHARED_DATABASE_URL -c "SET session_replication_role = 'origin';" 2>/dev/null || true
echo "  SHARED import complete"

echo "Importing to USER database..."
psql $NEON_USER_DATABASE_URL -c "SET session_replication_role = 'replica';" 2>/dev/null || true
psql $NEON_USER_DATABASE_URL < $DUMP_DIR/user_data.sql 2>&1 | grep -v "already exists" | head -20 || true
psql $NEON_USER_DATABASE_URL -c "SET session_replication_role = 'origin';" 2>/dev/null || true
echo "  USER import complete"

echo ""
echo "Step 3: Verifying row counts..."
echo ""

echo "SHARED Database:"
for table in agent_observations curriculum_drill_items curriculum_lessons can_do_statements tutor_procedures; do
  count=$(psql $NEON_SHARED_DATABASE_URL -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "0")
  echo "  $table: $count rows"
done

echo ""
echo "USER Database:"
for table in users conversations messages voice_sessions user_progress; do
  count=$(psql $NEON_USER_DATABASE_URL -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "0")
  echo "  $table: $count rows"
done

echo ""
echo "✓ Migration complete!"
