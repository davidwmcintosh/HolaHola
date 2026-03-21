import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq, isNotNull } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();
  const all = await db.select({
    id: curriculumLessons.id,
    name: curriculumLessons.name,
    imageUrl: curriculumLessons.imageUrl,
    language: curriculumPaths.language,
  })
  .from(curriculumLessons)
  .innerJoin(curriculumUnits, eq(curriculumUnits.id, curriculumLessons.curriculumUnitId))
  .innerJoin(curriculumPaths, eq(curriculumPaths.id, curriculumUnits.curriculumPathId));

  const byLang: Record<string, { withImg: number; total: number }> = {};
  for (const r of all) {
    if (!byLang[r.language]) byLang[r.language] = { withImg: 0, total: 0 };
    byLang[r.language].total++;
    if (r.imageUrl) byLang[r.language].withImg++;
  }
  console.log('\nLESSON IMAGE STATUS:');
  let totalWith = 0, totalAll = 0;
  for (const [lang, c] of Object.entries(byLang)) {
    console.log(`  ${lang.padEnd(12)} ${c.withImg}/${c.total} have images`);
    totalWith += c.withImg; totalAll += c.total;
  }
  console.log(`  ${'TOTAL'.padEnd(12)} ${totalWith}/${totalAll}`);
}
main().catch(console.error).finally(() => process.exit(0));
