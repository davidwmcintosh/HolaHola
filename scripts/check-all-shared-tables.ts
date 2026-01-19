import { Pool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

const SHARED_TABLES = [
  'agent_observations', 'self_best_practices', 'tutor_procedures', 'teaching_principles',
  'tool_knowledge', 'situational_patterns', 'linguistic_bridges', 'language_idioms',
  'cultural_nuances', 'dialect_variations', 'learner_error_patterns', 'subtlety_cues',
  'emotional_patterns', 'creativity_templates', 'compass_principles', 'compass_understanding',
  'compass_examples', 'daniela_growth_memories', 'daniela_recommendations', 'daniela_beacons',
  'daniela_suggestions', 'daniela_suggestion_actions', 'daniela_feature_feedback', 'synthesized_insights',
  'pedagogical_insights', 'reflection_triggers', 'ai_suggestions', 'support_observations',
  'support_knowledge_base', 'support_patterns', 'wren_insights', 'curriculum_paths',
  'curriculum_units', 'curriculum_lessons', 'curriculum_drill_items', 'can_do_statements',
];

async function main() {
  const neonShared = new Pool({ connectionString: process.env.NEON_DATABASE_URL_SHARED });
  const source = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  
  let complete = 0, incomplete = 0;
  const issues: string[] = [];
  
  for (const table of SHARED_TABLES) {
    try {
      const srcResult = await source.query(`SELECT COUNT(*) as count FROM ${table}`);
      const neonResult = await neonShared.query(`SELECT COUNT(*) as count FROM ${table}`);
      const srcCount = parseInt(srcResult.rows[0].count);
      const neonCount = parseInt(neonResult.rows[0].count);
      if (neonCount >= srcCount) {
        complete++;
      } else {
        incomplete++;
        issues.push(`${table}: ${neonCount}/${srcCount} (${Math.round(neonCount/srcCount*100)}%)`);
      }
    } catch (e: any) {
      issues.push(`${table}: Error - ${e.message.substring(0, 50)}`);
    }
  }
  
  console.log(`\nMigration Status: ${complete}/${SHARED_TABLES.length} tables complete\n`);
  if (issues.length > 0) {
    console.log('Issues:');
    issues.forEach(i => console.log(`  - ${i}`));
  } else {
    console.log('All shared tables fully migrated! ✓');
  }
  
  await neonShared.end();
  await source.end();
}
main();
