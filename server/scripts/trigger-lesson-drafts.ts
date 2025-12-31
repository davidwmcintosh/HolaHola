import { generateLessonsForGaps } from '../services/ai-lesson-generator';

async function run() {
  const languages = ['spanish', 'french', 'portuguese'];
  
  for (const lang of languages) {
    console.log(`\nGenerating 3 drafts for ${lang}...`);
    try {
      // Pass undefined for createdBy to allow NULL in database
      const result = await generateLessonsForGaps(lang, 3, undefined);
      console.log(`  Generated: ${result.generated}, Errors: ${result.errors.length}`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join('; ')}`);
      }
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  process.exit(0);
}

run();
