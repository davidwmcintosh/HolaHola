import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

  console.log('=== PATTERN 1: Intro repetition within units (French) ===\n');
  const { rows: unitRows } = await pool.query(`
    SELECT 
      cu.name as unit_name,
      cl.name as lesson_name,
      cl.lesson_type,
      LEFT(tlc.introduction, 160) as intro_start,
      LENGTH(tlc.introduction) as intro_len,
      LENGTH(tlc.grammar_explanation) as grammar_len,
      COALESCE(LENGTH(tlc.reading_passage), 0) as passage_len,
      COALESCE(jsonb_array_length(tlc.vocabulary_list), 0) as vocab_count,
      COALESCE(jsonb_array_length(tlc.key_phrases_for_chat), 0) as phrase_count
    FROM textbook_lesson_content tlc
    JOIN curriculum_lessons cl ON cl.id = tlc.lesson_id
    JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
    WHERE tlc.language = 'french'
    ORDER BY cu.order_index, cl.order_index
    LIMIT 18
  `);

  let prevUnit = '';
  for (const r of unitRows) {
    if (r.unit_name !== prevUnit) {
      console.log('\n▶▶ UNIT: ' + r.unit_name);
      prevUnit = r.unit_name;
    }
    const flags: string[] = [];
    if (r.grammar_len > 800) flags.push('VERBOSE-GRAMMAR');
    if (r.intro_len > 600) flags.push('VERBOSE-INTRO');
    const flagStr = flags.length ? '  ⚠️  ' + flags.join(', ') : '';
    console.log('  [' + r.lesson_type + '] ' + r.lesson_name);
    console.log('    intro:' + r.intro_len + 'ch  grammar:' + r.grammar_len + 'ch  passage:' + r.passage_len + 'ch  vocab:' + r.vocab_count + '  phrases:' + r.phrase_count + flagStr);
    console.log('    "' + (r.intro_start || '').replace(/\n/g, ' ').slice(0, 150) + '"');
  }

  console.log('\n\n=== PATTERN 2: Average content sizes by language + lesson type ===\n');
  const { rows: statsRows } = await pool.query(`
    SELECT
      tlc.language,
      cl.lesson_type,
      COUNT(*) as lesson_count,
      ROUND(AVG(LENGTH(tlc.introduction))) as avg_intro_ch,
      ROUND(AVG(LENGTH(tlc.grammar_explanation))) as avg_grammar_ch,
      MAX(LENGTH(tlc.introduction)) as max_intro_ch,
      MAX(LENGTH(tlc.grammar_explanation)) as max_grammar_ch,
      ROUND(AVG(COALESCE(jsonb_array_length(tlc.vocabulary_list), 0)), 1) as avg_vocab
    FROM textbook_lesson_content tlc
    JOIN curriculum_lessons cl ON cl.id = tlc.lesson_id
    GROUP BY tlc.language, cl.lesson_type
    ORDER BY tlc.language, cl.lesson_type
  `);

  for (const r of statsRows) {
    const flags: string[] = [];
    if (Number(r.avg_grammar_ch) > 800) flags.push('AVG-VERBOSE-GRAMMAR');
    if (Number(r.max_intro_ch) > 1200) flags.push('MAX-VERBOSE-INTRO');
    const flagStr = flags.length ? '  ⚠️  ' + flags.join(', ') : '';
    console.log(r.language + ' / ' + r.lesson_type + ' (' + r.lesson_count + ' lessons)' + flagStr);
    console.log('  avg intro:' + r.avg_intro_ch + 'ch  avg grammar:' + r.avg_grammar_ch + 'ch  max intro:' + r.max_intro_ch + 'ch  max grammar:' + r.max_grammar_ch + 'ch  avg_vocab:' + r.avg_vocab);
  }

  console.log('\n\n=== PATTERN 3: Conversation/drill lessons with long grammar sections ===\n');
  const { rows: drillRows } = await pool.query(`
    SELECT 
      cl.name as lesson_name,
      cl.lesson_type,
      tlc.language,
      LENGTH(tlc.grammar_explanation) as grammar_len,
      LEFT(tlc.grammar_explanation, 300) as grammar_preview
    FROM textbook_lesson_content tlc
    JOIN curriculum_lessons cl ON cl.id = tlc.lesson_id
    WHERE cl.lesson_type IN ('conversation', 'drill')
      AND LENGTH(tlc.grammar_explanation) > 500
    ORDER BY LENGTH(tlc.grammar_explanation) DESC
    LIMIT 12
  `);

  for (const r of drillRows) {
    console.log('[' + r.lesson_type + '] ' + r.lesson_name + ' (' + r.language + ') grammar:' + r.grammar_len + 'ch');
    console.log('  "' + (r.grammar_preview || '').replace(/\n/g, ' ').slice(0, 280) + '"');
    console.log();
  }

  console.log('\n=== PATTERN 4: Same intro opening across lessons in same unit (repetition check) ===\n');
  const { rows: repeatRows } = await pool.query(`
    SELECT 
      cu.name as unit_name,
      COUNT(*) as lesson_count,
      COUNT(DISTINCT LEFT(tlc.introduction, 60)) as distinct_intro_openings
    FROM textbook_lesson_content tlc
    JOIN curriculum_lessons cl ON cl.id = tlc.lesson_id
    JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
    WHERE tlc.language = 'spanish'
    GROUP BY cu.id, cu.title
    HAVING COUNT(*) > 2
    ORDER BY (COUNT(*) - COUNT(DISTINCT LEFT(tlc.introduction, 60))) DESC
    LIMIT 15
  `);

  for (const r of repeatRows) {
    const dupes = Number(r.lesson_count) - Number(r.distinct_intro_openings);
    const flag = dupes > 0 ? '  ⚠️  ' + dupes + ' lessons share the same intro opening' : '  ✓ all distinct';
    console.log(r.unit_name + ': ' + r.lesson_count + ' lessons, ' + r.distinct_intro_openings + ' distinct openings' + flag);
  }

  await pool.end();
}

main().catch(console.error);
