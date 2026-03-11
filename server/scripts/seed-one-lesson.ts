import { seedLesson } from '../services/textbook-seed-service';

const LESSON_ID = process.argv[2] || 'c2b529b5-e3e1-4999-a20a-051e7d11feff';
const LANGUAGE  = process.argv[3] || 'spanish';
const LEVEL     = process.argv[4] || 'novice_low';

console.log(`[SeedOne] Seeding lesson ${LESSON_ID} (${LANGUAGE}, ${LEVEL})...`);

seedLesson(LESSON_ID, LANGUAGE, LEVEL)
  .then(wasNew => {
    console.log(`[SeedOne] Complete. wasNew=${wasNew}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('[SeedOne] Error:', err.message || err);
    console.error(err.stack);
    process.exit(1);
  });
