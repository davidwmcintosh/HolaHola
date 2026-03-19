/**
 * Seed script: Upload generated People vocabulary images to object storage
 * and insert cache records into media_files so resolveVocabularyImage finds them.
 *
 * Run: npx tsx scripts/seed-vocab-people-images.ts
 */

import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const DB_URL = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL || "";
const SIDECAR = "http://127.0.0.1:1106";

if (!BUCKET_ID) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
if (!DB_URL) throw new Error("NEON_SHARED_DATABASE_URL not set");

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as any,
  projectId: "",
});

const sqlClient = neon(DB_URL);
const db = drizzle(sqlClient);

async function uploadFile(localPath: string, destFilename: string): Promise<string> {
  const buf = fs.readFileSync(localPath);
  const bucket = gcs.bucket(BUCKET_ID);
  const file = bucket.file(`public/ai-images/${destFilename}`);
  await file.save(buf, {
    contentType: "image/png",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `/api/media/ai-image/${destFilename}`;
}

async function seedMediaFile(
  url: string,
  searchQuery: string,
  filename: string,
  title: string,
  description: string
) {
  // Check if already exists (match on searchQuery regardless of imageSource)
  const existing = await db.execute(sql`
    SELECT id FROM media_files
    WHERE search_query = ${searchQuery}
    LIMIT 1
  `);
  if (existing.rows.length > 0) {
    console.log(`  ↩ Already seeded: ${searchQuery}`);
    return;
  }
  await db.execute(sql`
    INSERT INTO media_files (
      id, media_type, url, filename, mime_type,
      image_source, search_query,
      title, description,
      language, tags,
      usage_count, created_at
    ) VALUES (
      gen_random_uuid(), 'image', ${url}, ${filename}, 'image/png',
      'ai_generated', ${searchQuery},
      ${title}, ${description},
      'spanish', ARRAY['vocabulary','novice_low','section1'],
      0, NOW()
    )
  `);
  console.log(`  ✓ Seeded: ${searchQuery} → ${url}`);
}

// Map: { localFile, destFilename, cacheKeys[], title, description }
const vocabPlacesImages = [
  {
    localFile: "attached_assets/generated_images/vocab/places_casa.png",
    destFilename: "vocab_places_casa.png",
    cacheKeys: ["vocab_spanish_casa"],
    title: "La Casa",
    description: "House / home exterior",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_escuela.png",
    destFilename: "vocab_places_escuela.png",
    cacheKeys: ["vocab_spanish_escuela"],
    title: "La Escuela",
    description: "School building exterior",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_aula.png",
    destFilename: "vocab_places_aula.png",
    cacheKeys: ["vocab_spanish_aula", "vocab_spanish_salon", "vocab_spanish_clase"],
    title: "El Aula",
    description: "Classroom interior",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_restaurante.png",
    destFilename: "vocab_places_restaurante.png",
    cacheKeys: ["vocab_spanish_restaurante"],
    title: "El Restaurante",
    description: "Restaurant dining",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_parque.png",
    destFilename: "vocab_places_parque.png",
    cacheKeys: ["vocab_spanish_parque"],
    title: "El Parque",
    description: "City park with grass and trees",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_hospital.png",
    destFilename: "vocab_places_hospital.png",
    cacheKeys: ["vocab_spanish_hospital"],
    title: "El Hospital",
    description: "Hospital building exterior",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_supermercado.png",
    destFilename: "vocab_places_supermercado.png",
    cacheKeys: ["vocab_spanish_supermercado", "vocab_spanish_tienda", "vocab_spanish_mercado"],
    title: "El Supermercado",
    description: "Supermarket / grocery store",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_bano.png",
    destFilename: "vocab_places_bano.png",
    cacheKeys: ["vocab_spanish_bano", "vocab_spanish_servicio", "vocab_spanish_lavabo"],
    title: "El Baño",
    description: "Bathroom interior",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_dormitorio.png",
    destFilename: "vocab_places_dormitorio.png",
    cacheKeys: ["vocab_spanish_dormitorio", "vocab_spanish_cuarto", "vocab_spanish_habitacion"],
    title: "El Dormitorio",
    description: "Bedroom interior",
  },
  {
    localFile: "attached_assets/generated_images/vocab/places_cocina.png",
    destFilename: "vocab_places_cocina.png",
    cacheKeys: ["vocab_spanish_cocina"],
    title: "La Cocina",
    description: "Kitchen interior",
  },
];

const vocabPeopleImages = [
  {
    localFile: "attached_assets/generated_images/vocab/people_familia.png",
    destFilename: "vocab_people_familia.png",
    cacheKeys: [
      "vocab_spanish_madre",
      "vocab_spanish_padre",
      "vocab_spanish_hermano",
      "vocab_spanish_hermana",
      "vocab_spanish_bebe",
      "vocab_spanish_familia",
    ],
    title: "La Familia",
    description: "Family group — madre, padre, hermano, hermana, bebé",
  },
  {
    localFile: "attached_assets/generated_images/vocab/people_ninos.png",
    destFilename: "vocab_people_ninos.png",
    cacheKeys: ["vocab_spanish_nino", "vocab_spanish_nina"],
    title: "Los Niños",
    description: "Boy and girl children — niño, niña",
  },
  {
    localFile: "attached_assets/generated_images/vocab/people_amigos.png",
    destFilename: "vocab_people_amigos.png",
    cacheKeys: ["vocab_spanish_amigo", "vocab_spanish_amiga"],
    title: "Los Amigos",
    description: "Friends greeting — amigo, amiga",
  },
  {
    localFile: "attached_assets/generated_images/vocab/people_hombre.png",
    destFilename: "vocab_people_hombre.png",
    cacheKeys: ["vocab_spanish_hombre"],
    title: "El Hombre",
    description: "Generic adult man in casual clothes",
  },
  {
    localFile: "attached_assets/generated_images/vocab/people_mujer.png",
    destFilename: "vocab_people_mujer.png",
    cacheKeys: ["vocab_spanish_mujer"],
    title: "La Mujer",
    description: "Generic adult woman in casual clothes",
  },
  {
    localFile: "attached_assets/generated_images/vocab/people_profesor.png",
    destFilename: "vocab_people_profesor.png",
    cacheKeys: ["vocab_spanish_profesor", "vocab_spanish_profesora"],
    title: "El/La Profesor/a",
    description: "Teacher in classroom — profesor, profesora",
  },
  {
    localFile: "attached_assets/generated_images/vocab/people_estudiante.png",
    destFilename: "vocab_people_estudiante.png",
    cacheKeys: ["vocab_spanish_estudiante"],
    title: "El/La Estudiante",
    description: "Student with backpack and books",
  },
];

const vocabThingsImages = [
  {
    localFile: "attached_assets/generated_images/vocab/things_lapiz.png",
    destFilename: "vocab_things_lapiz.png",
    cacheKeys: ["vocab_spanish_lapiz"],
    title: "El Lápiz",
    description: "Pencil",
  },
  {
    localFile: "attached_assets/generated_images/vocab/things_boligrafo.png",
    destFilename: "vocab_things_boligrafo.png",
    // Both bolígrafo (formal/written) and pluma (common spoken, esp. Latin America)
    // point to the same image — Daniela may use either word
    cacheKeys: ["vocab_spanish_boligrafo", "vocab_spanish_pluma"],
    title: "El Bolígrafo / La Pluma",
    description: "Pen — bolígrafo (formal) or pluma (common spoken form)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/things_mesa.png",
    destFilename: "vocab_things_mesa.png",
    cacheKeys: ["vocab_spanish_mesa", "vocab_spanish_escritorio"],
    title: "La Mesa / El Escritorio",
    description: "Desk or table",
  },
  {
    localFile: "attached_assets/generated_images/vocab/things_silla.png",
    destFilename: "vocab_things_silla.png",
    cacheKeys: ["vocab_spanish_silla"],
    title: "La Silla",
    description: "Chair",
  },
  {
    localFile: "attached_assets/generated_images/vocab/things_puerta.png",
    destFilename: "vocab_things_puerta.png",
    cacheKeys: ["vocab_spanish_puerta"],
    title: "La Puerta",
    description: "Door",
  },
  {
    localFile: "attached_assets/generated_images/vocab/things_ventana.png",
    destFilename: "vocab_things_ventana.png",
    cacheKeys: ["vocab_spanish_ventana"],
    title: "La Ventana",
    description: "Window",
  },
  {
    localFile: "attached_assets/generated_images/vocab/things_agua.png",
    destFilename: "vocab_things_agua.png",
    cacheKeys: ["vocab_spanish_agua"],
    title: "El Agua",
    description: "Glass of water",
  },
];

const vocabFoodImages = [
  {
    localFile: "attached_assets/generated_images/vocab/food_leche.png",
    destFilename: "vocab_food_leche.png",
    cacheKeys: ["vocab_spanish_leche"],
    title: "La Leche",
    description: "Milk — glass and carton",
  },
  {
    localFile: "attached_assets/generated_images/vocab/food_huevo.png",
    destFilename: "vocab_food_huevo.png",
    cacheKeys: ["vocab_spanish_huevo"],
    title: "El Huevo",
    description: "Egg — whole and cracked showing yolk",
  },
  {
    localFile: "attached_assets/generated_images/vocab/food_arroz.png",
    destFilename: "vocab_food_arroz.png",
    cacheKeys: ["vocab_spanish_arroz"],
    title: "El Arroz",
    description: "Rice — bowl of cooked white rice",
  },
];

const vocabColorImages = [
  {
    localFile: "attached_assets/generated_images/vocab/color_rojo.png",
    destFilename: "vocab_color_rojo.png",
    cacheKeys: ["vocab_spanish_rojo"],
    title: "Rojo",
    description: "Red — color swatch",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_azul.png",
    destFilename: "vocab_color_azul.png",
    cacheKeys: ["vocab_spanish_azul"],
    title: "Azul",
    description: "Blue — color swatch",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_amarillo.png",
    destFilename: "vocab_color_amarillo.png",
    cacheKeys: ["vocab_spanish_amarillo"],
    title: "Amarillo",
    description: "Yellow — color swatch",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_verde.png",
    destFilename: "vocab_color_verde.png",
    cacheKeys: ["vocab_spanish_verde"],
    title: "Verde",
    description: "Green — color swatch",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_anaranjado.png",
    destFilename: "vocab_color_anaranjado.png",
    // naranja doubles as both the fruit and the color name in Spanish
    cacheKeys: ["vocab_spanish_anaranjado", "vocab_spanish_naranja_color"],
    title: "Anaranjado / Naranja",
    description: "Orange — color swatch (anaranjado = formal; naranja = common spoken)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_morado.png",
    destFilename: "vocab_color_morado.png",
    cacheKeys: ["vocab_spanish_morado", "vocab_spanish_violeta"],
    title: "Morado / Violeta",
    description: "Purple — color swatch (morado = Latin America; violeta = Spain)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_rosa.png",
    destFilename: "vocab_color_rosa.png",
    cacheKeys: ["vocab_spanish_rosa", "vocab_spanish_rosado"],
    title: "Rosa / Rosado",
    description: "Pink — color swatch (rosa = common; rosado = also used)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_marron.png",
    destFilename: "vocab_color_marron.png",
    // café = brown in Latin American Spanish (same word as coffee)
    cacheKeys: ["vocab_spanish_marron", "vocab_spanish_cafe_color"],
    title: "Marrón / Café",
    description: "Brown — color swatch (marrón = Spain; café = common in Latin America)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_negro.png",
    destFilename: "vocab_color_negro.png",
    cacheKeys: ["vocab_spanish_negro"],
    title: "Negro",
    description: "Black — color swatch",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_blanco.png",
    destFilename: "vocab_color_blanco.png",
    cacheKeys: ["vocab_spanish_blanco"],
    title: "Blanco",
    description: "White — color swatch",
  },
  {
    localFile: "attached_assets/generated_images/vocab/color_gris.png",
    destFilename: "vocab_color_gris.png",
    cacheKeys: ["vocab_spanish_gris"],
    title: "Gris",
    description: "Gray — color swatch",
  },
];

const vocabAdjectiveImages = [
  {
    localFile: "attached_assets/generated_images/vocab/adj_grande_pequeno.png",
    destFilename: "vocab_adj_grande_pequeno.png",
    // Both words on one contrast image
    cacheKeys: ["vocab_spanish_grande", "vocab_spanish_pequeno"],
    title: "Grande / Pequeño",
    description: "Big vs small — elephant and mouse contrast pair",
  },
  {
    localFile: "attached_assets/generated_images/vocab/adj_caliente_frio.png",
    destFilename: "vocab_adj_caliente_frio.png",
    cacheKeys: ["vocab_spanish_caliente", "vocab_spanish_frio"],
    title: "Caliente / Frío",
    description: "Hot vs cold — steaming cup and glass of ice",
  },
  {
    localFile: "attached_assets/generated_images/vocab/adj_bueno_malo.png",
    destFilename: "vocab_adj_bueno_malo.png",
    cacheKeys: ["vocab_spanish_bueno", "vocab_spanish_malo"],
    title: "Bueno / Malo",
    description: "Good vs bad — thumbs up and thumbs down",
  },
  {
    localFile: "attached_assets/generated_images/vocab/adj_abierto_cerrado.png",
    destFilename: "vocab_adj_abierto_cerrado.png",
    cacheKeys: ["vocab_spanish_abierto", "vocab_spanish_cerrado"],
    title: "Abierto / Cerrado",
    description: "Open vs closed — door shown both ways",
  },
  {
    localFile: "attached_assets/generated_images/vocab/adj_lleno_vacio.png",
    destFilename: "vocab_adj_lleno_vacio.png",
    cacheKeys: ["vocab_spanish_lleno", "vocab_spanish_vacio"],
    title: "Lleno / Vacío",
    description: "Full vs empty — full and empty glass",
  },
  {
    localFile: "attached_assets/generated_images/vocab/adj_limpio_sucio.png",
    destFilename: "vocab_adj_limpio_sucio.png",
    cacheKeys: ["vocab_spanish_limpio", "vocab_spanish_sucio"],
    title: "Limpio / Sucio",
    description: "Clean vs dirty — clean plate and muddy boot",
  },
  {
    localFile: "attached_assets/generated_images/vocab/adj_nuevo_viejo.png",
    destFilename: "vocab_adj_nuevo_viejo.png",
    cacheKeys: ["vocab_spanish_nuevo", "vocab_spanish_viejo"],
    title: "Nuevo / Viejo",
    description: "New vs old — shiny new sneaker and worn old shoe",
  },
];

const vocabActivityImages = [
  {
    localFile: "attached_assets/generated_images/vocab/act_comer.png",
    destFilename: "vocab_act_comer.png",
    cacheKeys: ["vocab_spanish_comer"],
    title: "Comer",
    description: "To eat — person eating at a table",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_beber.png",
    destFilename: "vocab_act_beber.png",
    cacheKeys: ["vocab_spanish_beber", "vocab_spanish_tomar"],
    title: "Beber / Tomar",
    description: "To drink — person drinking (beber = standard; tomar = common in Latin America)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_dormir.png",
    destFilename: "vocab_act_dormir.png",
    cacheKeys: ["vocab_spanish_dormir"],
    title: "Dormir",
    description: "To sleep — person sleeping in bed",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_leer.png",
    destFilename: "vocab_act_leer.png",
    cacheKeys: ["vocab_spanish_leer"],
    title: "Leer",
    description: "To read — person reading a book",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_escribir.png",
    destFilename: "vocab_act_escribir.png",
    cacheKeys: ["vocab_spanish_escribir"],
    title: "Escribir",
    description: "To write — person writing with pencil on paper",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_caminar.png",
    destFilename: "vocab_act_caminar.png",
    cacheKeys: ["vocab_spanish_caminar"],
    title: "Caminar",
    description: "To walk — person walking on a path",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_correr.png",
    destFilename: "vocab_act_correr.png",
    cacheKeys: ["vocab_spanish_correr"],
    title: "Correr",
    description: "To run — person running",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_hablar.png",
    destFilename: "vocab_act_hablar.png",
    cacheKeys: ["vocab_spanish_hablar"],
    title: "Hablar",
    description: "To talk — two people in conversation",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_escuchar.png",
    destFilename: "vocab_act_escuchar.png",
    cacheKeys: ["vocab_spanish_escuchar", "vocab_spanish_oir"],
    title: "Escuchar / Oír",
    description: "To listen — person with headphones (escuchar = to listen attentively; oír = to hear)",
  },
  {
    localFile: "attached_assets/generated_images/vocab/act_jugar.png",
    destFilename: "vocab_act_jugar.png",
    cacheKeys: ["vocab_spanish_jugar"],
    title: "Jugar",
    description: "To play — child playing with a ball",
  },
];

async function main() {
  const allImages = [
    ...vocabPeopleImages,
    ...vocabPlacesImages,
    ...vocabThingsImages,
    ...vocabFoodImages,
    ...vocabColorImages,
    ...vocabAdjectiveImages,
    ...vocabActivityImages,
  ];

  console.log(`=== Seeding ${allImages.length} vocabulary images (People + Places + Things + Food + Colors + Adjectives + Activities) ===\n`);

  for (const item of allImages) {
    if (!fs.existsSync(item.localFile)) {
      console.error(`✗ File not found: ${item.localFile}`);
      continue;
    }

    console.log(`Uploading ${path.basename(item.localFile)}...`);
    const url = await uploadFile(item.localFile, item.destFilename);
    console.log(`  → ${url}`);

    for (const cacheKey of item.cacheKeys) {
      await seedMediaFile(url, cacheKey, item.destFilename, item.title, item.description);
    }
    console.log();
  }

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
