import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export const HELPER = 'scripts/runtime-onboarding-native-store.ps1';
export const PAYLOADS = Object.freeze([
  'bin/holahola-onboarding.mjs',
  'lib/runtime-onboarding-sdk.mjs',
  HELPER,
  'package.json',
  'README.txt',
]);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const fail = (code) => { throw new Error(`onboarding_${code}`); };
export function assertHash(hash) {
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) fail('invalid_sha256');
}
export function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) fail('invalid_fields');
}

// Check ancestors too: lstat of a child alone misses a linked staging root.
export async function assertRegularPath(path, directory = false, allowMissing = false) {
  let current = resolve(path);
  let leaf = true;
  for (;;) {
    let stat;
    try { stat = await lstat(current); } catch (error) {
      if (!allowMissing || error.code !== 'ENOENT') throw error;
    }
    if (stat) {
      if (stat.isSymbolicLink()
        || (leaf && !directory ? !stat.isFile() || stat.nlink !== 1 : !stat.isDirectory())) {
        fail('unsafe_path');
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    leaf = false;
  }
}

export async function readRegular(path) {
  await assertRegularPath(path);
  const stat = await lstat(path);
  if (stat.size > 32 * 1024 * 1024) fail('file_too_large');
  return readFile(path);
}

export function filePins(files) {
  if (!Array.isArray(files) || files.length !== PAYLOADS.length) fail('unexpected_file_set');
  const pins = new Map();
  for (const file of files) {
    exactKeys(file, ['path', 'bytes', 'sha256']);
    if (!PAYLOADS.includes(file.path) || pins.has(file.path)) fail('unexpected_file_set');
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1) fail('invalid_file_size');
    assertHash(file.sha256);
    pins.set(file.path, file);
  }
  return pins;
}

export function unsignedManifest(bytes) {
  const manifest = JSON.parse(bytes.toString('utf8'));
  exactKeys(manifest, ['format', 'sourceRevision', 'sourceDirty', 'release',
    'nodeMinimum', 'entrypoint', 'files']);
  if (manifest.format !== 'holahola-runtime-onboarding-package/v1'
    || !/^[a-f0-9]{40}$/.test(manifest.sourceRevision)
    || typeof manifest.sourceDirty !== 'boolean' || typeof manifest.release !== 'boolean'
    || (manifest.release && manifest.sourceDirty)
    || manifest.nodeMinimum !== 20 || manifest.entrypoint !== PAYLOADS[0]) fail('invalid_manifest');
  filePins(manifest.files);
  return manifest;
}

export async function snapshotPackage(directory) {
  await assertRegularPath(directory, true);
  const allowedFiles = [...PAYLOADS, 'manifest.json'];
  const allowedDirectories = ['bin', 'lib', 'scripts'];
  const found = [];
  async function walk(relative) {
    for (const name of await readdir(join(directory, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      const stat = await lstat(join(directory, path));
      if (stat.isDirectory()) {
        if (!allowedDirectories.includes(path)) fail('unexpected_file_set');
        await assertRegularPath(join(directory, path), true);
        await walk(path);
      } else {
        if (!allowedFiles.includes(path)) fail('unexpected_file_set');
        await assertRegularPath(join(directory, path));
        found.push(path);
      }
    }
  }
  await walk('');
  if (found.sort().join('\0') !== allowedFiles.sort().join('\0')) fail('unexpected_file_set');
  const bytes = new Map();
  for (const path of [...PAYLOADS, 'manifest.json']) {
    bytes.set(path, await readRegular(join(directory, path)));
  }
  return bytes;
}

export function pinsFromSnapshot(snapshot) {
  return PAYLOADS.map((path) => ({
    path, bytes: snapshot.get(path).length, sha256: sha256(snapshot.get(path)),
  }));
}