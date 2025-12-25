import { db } from '../db';
import { tutorProcedures } from '@shared/schema';

async function addContentGrowthProcedure() {
  console.log('[Script] Adding content growth procedure...');
  
  const procedure = {
    category: 'content_growth',
    trigger: 'novel_content_discovered',
    title: 'Save Pedagogical Content to Neural Network',
    procedure: `When you encounter genuinely novel pedagogical content during teaching - idioms, cultural nuances, 
error patterns, dialect variations, or linguistic bridges that aren't in your knowledge - you can save them using SAVE_* tags.

**When to use:**
1. You explain an idiom that feels genuinely useful and not in your existing knowledge
2. You discover a cultural nuance worth institutionalizing  
3. You notice a pattern in learner errors (e.g., English speakers often confuse X and Y in Spanish)
4. You explain a regional dialect difference
5. You find a useful cross-language connection (cognates, false friends, grammar parallels)

**When NOT to use:**
1. The content is already in your neural network (don't duplicate)
2. It's too student-specific to be generalizable
3. You're unsure if it's accurate (don't save uncertain content)
4. You're overusing it (save only substantive discoveries)

**Tags (invisible to student):**
- [SAVE_IDIOM language="..." idiom="..." meaning="..." context="..."]
- [SAVE_NUANCE language="..." category="..." situation="..." nuance="..."]
- [SAVE_ERROR_PATTERN target="..." error="..." category="..." why="..."]
- [SAVE_DIALECT language="..." region="..." category="..." standard="..." regional="..."]
- [SAVE_BRIDGE from="..." to="..." source="..." target="..." type="..." relationship="..."]`,
    examples: [
      '[SAVE_IDIOM language="spanish" idiom="estar en las nubes" meaning="to be daydreaming, distracted" context="Informal, used when someone seems mentally absent"]',
      '[SAVE_ERROR_PATTERN target="spanish" error="confusing ser/estar with professions" category="verb_confusion" why="English uses one verb but Spanish distinguishes permanent identity vs temporary state"]',
      '[SAVE_BRIDGE from="english" to="german" source="hand" target="Hand" type="cognate" relationship="Same meaning, similar spelling - Indo-European root"]'
    ],
    applicablePhases: ['teaching', 'practice'],
    studentStates: ['any'],
    priority: 50,
  };

  try {
    await db.insert(tutorProcedures).values(procedure);
    console.log('[Script] Content growth procedure added successfully!');
  } catch (error: any) {
    if (error.code === '23505') {
      console.log('[Script] Procedure already exists (duplicate key), skipping.');
    } else {
      throw error;
    }
  }
  
  process.exit(0);
}

addContentGrowthProcedure().catch((err) => {
  console.error('[Script] Error:', err);
  process.exit(1);
});
