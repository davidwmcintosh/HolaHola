/**
 * upload-madrigal-scans.ts
 *
 * Extracts every page of "See It and Say It in Spanish" (and its Appendix) as a
 * JPEG using pdftoppm (one page at a time), then uploads each image to Object
 * Storage under:
 *
 *   public/madrigal/scans/main/page-001.jpg   (98 pages)
 *   public/madrigal/scans/appendix/page-001.jpg (29 pages)
 *
 * Safe to re-run — already-uploaded pages are skipped.
 *
 * Usage:  npx tsx server/scripts/upload-madrigal-scans.ts
 */

import { execSync } from "child_process";
import { readFileSync, unlinkSync, mkdirSync, existsSync, readdirSync } from "fs";
import * as path from "path";
import * as os from "os";
import { makeStorageFile, uploadBuffer } from "../replit_integrations/object_storage/objectStorage";

const BUCKET_NAME =
  process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ||
  process.env.AWS_S3_DESTINATION_BUCKET ||
  "";

if (!BUCKET_NAME) {
  console.error(
    "[MadrigalScans] No bucket configured. Set DEFAULT_OBJECT_STORAGE_BUCKET_ID or AWS_S3_DESTINATION_BUCKET."
  );
  process.exit(1);
}
const DPI = 120;
const CROOT = process.cwd();

const SOURCES: { label: string; pdf: string; storagePrefix: string; totalPages: number }[] = [
  {
    label: "main",
    pdf: "see_it_and_say_it_1780423188356.pdf",
    storagePrefix: "public/madrigal/scans/main",
    totalPages: 98,
  },
  {
    label: "appendix",
    pdf: "Appendix_See_it_and_say_it_spanish_1780423201777.pdf",
    storagePrefix: "public/madrigal/scans/appendix",
    totalPages: 29,
  },
];

async function uploadSource(source: (typeof SOURCES)[0]) {
  const pdfPath = path.join(CROOT, "attached_assets", source.pdf);
  if (!existsSync(pdfPath)) {
    console.warn(`[MadrigalScans] PDF not found: ${pdfPath} — skipping`);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `madrigal-${source.label}`);
  mkdirSync(tmpDir, { recursive: true });

  let uploaded = 0;
  let skipped = 0;

  console.log(`\n[MadrigalScans:${source.label}] Processing ${source.totalPages} pages…`);

  for (let pageNum = 1; pageNum <= source.totalPages; pageNum++) {
    const padded = String(pageNum).padStart(3, "0");
    const destination = `${source.storagePrefix}/page-${padded}.jpg`;

    // Check if already uploaded
    const exists = await makeStorageFile(BUCKET_NAME, destination).exists();
    if (exists) {
      skipped++;
      process.stdout.write(`  skip page-${padded}\r`);
      continue;
    }

    // Extract single page
    const outBase = path.join(tmpDir, `page-${padded}`);
    execSync(
      `pdftoppm -jpeg -r ${DPI} -f ${pageNum} -l ${pageNum} "${pdfPath}" "${outBase}"`,
      { stdio: "pipe", timeout: 30_000 }
    );

    // pdftoppm appends -1 or -01 etc — find it
    const files = readdirSync(tmpDir).filter((f) => f.startsWith(`page-${padded}`));
    if (files.length === 0) {
      console.error(`  [!] No file produced for page ${pageNum}`);
      continue;
    }
    const localFile = path.join(tmpDir, files[0]);

    const imageBuffer = readFileSync(localFile);
    await uploadBuffer(BUCKET_NAME, destination, imageBuffer, "image/jpeg");
    uploaded++;
    process.stdout.write(`  ✓ page-${padded} (${uploaded} uploaded, ${skipped} skipped)\r`);
    unlinkSync(localFile);
  }

  // Clean up tmp dir
  try { execSync(`rm -rf "${tmpDir}"`); } catch (_) {}

  console.log(
    `\n[MadrigalScans:${source.label}] Done — ${uploaded} uploaded, ${skipped} already present`
  );
}

async function main() {
  console.log("[MadrigalScans] Using bucket:", BUCKET_NAME);
  for (const source of SOURCES) {
    await uploadSource(source);
  }
  console.log("\n[MadrigalScans] All done.");
}

main().catch((err) => {
  console.error("[MadrigalScans] Fatal error:", err);
  process.exit(1);
});
