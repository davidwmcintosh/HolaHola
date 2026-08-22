/**
 * Pure helper functions shared between download-props.ts, upload-props.ts,
 * and their CI test.
 *
 * Extracting them here means a regression in column selection, suffix choice,
 * or name sanitisation is caught by the CI test without any test edits.
 */

/**
 * Which DB column receives the upload.
 *   replaceMain = false → zone_image_url  (compositor's transparent version — safe default)
 *   replaceMain = true  → image_url       (vocab display version — destructive, needs --replace-main)
 */
export function deriveTargetColumn(replaceMain: boolean): 'image_url' | 'zone_image_url' {
  return replaceMain ? 'image_url' : 'zone_image_url';
}

/**
 * Filename suffix that matches the target column so uploaded objects are
 * distinguishable in storage.
 */
export function deriveFileSuffix(replaceMain: boolean): 'main' | 'zone' {
  return replaceMain ? 'main' : 'zone';
}

/**
 * Full storage filename for an uploaded prop image.
 * Format: prop-<safeName>-<zone|main>-<timestamp>.png
 */
export function deriveFilename(safeName: string, replaceMain: boolean, ts: number): string {
  return `prop-${safeName}-${deriveFileSuffix(replaceMain)}-${ts}.png`;
}

/**
 * Sanitise a prop name to a filesystem/storage-safe lowercase slug.
 * Non-alphanumeric characters (except - and _) are replaced with underscores.
 * Used identically by download-props (output filename) and upload-props
 * (lookup filename) so the filenames always match.
 */
export function sanitisePropName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

/**
 * Convert an app-relative proxy URL back to a storage object key.
 * e.g. /api/media/ai-image/foo.png → public/ai-images/foo.png
 */
export function urlToStoragePath(imageUrl: string): string {
  const filename = imageUrl.replace('/api/media/ai-image/', '');
  return `public/ai-images/${filename}`;
}
