/**
 * Extracts every page of "See It and Say It in Spanish" (and its Appendix) as
 * a JPEG, then uploads each image to Object Storage. Sources are read locally
 * when present or materialized from the verified private maintenance archive.
 */

import { execSync } from "child_process";
import { readFileSync, unlinkSync, mkdirSync, existsSync, readdirSync } from "fs";
import * as path from "path";
import * as os from "os";
import { makeStorageFile, uploadBuffer } from "../replit_integrations/object_storage/objectStorage";
import { fetchArchivedMaintenanceAsset } from "../../scripts/archive-maintenance-assets";

const BUCKET_NAME =
  process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ||
  process.env.AWS_S3_DESTINATION_BUCKET ||
  "";

if (!BUCKET_NAME) {
  console.error(
    "[MadrigalScans] No bucket configured. Set DEFAULT_OBJECT_STORAGE_BUCKET_ID or AWS_S3_DESTINATION_BUCKET.",
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
  const tmpDir = path.join(os.tmpdir(), `madrigal-${source.label}`);
  mkdirSync(tmpDir, { recursive: true });

  const localPdfPath = path.join(CROOT, "attached_assets", source.pdf);
  const archivedPdfPath = path.join(tmpDir, source.pdf);
  const pdfPath = existsSync(localPdfPath) ? localPdfPath : archivedPdfPath;
  let fetchedArchiveSource = false;

  if (!existsSync(localPdfPath)) {
    console.log(`[MadrigalScans:${source.label}] Fetching archived source PDF…`);
    await fetchArchivedMaintenanceAsset(`attached_assets/${source.pdf}`, archivedPdfPath);
    fetchedArchiveSource = true;
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  console.log(`\n[MadrigalScans:${source.label}] Processing ${source.totalPages} pages…`);

  try {
    for (let pageNum = 1; pageNum <= source.totalPages; pageNum++) {
      const padded = String(pageNum).padStart(3, "0");
      const destination = `${source.storagePrefix}/page-${padded}.jpg`;
      try {
        const exists = await makeStorageFile(BUCKET_NAME, destination).exists();
        if (exists) {
          skipped++;
          process.stdout.write(`  skip page-${padded}\r`);
          continue;
        }

        const outBase = path.join(tmpDir, `page-${padded}`);
        execSync(
          `pdftoppm -jpeg -r ${DPI} -f ${pageNum} -l ${pageNum} "${pdfPath}" "${outBase}"`,
          { stdio: "pipe", timeout: 30_000 },
        );

        const files = readdirSync(tmpDir).filter((file) => file.startsWith(`page-${padded}`));
        if (files.length === 0) {
          console.error(`\n  [!] No file produced for page ${pageNum} — skipping`);
          failed++;
          continue;
        }
        const localFile = path.join(tmpDir, files[0]);
        await uploadBuffer(BUCKET_NAME, destination, readFileSync(localFile), "image/jpeg");
        uploaded++;
        process.stdout.write(`  ✓ page-${padded} (${uploaded} uploaded, ${skipped} skipped)\r`);
        unlinkSync(localFile);
      } catch (error) {
        failed++;
        console.error(`\n  [!] page-${padded} failed — ${(error as Error).message ?? error}`);
      }
    }
  } finally {
    if (fetchedArchiveSource) {
      try { unlinkSync(archivedPdfPath); } catch (_) {}
    }
    try { execSync(`rm -rf "${tmpDir}"`); } catch (_) {}
  }

  console.log(
    `\n[MadrigalScans:${source.label}] Done — ${uploaded} uploaded, ${skipped} already present, ${failed} failed`,
  );
}

async function main() {
  console.log("[MadrigalScans] Using bucket:", BUCKET_NAME);
  for (const source of SOURCES) await uploadSource(source);
  console.log("\n[MadrigalScans] All done.");
}

main().catch((error) => {
  console.error("[MadrigalScans] Fatal error:", error);
  process.exit(1);
});