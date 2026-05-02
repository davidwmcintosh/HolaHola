/**
 * Seed script: populate textbook_lesson_content with one Madrigal chapter
 * for testing start_textbook_page.
 *
 * Lesson: madrigal-ch1-ar-present
 * Source: Madrigal's Magic Key to Spanish, Chapter 1
 * Topic: Present tense of -AR verbs; core vocabulary
 *
 * Run: npx tsx server/scripts/seed-textbook-page.ts
 */

import { getSharedDb } from '../db';
import { textbookLessonContent } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const LESSON_ID = 'madrigal-ch1-ar-present';

const vocabularyList = [
  { word: 'hablar', translation: 'to speak', partOfSpeech: 'verb', exampleSentences: [{ target: 'Yo hablo español.', translation: 'I speak Spanish.' }] },
  { word: 'caminar', translation: 'to walk', partOfSpeech: 'verb', exampleSentences: [{ target: 'Ella camina al parque.', translation: 'She walks to the park.' }] },
  { word: 'cantar', translation: 'to sing', partOfSpeech: 'verb', exampleSentences: [{ target: 'Nosotros cantamos juntos.', translation: 'We sing together.' }] },
  { word: 'bailar', translation: 'to dance', partOfSpeech: 'verb', exampleSentences: [{ target: '¿Bailas tango?', translation: 'Do you dance tango?' }] },
  { word: 'trabajar', translation: 'to work', partOfSpeech: 'verb', exampleSentences: [{ target: 'Él trabaja mucho.', translation: 'He works a lot.' }] },
  { word: 'necesitar', translation: 'to need', partOfSpeech: 'verb', exampleSentences: [{ target: 'Necesito un café.', translation: 'I need a coffee.' }] },
  { word: 'escuchar', translation: 'to listen', partOfSpeech: 'verb', exampleSentences: [{ target: 'Escuchas música.', translation: 'You listen to music.' }] },
  { word: 'mirar', translation: 'to look/watch', partOfSpeech: 'verb', exampleSentences: [{ target: 'Miramos la tele.', translation: 'We watch TV.' }] },
  { word: 'tomar', translation: 'to take/drink', partOfSpeech: 'verb', exampleSentences: [{ target: 'Tomo café por la mañana.', translation: 'I drink coffee in the morning.' }] },
  { word: 'usar', translation: 'to use', partOfSpeech: 'verb', exampleSentences: [{ target: 'Ella usa el teléfono.', translation: 'She uses the phone.' }] },
];

const grammarExplanation = `The -AR verb pattern is the largest verb family in Spanish. Every -AR verb shares the same set of endings in the present tense:

  yo        -o     (hablo, camino, canto)
  tú        -as    (hablas, caminas, cantas)
  él/ella   -a     (habla, camina, canta)
  nosotros  -amos  (hablamos, caminamos, cantamos)
  ellos     -an    (hablan, caminan, cantan)

The key insight (Madrigal's approach): once you've drilled ONE -AR verb all the way through, you've installed the compartment — the other verbs click in automatically. Pound "hablar" first, then swap in new verbs. The ending is the lock; each verb is just a new key.`;

// Key example sentences stored in grammarExamples (schema field)
const grammarExamples = [
  { target: 'Yo hablo español.', translation: 'I speak Spanish.', note: 'yo → -o ending' },
  { target: '¿Hablas inglés?', translation: 'Do you speak English?', note: 'tú → -as ending' },
  { target: 'Ella habla mucho.', translation: 'She speaks a lot.', note: 'ella → -a ending' },
  { target: 'Nosotros hablamos todos los días.', translation: 'We speak every day.', note: 'nosotros → -amos ending' },
  { target: 'Ellos hablan rápido.', translation: 'They speak fast.', note: 'ellos → -an ending' },
  { target: 'Camino al trabajo.', translation: 'I walk to work.', note: 'swap hablar → caminar: same endings' },
  { target: 'Ella canta bien.', translation: 'She sings well.', note: 'swap → cantar: same -a ending' },
  { target: 'Bailamos salsa los viernes.', translation: 'We dance salsa on Fridays.', note: 'nosotros → bailar' },
  { target: 'Necesito practicar.', translation: 'I need to practice.', note: 'infinitive after necessity verb' },
  { target: 'Él trabaja en una oficina.', translation: 'He works in an office.', note: 'él → trabajar: -a ending' },
];

// conjugation table stored in microCycleData; grammarExamples above is the canonical example set

const microCycleData = {
  patternLabel: 'yo-AR-present',
  sentenceColumns: [
    { label: 'Subject', items: ['Yo', 'Tú', 'Él', 'Nosotros', 'Ellos'] },
    { label: 'Verb stem', items: ['habl', 'camin', 'cant', 'bail', 'trabaj'] },
    { label: 'Ending', items: ['-o', '-as', '-a', '-amos', '-an'] },
  ],
  negativeItems: [
    'No hablo italiano.',
    'No camina rápido.',
    'No cantamos ópera.',
  ],
  questionItems: [
    '¿Hablas español?',
    '¿Trabajas mucho?',
    '¿Cantamos ahora?',
  ],
};

const introduction = `Chapter 1 of Madrigal's Magic Key to Spanish introduces the most common verb family: -AR verbs. There are thousands of -AR verbs in Spanish, and they all follow the same ending pattern. Master this pattern once, and every new -AR verb clicks into place automatically — no memorization required, just repetition with a variety of verbs.`;

const culturalNote = `Spanish is spoken by over 500 million people worldwide. Most everyday conversation relies on a core set of about 50 verbs — and nearly half of them are -AR verbs. Habits like "trabajar" (to work), "caminar" (to walk), "hablar" (to speak), and "escuchar" (to listen) appear constantly. Drill these early and you'll have the building blocks of real conversation.`;

async function seed() {
  const db = getSharedDb();

  // Upsert (delete + insert since lesson content doesn't have an ON CONFLICT clause)
  await db.delete(textbookLessonContent)
    .where(eq(textbookLessonContent.lessonId, LESSON_ID));

  await db.insert(textbookLessonContent).values({
    lessonId: LESSON_ID,
    language: 'spanish',
    actflLevel: 'novice-high',
    introduction,
    grammarExplanation,
    grammarExamples,
    vocabularyList,
    culturalNote,
    microCycleData,
    seedVersion: 1,
  } as any);

  console.log(`✓ Seeded textbook page: ${LESSON_ID}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
