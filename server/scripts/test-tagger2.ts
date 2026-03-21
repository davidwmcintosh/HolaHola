import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const KEYWORD_RULES: Array<[RegExp, string[]]> = [
  [/restaur|restaurant.*order|order.*food|ordering/i, ['food-vocabulary', 'ordering', 'polite-requests']],
  [/coffee|café|cafe|drinks?|bebida/i, ['food-vocabulary', 'ordering']],
  [/food|comida|cuisine|eat|meal|breakfast|lunch|dinner|menu/i, ['food-vocabulary']],
  [/direction|giving.*direction|navigate/i, ['directions', 'transportation']],
  [/hotel|check.?in|accommodation/i, ['travel', 'formal-requests']],
  [/shopping|at.*store|buying/i, ['shopping', 'prices-money']],
];

function keywordTag(name: string, description: string): string[] {
  const text = `${name} ${description}`;
  const matched = new Set<string>();
  for (const [pattern, slugs] of KEYWORD_RULES) {
    if (pattern.test(text)) {
      for (const s of slugs) matched.add(s);
    }
  }
  return [...matched];
}

async function main() {
  const db = getSharedDb();
  const rows = await db.select({
    id: curriculumLessons.id,
    name: curriculumLessons.name,
    description: curriculumLessons.description,
    topics: curriculumLessons.requiredTopics,
    language: curriculumPaths.language,
  })
  .from(curriculumLessons)
  .innerJoin(curriculumUnits, eq(curriculumUnits.id, curriculumLessons.curriculumUnitId))
  .innerJoin(curriculumPaths, eq(curriculumPaths.id, curriculumUnits.curriculumPathId))
  .where(eq(curriculumPaths.language, 'spanish'));

  const untagged = rows.filter(r => !r.topics || r.topics.length === 0);
  console.log(`Spanish untagged: ${untagged.length}`);
  
  let hits = 0;
  for (const l of untagged) {
    const topics = keywordTag(l.name, l.description || '');
    if (topics.length >= 2) {
      hits++;
      console.log(`✓ [${topics.join(',')}] ${l.name.slice(0, 60)}`);
    }
  }
  console.log(`\nKeyword hits: ${hits}/${untagged.length}`);
}
main().catch(console.error).finally(() => process.exit(0));
