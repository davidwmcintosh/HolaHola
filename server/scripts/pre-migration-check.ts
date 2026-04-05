import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    // Count total lessons in Spanish 1 - must all be accounted for
    const { rows: total } = await client.query(`
      SELECT COUNT(*) as n FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School'
    `);
    console.log(`Total Spanish 1 lessons: ${total[0].n}`);

    // All lesson IDs in the migration script
    const lessonIds = [
      '169ad5dd-42de-4b24-a3f6-4224a9d190fe','7f6fb8f7-ed46-43dc-9b9c-a510e08562da',
      '5077485c-1d52-48bb-830d-a5dbef37ee16','ba2fa3d4-406d-479a-bb63-f7c13063288c',
      'f9328483-817c-4e91-99b9-55cbef52a5a2','cf3a0d97-97af-48aa-830a-589983e78367',
      'b000180a-4fb0-4577-a66a-520820c06da5','c2b529b5-e3e1-4999-a20a-051e7d11feff',
      'ac00415a-f7d3-4ce7-9c61-130d2fc65868','849d020f-761c-4d2d-b8c9-afe260ddacb1',
      'b80ef519-ed54-48a0-9a06-d6abe5a7102b','2f4cb95d-541e-41ba-90d4-8078438f5e2b',
      '362aaf97-6cf9-41fd-ba01-a649f5a565c5','6281ad64-3a48-4a54-ac5f-e30e9794894a',
      '9fee889d-3876-4ce5-914e-bce4d1391dc7','11945002-e80c-43c2-ae3d-342cb636ebad',
      'b5f2a8dd-7fda-4bf6-a3dc-1893e26aa2dd','9b27bcb8-0297-4b7b-a5f6-e973ed3b5df9',
      '656abcef-6f49-4fc6-baac-f2bc426b8a01','686ab5a3-0e9b-418c-955c-185f0455003d',
      '2d192ad0-22ba-4060-8e65-b2f2cce4ff88','d74176ec-86a7-48cb-96f3-5ba9e5abcc52',
      '5e4b751a-fe4b-4c57-b25b-bc8ed9895ce1','16f36064-39d5-4584-a203-9226bbcced2b',
      '65ca8990-d41b-4677-865d-aaf718b40bc3','093e6ea5-d332-4230-8578-90c86d3190cb',
      '1771e04a-b9e4-428f-a0ed-be0da042153a','12ffbea1-e3ee-4860-8775-0710ecad8042',
      '7af7d6ef-32a4-43cd-887d-d8a6c231397a','d73c4ce0-05dc-4a2d-9fb9-ad153ad2772b',
      '6554f7d5-8576-4e83-9165-b63a3d9ccf7a','cb079e77-6dd7-4508-9032-ac88fd26d4b0',
      'e05c0d69-818e-43a7-88b0-02936df44597','8c61130d-cb2f-4885-82fd-c13fa969b8c8',
      '88c0bde0-a8e3-4bb9-a355-88ef2620d70f','d2bb18fa-acc8-4b12-ab25-a9c81355597f',
      '0e44e8bf-8490-4dce-a381-724182f0f862','0bc7443d-b4dd-4c67-8f45-d0f925ad2d09',
      '6561f7b7-a6be-470c-ae79-48e1144cdf77','13e783b7-52aa-4a5a-b7f5-4e5a6ca1925a',
      'a9015f2f-ddbf-47de-b1f5-4dd9ad290317','54cfe33e-f23f-48a6-af37-ae01ddc2c9cf',
      '65e47b2e-1dd6-49cd-be7a-f367acfcad9c',
    ];
    console.log(`Lesson IDs in migration script: ${lessonIds.length}`);

    // Check all exist
    const { rows: found } = await client.query(
      `SELECT id FROM curriculum_lessons WHERE id = ANY($1::varchar[])`,
      [lessonIds]
    );
    const foundIds = new Set(found.map(r => r.id));
    const missing = lessonIds.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
      console.log(`\n❌ MISSING lesson IDs:`);
      missing.forEach(id => console.log(`  ${id}`));
    } else {
      console.log(`✓ All ${lessonIds.length} lesson IDs verified in DB`);
    }

    // Check for any duplicates in our mapping (lesson assigned to 2 chapters)
    const seen = new Map<string, number>();
    lessonIds.forEach((id, i) => { if (seen.has(id)) console.log(`⚠ DUPLICATE at index ${i}: ${id}`); seen.set(id, i); });
    if (seen.size === lessonIds.length) console.log(`✓ No duplicate lesson assignments`);

    // Confirm counts match
    if (parseInt(total[0].n) === lessonIds.length) {
      console.log(`\n✅ Pre-check PASSED — all ${total[0].n} lessons accounted for`);
    } else {
      console.log(`\n⚠ Count mismatch: DB has ${total[0].n} lessons, script maps ${lessonIds.length}`);
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
