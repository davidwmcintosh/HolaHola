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
  // Check if already exists
  const existing = await db.execute(sql`
    SELECT id FROM media_files
    WHERE image_source = 'stock' AND search_query = ${searchQuery}
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
      'stock', ${searchQuery},
      ${title}, ${description},
      'spanish', ARRAY['vocabulary','novice_low','people','section1'],
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

async function main() {
  const allImages = [...vocabPeopleImages, ...vocabPlacesImages];

  console.log(`=== Seeding ${allImages.length} vocabulary images (People + Places) ===\n`);

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
