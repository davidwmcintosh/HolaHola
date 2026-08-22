import { getSharedDb } from '../db';
import { scenarios, curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  // Lesson tagging status
  const allLessons = await db.select({ topics: curriculumLessons.requiredTopics, language: curriculumPaths.language })
    .from(curriculumLessons)
    .innerJoin(curriculumUnits, eq(curriculumUnits.id, curriculumLessons.curriculumUnitId))
    .innerJoin(curriculumPaths, eq(curriculumPaths.id, curriculumUnits.curriculumPathId));

  const byLang: Record<string, { tagged: number; total: number }> = {};
  for (const l of allLessons) {
    const lang = l.language;
    if (!byLang[lang]) byLang[lang] = { tagged: 0, total: 0 };
    byLang[lang].total++;
    if (l.topics && l.topics.length > 0) byLang[lang].tagged++;
  }
  console.log('\nLESSON TAGGING STATUS:');
  for (const [lang, counts] of Object.entries(byLang)) {
    const pct = Math.round(counts.tagged / counts.total * 100);
    console.log(`  ${lang.padEnd(12)} ${counts.tagged}/${counts.total} tagged (${pct}%)`);
  }

  // Scenario tagging status
  const allScenarios = await db.select({ topics: scenarios.curriculumTopics, slug: scenarios.slug }).from(scenarios);
  const tagged = allScenarios.filter(s => s.topics && s.topics.length > 0);
  console.log(`\nSCENARIO TAGGING STATUS: ${tagged.length}/${allScenarios.length} tagged`);
  for (const s of tagged.slice(0, 5)) {
    console.log(`  ${s.slug}: [${s.topics?.join(', ')}]`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
