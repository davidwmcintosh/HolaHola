import { getSharedDb } from '../db';
import { teachingPrinciples, toolKnowledge } from '../../shared/schema';
import { like, eq } from 'drizzle-orm';

async function run() {
  const db = getSharedDb();

  // Check Madrigal principles in teaching_principles table
  const all = await db.select({ principle: teachingPrinciples.principle, category: teachingPrinciples.category })
    .from(teachingPrinciples);
  const madrigal = all.filter(r => r.category?.toLowerCase().includes('madrigal') || r.principle?.toLowerCase().includes('madrigal'));
  console.log('teaching_principles total:', all.length);
  console.log('Madrigal-tagged entries:', madrigal.length);
  madrigal.forEach(r => console.log(' -', r.category, '|', r.principle?.slice(0, 80)));

  // Check categories present
  const cats = [...new Set(all.map(r => r.category))];
  console.log('\nAll categories:', cats.join(', '));

  // Check show_image in tool_knowledge
  const si = await db.select({ name: toolKnowledge.toolName, purpose: toolKnowledge.purpose })
    .from(toolKnowledge)
    .where(eq(toolKnowledge.toolName, 'SHOW_IMAGE'));
  console.log('\nSHOW_IMAGE in tool_knowledge:', si.length > 0 ? 'yes' : 'no');
  if (si[0]) console.log(' purpose:', si[0].purpose?.slice(0, 150));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
