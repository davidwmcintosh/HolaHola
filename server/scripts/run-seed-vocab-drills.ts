import { seedVocabDrillItems } from '../services/vocab-drill-seed-service';

async function main() {
  const languages = process.argv[2] ? process.argv[2].split(',') : undefined;
  console.log('Starting vocab drill seed for:', languages ?? 'ALL');
  const results = await seedVocabDrillItems({
    languages,
    onProgress: (msg) => process.stdout.write(msg + '\n'),
  });

  const totalCreated = results.reduce((a, r) => a + r.itemsCreated, 0);
  const totalProcessed = results.reduce((a, r) => a + r.lessonsProcessed, 0);
  const totalSkipped = results.reduce((a, r) => a + r.lessonsSkipped, 0);
  const totalNoProse = results.reduce((a, r) => a + r.lessonsNoProse, 0);

  console.log('\n=== VOCAB DRILL SEED RESULTS ===');
  for (const r of results) {
    console.log(`${r.language.padEnd(12)}: processed=${r.lessonsProcessed}, created=${r.itemsCreated}, skipped=${r.lessonsSkipped}, no-prose=${r.lessonsNoProse}, errors=${r.errors.length}`);
    if (r.errors.length > 0) {
      for (const e of r.errors) console.log(`  ERROR: ${e}`);
    }
  }
  console.log(`\nTOTAL: ${totalCreated} drill items created across ${totalProcessed} lessons (${totalSkipped} skipped, ${totalNoProse} no-prose)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
