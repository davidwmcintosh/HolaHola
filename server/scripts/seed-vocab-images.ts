/**
 * Standalone vocab image seeder script.
 * Run with: npx tsx server/scripts/seed-vocab-images.ts [language]
 *
 * Examples:
 *   npx tsx server/scripts/seed-vocab-images.ts spanish
 *   npx tsx server/scripts/seed-vocab-images.ts all
 */

import '../db'; // init DB pools

const targetLang = process.argv[2] || 'all';

async function main() {
  if (targetLang === 'all') {
    const { seedAllVocabImages, bulkVocabSeedJobs, vocabSeedJobs } = await import('../services/vocab-image-seed-service');
    const jobId = `cli-seed-all-${Date.now()}`;
    console.log('Starting bulk vocab image seeding for ALL languages...\n');
    await seedAllVocabImages(jobId);
    const bulk = bulkVocabSeedJobs.get(jobId);
    console.log('\n=== BULK SEED SUMMARY ===');
    console.log(`Status: ${bulk?.status}`);
    console.log(`Languages: ${bulk?.completed.join(', ')}`);
    if (bulk?.errors.length) console.log(`Errors: ${bulk.errors.join('\n  ')}`);
    for (const lang of (bulk?.languages ?? [])) {
      const sub = vocabSeedJobs.get(`${jobId}-${lang}`);
      if (sub) {
        console.log(`\n[${lang}] cached=${sub.cached} generated=${sub.generated} skipped=${sub.skipped} errors=${sub.errors.length}`);
      }
    }
  } else {
    const { seedVocabImages, vocabSeedJobs } = await import('../services/vocab-image-seed-service');
    const jobId = `cli-seed-${targetLang}-${Date.now()}`;
    console.log(`Starting vocab image seeding for: ${targetLang}\n`);
    await seedVocabImages(targetLang, jobId);
    const job = vocabSeedJobs.get(jobId);
    console.log('\n=== SEED SUMMARY ===');
    console.log(`Language:  ${job?.language}`);
    console.log(`Status:    ${job?.status}`);
    console.log(`Total:     ${job?.total}`);
    console.log(`Cached:    ${job?.cached}  (already had image)`);
    console.log(`Generated: ${job?.generated}  (new DALL-E)`);
    console.log(`Skipped:   ${job?.skipped}  (placeholder/error)`);
    if (job?.errors.length) {
      console.log(`\nErrors (${job.errors.length}):`);
      job.errors.forEach(e => console.log(`  ${e}`));
    }
  }

  // Give DB pools a moment to drain
  await new Promise(r => setTimeout(r, 1000));
  process.exit(0);
}

main().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
