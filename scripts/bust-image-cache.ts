/**
 * Appends ?v=2 to all recently-regenerated vocab image URLs in the DB.
 * The browser treats ?v=2 as a new URL → fetches fresh from the server.
 * The server-side route strips query params when looking up the file in GCS.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const DB_URL = process.env.NEON_SHARED_DATABASE_URL || '';
if (!DB_URL) throw new Error('NEON_SHARED_DATABASE_URL not set');

const sqlClient = neon(DB_URL);
const db = drizzle(sqlClient);

// All filenames that were recently regenerated
const UPDATED_FILENAMES = [
  'vocab_adj_cerca_lejos.png',
  'vocab_adj_alto_bajo.png',
  'vocab_adj_pesado_ligero.png',
  'vocab_adj_joven_viejo_personas.png',
  'vocab_adj_facil_dificil.png',
  'vocab_adj_ruidoso_tranquilo.png',
  'vocab_adj_oscuro_claro.png',
  'vocab_adj_duro_suave.png',
  'vocab_adj_feliz_triste.png',
  'vocab_adj_rapido_lento.png',
  'vocab_act_cocinar.png',
  'vocab_act_bailar.png',
  'vocab_act_comprar.png',
];

async function main() {
  for (const filename of UPDATED_FILENAMES) {
    // Remove any existing ?v= param first, then add ?v=2
    const baseUrl = `/api/media/ai-image/${filename}`;
    const newUrl  = `${baseUrl}?v=2`;

    const result = await db.execute(sql`
      UPDATE media_files
      SET url = ${newUrl}
      WHERE filename = ${filename}
         OR url LIKE ${baseUrl + '%'}
    `);
    console.log(`Updated ${filename} → ${newUrl}`);
  }
  console.log('\n✅ Cache bust complete — browser will fetch fresh versions.');
}

main().catch(err => { console.error(err); process.exit(1); });
