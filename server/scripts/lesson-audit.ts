import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();
  const rows = await db.select({
    id: curriculumLessons.id,
    name: curriculumLessons.name,
    lessonType: curriculumLessons.lessonType,
    language: curriculumPaths.language,
    topics: curriculumLessons.requiredTopics,
    description: curriculumLessons.description,
  })
  .from(curriculumLessons)
  .innerJoin(curriculumUnits, eq(curriculumUnits.id, curriculumLessons.curriculumUnitId))
  .innerJoin(curriculumPaths, eq(curriculumPaths.id, curriculumUnits.curriculumPathId))
  .where(eq(curriculumPaths.language, 'spanish'))
  .orderBy(curriculumUnits.name);

  console.log(`Spanish lessons: ${rows.length} total`);
  const untagged = rows.filter(r => !r.topics || r.topics.length === 0);
  const tagged = rows.filter(r => r.topics && r.topics.length > 0);
  console.log(`Tagged: ${tagged.length}, Untagged: ${untagged.length}\n`);

  for (const l of untagged) {
    const desc = (l.description || '').slice(0, 80);
    console.log(`[${l.id.slice(0,8)}] [${l.lessonType.padEnd(12)}] ${l.name}`);
    if (desc) console.log(`  desc: ${desc}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
