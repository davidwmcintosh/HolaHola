import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    // Get lessons in Ch 1 and their drill items
    const { rows: lessons } = await client.query(`
      SELECT cl.id, cl.name, array_length(cl.required_vocabulary, 1) as vocab_count, cl.required_vocabulary
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School' AND cu.order_index = 1 AND cu.name NOT LIKE '[ARCHIVED]%'
      ORDER BY cl.order_index
    `);
    
    for (const lesson of lessons) {
      console.log(`\nLesson: "${lesson.name}" (id: ${lesson.id})`);
      console.log(`  Required vocab (${lesson.vocab_count}): ${lesson.required_vocabulary?.slice(0, 8).join(', ')}`);
      
      const { rows: drills } = await client.query(`
        SELECT item_type, target_text, target_language
        FROM curriculum_drill_items 
        WHERE lesson_id = $1
        ORDER BY order_index
        LIMIT 30
      `, [lesson.id]);
      
      console.log(`  Drill items: ${drills.length}`);
      
      // Flag any food/restaurant items
      const foodTerms = ['menú', 'mesa', 'cuenta', 'restaur', 'comida', 'hambre', 'horchata', 'taco', 'agua', 'café con', 'pescado', 'picante', 'vegetariano', 'baño', 'por favor'];
      const foodDrills = drills.filter(d => {
        const t = (d.target_text || '').toLowerCase();
        return foodTerms.some(term => t.includes(term));
      });
      
      if (foodDrills.length > 0) {
        console.log(`  ⚠ FOOD/RESTAURANT DRILLS FOUND (${foodDrills.length}):`);
        foodDrills.forEach(d => console.log(`    - "${d.target_text}" [${d.item_type}]`));
      } else {
        console.log(`  ✓ No food/restaurant content`);
      }
      
      // Show sample of what IS there
      console.log(`  Sample drills (first 5):`);
      drills.slice(0, 5).forEach(d => console.log(`    - "${d.target_text}" [${d.item_type}]`));
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
