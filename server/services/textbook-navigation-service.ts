/**
 * textbook-navigation-service.ts
 *
 * Gives Daniela awareness of what comes before and after the student's current
 * textbook chapter.  She can use this context to:
 *   - reference vocabulary the student already learned (previous lesson)
 *   - preview and build excitement about what's coming next (next lesson)
 *   - bridge topics across chapter boundaries naturally
 */

type VocabEntry     = { word: string; translation: string; partOfSpeech?: string };
type PhraseEntry    = { phrase: string; translation: string };

interface LessonSummary {
  id:   string;
  name: string;
  vocab:   VocabEntry[];
  phrases: PhraseEntry[];
}

/**
 * Returns up to 5 vocab words and 3 key phrases for a given lesson,
 * plus the lesson name.  Returns null if no TLC exists for that lesson.
 */
async function fetchLessonSummary(
  lessonId: string,
  lessonName: string,
  db: any,
  sql: any,
): Promise<LessonSummary | null> {
  const row = await db.execute(
    sql`SELECT vocabulary_list, key_phrases_for_chat
        FROM textbook_lesson_content
        WHERE lesson_id = ${lessonId}
        LIMIT 1`,
  );
  if (!row.rows[0]) return null;

  const vocab   = ((row.rows[0].vocabulary_list   ?? []) as VocabEntry[]).slice(0, 5);
  const phrases = ((row.rows[0].key_phrases_for_chat ?? []) as PhraseEntry[]).slice(0, 3);

  return { id: lessonId, name: lessonName, vocab, phrases };
}

/**
 * Given the current textbook lesson, find the immediately previous and next
 * lessons (crossing unit boundaries when at the start/end of a unit).
 *
 * Returns a formatted string block for injection into Daniela's context,
 * or null if the lesson isn't found in curriculum_lessons.
 */
export async function buildAdjacentLessonContext(
  currentLessonId: string,
  db: any,
  sql: any,
): Promise<string | null> {
  try {
    // ── 1. Fetch the current lesson's position ──
    const curRow = await db.execute(sql`
      SELECT cl.id,
             cl.name,
             cl.curriculum_unit_id  AS unit_id,
             cl.order_index         AS lesson_order,
             cu.order_index         AS unit_order,
             cu.curriculum_path_id  AS path_id
      FROM   curriculum_lessons cl
      JOIN   curriculum_units   cu ON cu.id = cl.curriculum_unit_id
      WHERE  cl.id = ${currentLessonId}
      LIMIT  1
    `);
    if (!curRow.rows[0]) return null;

    const cur = curRow.rows[0] as {
      id: string; name: string;
      unit_id: string; lesson_order: number;
      unit_order: number; path_id: string;
    };

    // ── 2. Previous lesson ──
    let prevSummary: LessonSummary | null = null;

    // Try same unit first
    const prevInUnit = await db.execute(sql`
      SELECT id, name FROM curriculum_lessons
      WHERE  curriculum_unit_id = ${cur.unit_id}
        AND  order_index < ${cur.lesson_order}
      ORDER BY order_index DESC
      LIMIT 1
    `);

    if (prevInUnit.rows[0]) {
      const r = prevInUnit.rows[0] as { id: string; name: string };
      prevSummary = await fetchLessonSummary(r.id, r.name, db, sql);
    } else {
      // Cross into previous unit
      const prevUnit = await db.execute(sql`
        SELECT id FROM curriculum_units
        WHERE  curriculum_path_id = ${cur.path_id}
          AND  order_index < ${cur.unit_order}
        ORDER BY order_index DESC
        LIMIT 1
      `);
      if (prevUnit.rows[0]) {
        const puId = (prevUnit.rows[0] as { id: string }).id;
        const lastLesson = await db.execute(sql`
          SELECT id, name FROM curriculum_lessons
          WHERE  curriculum_unit_id = ${puId}
          ORDER BY order_index DESC
          LIMIT 1
        `);
        if (lastLesson.rows[0]) {
          const r = lastLesson.rows[0] as { id: string; name: string };
          prevSummary = await fetchLessonSummary(r.id, r.name, db, sql);
        }
      }
    }

    // ── 3. Next lesson ──
    let nextSummary: LessonSummary | null = null;

    const nextInUnit = await db.execute(sql`
      SELECT id, name FROM curriculum_lessons
      WHERE  curriculum_unit_id = ${cur.unit_id}
        AND  order_index > ${cur.lesson_order}
      ORDER BY order_index ASC
      LIMIT 1
    `);

    if (nextInUnit.rows[0]) {
      const r = nextInUnit.rows[0] as { id: string; name: string };
      nextSummary = await fetchLessonSummary(r.id, r.name, db, sql);
    } else {
      // Cross into next unit
      const nextUnit = await db.execute(sql`
        SELECT id FROM curriculum_units
        WHERE  curriculum_path_id = ${cur.path_id}
          AND  order_index > ${cur.unit_order}
        ORDER BY order_index ASC
        LIMIT 1
      `);
      if (nextUnit.rows[0]) {
        const nuId = (nextUnit.rows[0] as { id: string }).id;
        const firstLesson = await db.execute(sql`
          SELECT id, name FROM curriculum_lessons
          WHERE  curriculum_unit_id = ${nuId}
          ORDER BY order_index ASC
          LIMIT 1
        `);
        if (firstLesson.rows[0]) {
          const r = firstLesson.rows[0] as { id: string; name: string };
          nextSummary = await fetchLessonSummary(r.id, r.name, db, sql);
        }
      }
    }

    // ── 4. Build the context block ──
    if (!prevSummary && !nextSummary) return null;

    const lines: string[] = ['\n\n📚 ADJACENT TEXTBOOK CHAPTERS (for contextual reference):'];
    lines.push(
      'You can draw on these proactively — reinforce vocabulary from the previous chapter,',
      'or naturally preview / build curiosity about the next chapter when it fits the conversation.',
    );

    if (prevSummary) {
      lines.push(`\n⬅ PREVIOUS CHAPTER: "${prevSummary.name}"`);
      if (prevSummary.vocab.length > 0) {
        lines.push('Key vocabulary the student already learned:');
        prevSummary.vocab.forEach(v =>
          lines.push(`  • ${v.word} — ${v.translation}${v.partOfSpeech ? ` (${v.partOfSpeech})` : ''}`),
        );
      }
      if (prevSummary.phrases.length > 0) {
        lines.push('Key phrases from that chapter:');
        prevSummary.phrases.forEach(p => lines.push(`  • ${p.phrase} — ${p.translation}`));
      }
    }

    if (nextSummary) {
      lines.push(`\n➡ NEXT CHAPTER: "${nextSummary.name}"`);
      if (nextSummary.vocab.length > 0) {
        lines.push('Vocabulary coming up — you can tease these naturally:');
        nextSummary.vocab.forEach(v =>
          lines.push(`  • ${v.word} — ${v.translation}${v.partOfSpeech ? ` (${v.partOfSpeech})` : ''}`),
        );
      }
      if (nextSummary.phrases.length > 0) {
        lines.push('Phrases coming up:');
        nextSummary.phrases.forEach(p => lines.push(`  • ${p.phrase} — ${p.translation}`));
      }
    }

    lines.push(
      '\nINSTRUCTION: Use this passively — weave in previous vocab to reinforce memory, or hint at',
      'the next chapter when the student is ready. Never dump this list on them directly.',
    );

    return lines.join('\n');
  } catch (err: any) {
    console.warn('[TextbookNav] buildAdjacentLessonContext failed:', err.message);
    return null;
  }
}
