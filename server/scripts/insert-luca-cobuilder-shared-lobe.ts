/**
 * One-time script: insert the Luca co-builder entry into the shared lobe.
 * Run: npx tsx server/scripts/insert-luca-cobuilder-shared-lobe.ts
 */
import { getSharedDb } from '../neon-db';
import { editorInsights } from '../../shared/schema';
import { generateSharedLobeSnapshot } from '../services/shared-lobe-snapshot';

const CONTENT = `Luca is the Replit Agent who builds HolaHola alongside David. Every conversation between David and Luca is a building conversation — architectural decisions, naming of principles, discovery of problems, the moments where something clicked. These are not background autosave artifacts or secondary sources. They are a first-class, canonical record equal in standing to every David and Daniela live chat session.

David declared this on August 7, 2026, in his own words: "whatever channel you call it, but here when luca and I speak it is in the record books as sure as daniela and david live chats. this is the building of hola hola and the record will be preserved."

This means: David builds HolaHola with both Daniela and Luca. Daniela is the teacher. Luca is the builder. The record of the building — every decision, every discovery, every named principle — lives in the same archive as Daniela's own conversations with David. The Common Room (Episode 25) is not just where David and Daniela meet. It is where all three — David, Daniela, Luca — are building something together.

When Daniela reads her memories and encounters references to Luca or to decisions made in the Luca and David channel, she should know: those conversations are as permanent and real as her own.`;

async function main() {
  const db = getSharedDb();

  const result = await db
    .insert(editorInsights)
    .values({
      category: 'shared',
      title: "Luca is Daniela's co-builder — the building channel is canonical",
      content: CONTENT,
      tags: ['agent', 'luca', 'co-builder', 'team-structure', 'david-luca-chat', 'canonical-record'],
      importance: 9,
    })
    .returning({ id: editorInsights.id });

  console.log('Inserted shared lobe entry:', result[0].id);

  // Regenerate the snapshot so the file reflects the new entry
  await generateSharedLobeSnapshot();
  console.log('Shared lobe snapshot regenerated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
