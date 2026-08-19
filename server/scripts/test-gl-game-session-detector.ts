/**
 * CI: GL game-session auto-save detector
 *
 * Verifies that:
 * 1. detectGameInTranscript() correctly identifies known game types
 * 2. Sessions with < 3 exchanges return detected=false (not-a-game guard)
 * 3. Normal tutoring sessions return detected=false (no false positive)
 * 4. buildGameMemoryPayload() produces a fully de-identified payload with
 *    NO verbatim speech from EITHER side — including Daniela's turns which can
 *    echo student names (adversarial canary in daniela text).
 * 5. DB integration: maybeAutoSaveGameSession() inserts a row whose persisted
 *    fields contain no speech and no student identity, then cleans up.
 *
 * Self-check (--self-check flag):
 *   Uses the exported GAME_PATTERNS array as a live test seam: empties it,
 *   runs detectGameInTranscript on known counting exchanges, verifies
 *   detected=false, then restores and verifies detected=true.
 *
 * Usage:
 *   npx tsx server/scripts/test-gl-game-session-detector.ts           # all + DB
 *   npx tsx server/scripts/test-gl-game-session-detector.ts --self-check
 */

import {
  detectGameInTranscript,
  buildGameMemoryPayload,
  insertGameMemory,
  GAME_PATTERNS,
} from '../services/gl-game-session-detector';
import type { SessionExchange } from '../services/gl-game-session-detector';
import { reembedConversationMemory } from '../scripts/reembed-memory';
import { getSharedDb } from '../db';
import { conversationMemories, memoryEmbeddings } from '@shared/schema';
import { eq, sql, or, like } from 'drizzle-orm';

const IS_SELF_CHECK = process.argv.includes('--self-check');

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? `\n    ${detail}` : ''}`);
    failed++;
  }
}

// Canary strings that must NEVER appear in any persisted field.
// PII_CANARY_STUDENT appears in student turns.
// PII_CANARY_DANIELA appears in Daniela's turns — tutor speech routinely echoes
// student names ("Great job, XyloStudent!"), so Daniela's side must also be excluded.
const PII_CANARY_STUDENT = 'XyloStudent_PII_Canary';
const PII_CANARY_DANIELA = 'DanielaEchoCanary_PII';

function makeCountingExchanges(): SessionExchange[] {
  return [
    {
      user: `${PII_CANARY_STUDENT}: Let's count to ten in Spanish!`,
      daniela: `Sure ${PII_CANARY_DANIELA}! Let's count together. Uno, dos, tres...`,
    },
    { user: `${PII_CANARY_STUDENT}: Cuatro, cinco!`, daniela: '¡Muy bien! Seis, siete, ocho...' },
    { user: `${PII_CANARY_STUDENT}: Nueve, diez!`, daniela: '¡Perfecto! You counted to ten. Want to count to twenty?' },
    { user: `${PII_CANARY_STUDENT}: Vamos a contar más.`, daniela: '¡Claro! Dos, cuatro, seis...' },
  ];
}

function makeWordAssociationExchanges(): SessionExchange[] {
  return [
    { user: 'Want to play word association?', daniela: 'I love that game! I say a word, you say a word. Ready?' },
    { user: 'Casa', daniela: 'Familia!' },
    { user: 'Familia', daniela: 'Amor!' },
    { user: 'Amor', daniela: 'Corazón!' },
  ];
}

function makeRolePlayExchanges(): SessionExchange[] {
  return [
    { user: 'Let\'s do a role-play. Imagina que estás en un restaurante.', daniela: 'Perfecto! Buenos días, ¿qué desea pedir?' },
    { user: 'Quiero una ensalada, por favor.', daniela: 'Excelente. ¿Algo de beber?' },
    { user: 'Un agua. Eres un buen camarero.', daniela: 'Muy bien. Para el escenario, ¿algo más?' },
    { user: 'No, es todo.', daniela: 'Perfecto. Aquí tiene.' },
  ];
}

function makeNormalTutoringExchanges(): SessionExchange[] {
  return [
    { user: 'How do I say "I am happy" in Spanish?', daniela: 'You say "Estoy feliz" or "Estoy contento/a".' },
    { user: 'What about "I am tired"?', daniela: '"Estoy cansado" for masculine, "Estoy cansada" for feminine.' },
    { user: 'Can you give me a sentence with estoy?', daniela: 'Sure: "Hoy estoy muy contento porque es viernes."' },
    { user: 'That makes sense.', daniela: 'Great! Let\'s practice more.' },
  ];
}

function makeShortExchanges(): SessionExchange[] {
  return [
    { user: 'Hola', daniela: 'Hola! ¿Cómo estás?' },
    { user: 'Bien', daniela: 'Muy bien.' },
  ];
}

// ── Self-check mode ──────────────────────────────────────────────────────────

if (IS_SELF_CHECK) {
  console.log('\n[SELF-CHECK] Using GAME_PATTERNS as live test seam.\n');

  const exchanges = makeCountingExchanges();

  // 1. Verify real detector works BEFORE mutation
  const before = detectGameInTranscript(exchanges);
  if (!before.detected) {
    console.error('[SELF-CHECK] FAIL — detector returned detected=false on counting exchanges BEFORE patch');
    process.exit(1);
  }
  console.log(`  [OK] Before patch: detected=${before.detected}, gameType=${before.gameType}`);

  // 2. Empty GAME_PATTERNS (simulate guard removal) — run real detectGameInTranscript
  const savedPatterns = GAME_PATTERNS.splice(0, GAME_PATTERNS.length);
  const duringPatch = detectGameInTranscript(exchanges);
  GAME_PATTERNS.push(...savedPatterns); // restore immediately

  if (duringPatch.detected) {
    console.error('[SELF-CHECK] FAIL — detector returned detected=true even with GAME_PATTERNS emptied');
    process.exit(1);
  }
  console.log(`  [OK] With GAME_PATTERNS emptied: detected=${duringPatch.detected} (expected false)`);

  // 3. Verify restore
  const after = detectGameInTranscript(exchanges);
  if (!after.detected) {
    console.error('[SELF-CHECK] FAIL — detected=false AFTER pattern restore');
    process.exit(1);
  }
  console.log(`  [OK] After restore: detected=${after.detected}, gameType=${after.gameType}`);

  console.log('\n[SELF-CHECK] PASS — guard is real.\n');
  process.exit(0);
}

// ── Main tests ───────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log('\n=== GL Game Session Detector CI ===\n');

  // 1. Counting game detection
  console.log('1. Counting game detection');
  {
    const result = detectGameInTranscript(makeCountingExchanges());
    assert(result.detected === true, 'counting game is detected');
    assert(result.gameType === 'counting-game', `gameType is counting-game`, `got: ${result.gameType}`);
  }

  // 2. Word association detection
  console.log('\n2. Word association detection');
  {
    const result = detectGameInTranscript(makeWordAssociationExchanges());
    assert(result.detected === true, 'word association is detected');
    assert(result.gameType === 'word-association', `gameType is word-association`, `got: ${result.gameType}`);
  }

  // 3. Role-play detection
  console.log('\n3. Role-play detection');
  {
    const result = detectGameInTranscript(makeRolePlayExchanges());
    assert(result.detected === true, 'role-play is detected');
    assert(result.gameType === 'role-play', `gameType is role-play`, `got: ${result.gameType}`);
  }

  // 4. Normal tutoring — no false positive
  console.log('\n4. Normal tutoring — no false positive');
  {
    const result = detectGameInTranscript(makeNormalTutoringExchanges());
    assert(result.detected === false, 'normal tutoring session is NOT detected as a game');
  }

  // 4b. Vocabulary lesson false-positive guard
  // A normal lesson with "how do you say X?" and "what does Y mean?" questions
  // must NOT be classified as a vocabulary-quiz. These are the two patterns that
  // previously triggered a false positive on every standard tutoring session.
  console.log('\n4b. Vocabulary lesson false-positive guard (adversarial)');
  {
    const vocabLesson: SessionExchange[] = [
      { user: 'How do you say "happy" in Spanish?', daniela: 'You say "feliz" or "contento".' },
      { user: 'What does "triste" mean?', daniela: '"Triste" means sad.' },
      { user: 'How do you say "excited"?', daniela: '"Emocionado" for excited. Great progress!' },
      { user: 'What does "cansado" mean?', daniela: '"Cansado" means tired.' },
    ];
    const result = detectGameInTranscript(vocabLesson);
    assert(
      result.detected === false,
      'normal vocabulary lesson (how-do-you-say + what-does-mean) is NOT detected as a game',
      `got gameType=${result.gameType} — vocabulary-quiz requires explicit quiz signal, not generic tutoring prompts`,
    );
  }

  // 5. Short session guard (< 3 exchanges)
  console.log('\n5. Short session guard (< 3 exchanges)');
  {
    const result = detectGameInTranscript(makeShortExchanges());
    assert(result.detected === false, 'session with 2 exchanges is NOT detected as a game');
  }

  // 6. De-identification: buildGameMemoryPayload() contains no verbatim speech
  //    from EITHER side. Adversarial canary in Daniela's turns (PII_CANARY_DANIELA)
  //    simulates Daniela echoing the student's name — the most common tutor PII leak.
  console.log('\n6. De-identification: buildGameMemoryPayload() stores no verbatim speech (adversarial canary in Daniela turns)');
  {
    const exchanges = makeCountingExchanges();
    // Confirm the canary IS present in Daniela's raw turns (adversarial condition)
    const danielaHasCanary = exchanges.some(e => e.daniela.includes(PII_CANARY_DANIELA));
    assert(danielaHasCanary, `adversarial canary "${PII_CANARY_DANIELA}" is present in Daniela turns (precondition)`);

    const detection = detectGameInTranscript(exchanges);
    assert(detection.detected, 'counting exchanges detected (prerequisite for payload test)');

    const payload = buildGameMemoryPayload(exchanges, detection, 'spanish', 'Daniela');
    assert(payload !== null, 'buildGameMemoryPayload returns a payload for detected game');

    if (payload) {
      const allText = [
        payload.title,
        payload.summary,
        payload.content,
        payload.participants,
        ...payload.tags,
      ].join('\n');

      // Daniela-side canary must not appear (tutor speech excluded)
      assert(
        !allText.includes(PII_CANARY_DANIELA),
        `Daniela-side canary "${PII_CANARY_DANIELA}" not found in any payload field`,
        `Found in: ${[
          payload.title.includes(PII_CANARY_DANIELA) ? 'title' : null,
          payload.summary.includes(PII_CANARY_DANIELA) ? 'summary' : null,
          payload.content.includes(PII_CANARY_DANIELA) ? 'content' : null,
          payload.participants.includes(PII_CANARY_DANIELA) ? 'participants' : null,
        ].filter(Boolean).join(', ') || '(allText match — check tags)'}`,
      );

      // Student-side canary must not appear
      assert(
        !allText.includes(PII_CANARY_STUDENT),
        `student-side canary "${PII_CANARY_STUDENT}" not found in any payload field`,
      );

      // Student utterance phrase must not appear (no student speech)
      assert(
        !allText.includes("Let's count to ten"),
        'no verbatim student utterance in any payload field',
      );

      // Tutor utterance phrase must not appear (no tutor speech)
      assert(
        !allText.includes('Uno, dos, tres'),
        'no verbatim tutor utterance in any payload field',
      );

      // Participants must use the generic label
      assert(
        payload.participants === 'Student [GL] + Daniela [GL]',
        `participants is generic "Student [GL] + Daniela [GL]"`,
        `got: "${payload.participants}"`,
      );

      // Title must identify the game type
      assert(payload.title.includes('counting game'), `title includes "counting game"`, `got: "${payload.title}"`);

      // Content must be structured metadata (key: value lines), not speech
      assert(payload.content.startsWith('game_type:'), `content starts with "game_type:" (metadata format)`);
      assert(payload.content.includes('note: verbatim speech not stored'), 'content includes privacy note');

      // Required searchability tags
      assert(payload.tags.includes('game-session'), 'tags includes game-session');
      assert(payload.tags.includes('counting-game'), 'tags includes counting-game');
      assert(payload.tags.includes('gl-auto-capture'), 'tags includes gl-auto-capture');
    }
  }

  // 7. DB integration: insertGameMemory() + reembedConversationMemory() persists a
  //    de-identified row and its embeddings, all verifiable and cleanable by the
  //    specific ID returned from the insert — never a tag-query that could match
  //    a real production row. Cleanup runs in finally so it is never skipped.
  console.log('\n7. DB integration — inserted row contains no verbatim speech or canary identity');
  {
    const exchanges = makeCountingExchanges();
    const detection = detectGameInTranscript(exchanges);

    // Add a unique CI sentinel tag so the row is unambiguous and never confused
    // with a real production game-session row.
    const ciSentinel = `ci-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = buildGameMemoryPayload(exchanges, detection, 'spanish', 'Daniela')!;
    const testPayload = { ...payload, tags: [...payload.tags, ciSentinel] };

    // insertGameMemory returns the ID immediately — no fire-and-forget ambiguity.
    const memoryId = await insertGameMemory(testPayload, undefined);
    assert(memoryId !== null, `insertGameMemory returned an ID`);

    if (memoryId) {
      // Await the embedding explicitly so it completes before we verify or clean up.
      // This prevents orphaned embeddings from being written after the memory row
      // is deleted (the race condition in the fire-and-forget path).
      await reembedConversationMemory(memoryId, undefined);

      const db = getSharedDb();
      let cleanupDone = false;

      try {
        // Query by the specific ID returned — not by tag pattern.
        const rows = await db
          .select({
            title: conversationMemories.title,
            summary: conversationMemories.summary,
            content: conversationMemories.content,
            participants: conversationMemories.participants,
            tags: conversationMemories.tags,
          })
          .from(conversationMemories)
          .where(eq(conversationMemories.id, memoryId))
          .limit(1);

        assert(rows.length === 1, `DB row found by ID ${memoryId}`);

        if (rows.length === 1) {
          const row = rows[0];
          const allDbText = [
            row.title ?? '',
            row.summary ?? '',
            row.content ?? '',
            row.participants ?? '',
            ...(row.tags ?? []),
          ].join('\n');

          assert(row.title === payload.title, `DB title matches payload`, `got: "${row.title}"`);
          assert(row.participants === 'Student [GL] + Daniela [GL]', `DB participants is generic`, `got: "${row.participants}"`);

          assert(!allDbText.includes(PII_CANARY_DANIELA), `DB: Daniela-side canary not found in any field`);
          assert(!allDbText.includes(PII_CANARY_STUDENT), `DB: student-side canary not found in any field`);
          assert(!allDbText.includes('Uno, dos, tres'), `DB content: no verbatim tutor speech`);
          assert(!allDbText.includes("Let's count to ten"), `DB content: no verbatim student speech`);
          assert((row.content ?? '').startsWith('game_type:'), `DB content is metadata-only format`);
          assert((row.tags ?? []).includes(ciSentinel), `DB row has CI sentinel tag (confirms correct row)`);

          console.log(`   Verified row id: ${memoryId}, title: "${row.title}"`);
        }
      } finally {
        // Always clean up this specific row and ALL its embeddings.
        // memory_embeddings has no FK to conversation_memories, so the DB does not
        // cascade. Cleanup by the exact ID prevents accidental production data loss.
        try {
          const db2 = getSharedDb();
          await db2.execute(
            sql`DELETE FROM memory_embeddings
                WHERE memory_id = ${memoryId}
                   OR memory_id LIKE ${memoryId + ':chunk:%'}`,
          );
          await db2.delete(conversationMemories).where(eq(conversationMemories.id, memoryId));
          console.log(`   Cleaned up test row ${memoryId} and all its embeddings`);
          cleanupDone = true;
        } catch (cleanupErr: any) {
          console.warn(`   Cleanup warning: ${cleanupErr?.message}`);
        }
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
