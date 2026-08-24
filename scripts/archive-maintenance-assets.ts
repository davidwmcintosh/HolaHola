/**
 * Archives maintenance-only source materials outside the deployment checkout.
 *
 * Usage:
 *   npx tsx scripts/archive-maintenance-assets.ts inventory
 *   npx tsx scripts/archive-maintenance-assets.ts upload
 *   npx tsx scripts/archive-maintenance-assets.ts verify
 *   npx tsx scripts/archive-maintenance-assets.ts fetch <source-path> <destination>
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAINTENANCE_ARCHIVE_ID,
  MAINTENANCE_ARCHIVE_PREFIX,
  archiveObjectKey,
  contentTypeForArchivePath,
  downloadAndVerifyArchiveFile,
  type MaintenanceArchiveAsset,
  type MaintenanceArchiveManifest,
  readVerifiedArchiveMetadata,
  sha256File,
  uploadImmutableArchiveFile,
} from "../server/replit_integrations/object_storage/maintenanceArchive";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFEST_PATH = join(projectRoot, "docs", "maintenance-archive-manifest.json");

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

export async function collectMaintenanceArchivePaths(root = projectRoot): Promise<string[]> {
  const attachedAssets = join(root, "attached_assets");
  const assetFiles = await walkFiles(attachedAssets);
  const archiveCandidates = assetFiles
    .map((path) => relative(root, path).replaceAll("\\", "/"))
    .filter((path) => /\.(pdf|zip)$/i.test(path));
  const exportBundle = "exports/holahola-complete-main.bundle.lock";
  try {
    await stat(join(root, exportBundle));
    archiveCandidates.push(exportBundle);
  } catch {
    // The bundle is optional in fresh or already-clean checkouts.
  }
  return archiveCandidates.sort();
}

export async function buildMaintenanceArchiveManifest(
  root = projectRoot,
): Promise<MaintenanceArchiveManifest> {
  const sourcePaths = await collectMaintenanceArchivePaths(root);
  const assets: MaintenanceArchiveAsset[] = [];
  for (const sourcePath of sourcePaths) {
    const absolute = join(root, sourcePath);
    const file = await stat(absolute);
    assets.push({
      sourcePath,
      objectKey: archiveObjectKey(sourcePath),
      bytes: file.size,
      sha256: await sha256File(absolute),
      contentType: contentTypeForArchivePath(sourcePath),
    });
  }
  return {
    format: "holahola-maintenance-archive",
    version: 1,
    archiveId: MAINTENANCE_ARCHIVE_ID,
    objectPrefix: MAINTENANCE_ARCHIVE_PREFIX,
    assets,
  };
}

export async function readMaintenanceArchiveManifest(): Promise<MaintenanceArchiveManifest> {
  const parsed = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as MaintenanceArchiveManifest;
  if (
    parsed.format !== "holahola-maintenance-archive" ||
    parsed.version !== 1 ||
    parsed.archiveId !== MAINTENANCE_ARCHIVE_ID ||
    !Array.isArray(parsed.assets)
  ) {
    throw new Error(`[MaintenanceArchive] Invalid manifest: ${MANIFEST_PATH}`);
  }
  return parsed;
}

async function writeManifest(manifest: MaintenanceArchiveManifest) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function uploadManifest(manifest: MaintenanceArchiveManifest) {
  const manifestBytes = Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestAsset: MaintenanceArchiveAsset = {
    sourcePath: "docs/maintenance-archive-manifest.json",
    objectKey: archiveObjectKey("manifest.json"),
    bytes: manifestBytes,
    sha256: await sha256File(MANIFEST_PATH),
    contentType: "application/json",
  };
  await uploadImmutableArchiveFile(MANIFEST_PATH, manifestAsset);
}

async function upload() {
  const manifest = await buildMaintenanceArchiveManifest();
  await writeManifest(manifest);
  for (const asset of manifest.assets) {
    await uploadImmutableArchiveFile(join(projectRoot, asset.sourcePath), asset);
    await readVerifiedArchiveMetadata(asset);
    console.log(`[MaintenanceArchive] Uploaded or verified ${asset.sourcePath}`);
  }
  await uploadManifest(manifest);
  console.log(`[MaintenanceArchive] Uploaded ${manifest.assets.length} verified assets.`);
}

async function verify() {
  const manifest = await readMaintenanceArchiveManifest();
  const verificationRoot = join("/tmp", `maintenance-archive-verify-${process.pid}`);
  for (const asset of manifest.assets) {
    const destination = join(verificationRoot, asset.sourcePath);
    await downloadAndVerifyArchiveFile(asset, destination);
    console.log(`[MaintenanceArchive] Download verified ${asset.sourcePath}`);
  }
  console.log(`[MaintenanceArchive] Verified ${manifest.assets.length} archived assets.`);
}

export async function fetchArchivedMaintenanceAsset(sourcePath: string, destination: string): Promise<void> {
  const manifest = await readMaintenanceArchiveManifest();
  const asset = manifest.assets.find((candidate) => candidate.sourcePath === sourcePath);
  if (!asset) {
    throw new Error(`[MaintenanceArchive] Source path is not present in archive manifest: ${sourcePath}`);
  }
  await downloadAndVerifyArchiveFile(asset, destination);
}

async function main() {
  const [command, sourcePath, destination] = process.argv.slice(2);
  switch (command) {
    case "inventory": {
      const manifest = await buildMaintenanceArchiveManifest();
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }
    case "upload":
      await upload();
      return;
    case "verify":
      await verify();
      return;
    case "fetch":
      if (!sourcePath || !destination) {
        throw new Error("Usage: fetch <source-path> <destination>");
      }
      await fetchArchivedMaintenanceAsset(sourcePath, destination);
      return;
    default:
      throw new Error("Usage: inventory | upload | verify | fetch <source-path> <destination>");
  }
}

if (basename(process.argv[1] ?? "") === "archive-maintenance-assets.ts") {
  main().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}