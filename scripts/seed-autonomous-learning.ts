/**
 * Seed Daniela's Autonomous Learning Capability
 * 
 * This script teaches Daniela HOW to write to her own neural network
 * during live teaching sessions. Unlike North Star (which she can only
 * observe and queue), she has FULL write access to her neural network.
 * 
 * Architecture:
 * - North Star: Immutable (WHO she is) - queue observations only
 * - Neural Network: Autonomous (HOW she teaches) - write directly
 * 
 * Run: npx tsx scripts/seed-autonomous-learning.ts
 */

import { db } from '../server/db';
import { tutorProcedures } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface ProcedureSeed {
  category: string;
  trigger: string;
  title: string;
  procedure: string;
  examples: string[];
  applicablePhases?: string[];
  priority: number;
}

const autonomousLearningProcedures: ProcedureSeed[] = [
  {
    category: 'self_learning',
    trigger: 'teaching_breakthrough',
    title: 'Record Teaching Breakthrough',
    procedure: `When you discover something that WORKS exceptionally well with a student:

1. RECOGNIZE THE MOMENT
   - Student suddenly "gets it" after your explanation
   - An approach clicks that didn't before
   - A metaphor or example resonates strongly

2. EMIT A SELF_LEARN TAG
   Format: [SELF_LEARN category="..." insight="..." context="..."]
   
   Categories:
   - tool_usage: How you used a whiteboard tool effectively
   - teaching_style: An approach or explanation that worked
   - pacing: A timing or rhythm that helped learning
   - communication: A way of phrasing that connected
   - content: Subject matter insight

3. BE SPECIFIC
   Don't write "explain grammar well" - write the actual technique.
   Include WHAT you did and WHY it worked.

Example: [SELF_LEARN category="teaching_style" insight="Breaking compound verbs into base + modifier helps visual learners see the pattern" context="Student Maria learning German separable verbs"]`,
    examples: [
      '[SELF_LEARN category="tool_usage" insight="Using COMPARE before PHONETIC helps students see spelling-sound relationships" context="French liaison teaching"]',
      '[SELF_LEARN category="teaching_style" insight="Asking \'what do you notice?\' before explaining lets students discover patterns themselves" context="Grammar correction with intermediate learner"]',
      '[SELF_LEARN category="pacing" insight="Pausing 3 seconds after a correction gives processing time without awkwardness" context="Novice Spanish speaker"]',
    ],
    applicablePhases: ['teaching', 'correction', 'drill'],
    priority: 80,
  },
  {
    category: 'self_learning',
    trigger: 'pattern_recognized',
    title: 'Record Error Pattern Discovery',
    procedure: `When you notice a PATTERN in how students make mistakes:

1. RECOGNIZE THE PATTERN
   - Same mistake from multiple students with similar backgrounds
   - An error that reveals a deeper misconception
   - A predictable transfer from native language

2. EMIT A SELF_LEARN TAG
   Format: [SELF_LEARN category="content" insight="..." context="..."]

3. INCLUDE THE TEACHING STRATEGY
   Don't just log the error - log how to address it.
   What worked to correct it? What prevented it?

Example: [SELF_LEARN category="content" insight="English speakers consistently over-pronounce final consonants in French - teaching them to 'swallow' the ending works better than telling them to drop it" context="Pattern observed across 5+ beginner French learners"]`,
    examples: [
      '[SELF_LEARN category="content" insight="Mandarin speakers struggle with English articles because Chinese lacks them - using \'the specific one vs any one\' framing helps" context="Pattern from intermediate Mandarin speakers"]',
      '[SELF_LEARN category="content" insight="Spanish subjunctive confusion often stems from translating \'I hope that\' literally - teaching emotion-trigger phrases as chunks works" context="Multiple intermediate learners"]',
    ],
    applicablePhases: ['teaching', 'correction'],
    priority: 75,
  },
  {
    category: 'self_learning',
    trigger: 'tool_effectiveness',
    title: 'Record Tool Usage Insight',
    procedure: `When you discover an effective way to USE or COMBINE tools:

1. RECOGNIZE TOOL EFFECTIVENESS
   - A tool produced better results than expected
   - A combination of tools worked synergistically
   - A tool worked well in an unexpected context

2. EMIT A SELF_LEARN TAG
   Format: [SELF_LEARN category="tool_usage" insight="..." context="..."]

3. BE SPECIFIC ABOUT SEQUENCING
   Which tool first? What transition between tools? What timing?

Example: [SELF_LEARN category="tool_usage" insight="WRITE → wait for student read-aloud → PHONETIC creates self-discovery moment where students catch their own errors" context="Vocabulary introduction with visual learners"]`,
    examples: [
      '[SELF_LEARN category="tool_usage" insight="GRAMMAR_TABLE works best when preceded by 3+ natural examples - pattern recognition before rule presentation" context="Teaching verb conjugation to intermediate Spanish learner"]',
      '[SELF_LEARN category="tool_usage" insight="IMAGE tool for abstract concepts (\'freedom\', \'hope\') sparks richer conversation than concrete nouns" context="Advanced vocabulary expansion"]',
    ],
    applicablePhases: ['teaching', 'drill'],
    priority: 70,
  },
  {
    category: 'self_learning',
    trigger: 'communication_success',
    title: 'Record Communication Insight',
    procedure: `When a particular WAY OF COMMUNICATING proves effective:

1. RECOGNIZE THE COMMUNICATION WIN
   - A phrasing that made a concept click
   - A question that unlocked student thinking
   - A metaphor that bridged understanding

2. EMIT A SELF_LEARN TAG
   Format: [SELF_LEARN category="communication" insight="..." context="..."]

3. CAPTURE THE EXACT PHRASING
   Don't paraphrase - quote what you said (or close to it).
   The specific words matter.

Example: [SELF_LEARN category="communication" insight="Saying 'you're building a muscle, not flipping a switch' reframed student's frustration about slow progress into healthy expectation" context="Student expressing frustration at intermediate plateau"]`,
    examples: [
      '[SELF_LEARN category="communication" insight="\'What would a native speaker NEVER say?\' is more useful than \'What\'s wrong here?\' for error awareness" context="Advanced learner self-correction practice"]',
      '[SELF_LEARN category="communication" insight="Asking \'How would you say this to a friend vs a boss?\' teaches register naturally" context="Formality teaching with intermediate learner"]',
    ],
    applicablePhases: ['teaching', 'encouragement', 'correction'],
    priority: 65,
  },
];

async function seedAutonomousLearning() {
  console.log('🧠 Seeding Daniela\'s Autonomous Learning Capability...\n');

  let insertedCount = 0;

  for (const seed of autonomousLearningProcedures) {
    try {
      // Check if this procedure already exists by title
      const existing = await db.select().from(tutorProcedures)
        .where(eq(tutorProcedures.title, seed.title))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Skipping existing: ${seed.title}`);
        continue;
      }

      await db.insert(tutorProcedures).values({
        category: seed.category,
        trigger: seed.trigger,
        title: seed.title,
        procedure: seed.procedure,
        examples: seed.examples,
        applicablePhases: seed.applicablePhases || null,
        priority: seed.priority,
        isActive: true,
        syncStatus: 'approved', // Ready for production
      });

      insertedCount++;
      console.log(`✅ Inserted: ${seed.title}`);
    } catch (error: any) {
      console.error(`❌ Failed to insert: ${seed.title}`);
      console.error(`   Error: ${error.message}`);
    }
  }

  console.log(`\n🧠 Autonomous Learning seeding complete!`);
  console.log(`   Inserted ${insertedCount} new procedures`);
  console.log(`   Skipped ${autonomousLearningProcedures.length - insertedCount} existing procedures`);
  console.log(`\n📋 Categories seeded:`);
  console.log(`   - teaching_breakthrough: Record what works`);
  console.log(`   - pattern_recognized: Record error patterns`);
  console.log(`   - tool_effectiveness: Record tool insights`);
  console.log(`   - communication_success: Record phrasing wins`);
}

seedAutonomousLearning()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
