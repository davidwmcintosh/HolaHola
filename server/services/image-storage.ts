/**
 * Permanent Image Storage Service
 *
 * Downloads AI-generated image bytes (e.g. expiring DALL-E URLs) and uploads
 * them to object storage (S3/R2 or GCS), returning an app-relative URL that
 * is served through the Express proxy route /api/media/ai-image/:filename.
 *
 * Direct storage URLs return 403 (bucket not public).
 * All image access goes through the app proxy so backend credentials are used
 * to authorise the download.
 */

import {
  uploadBuffer,
  downloadBuffer,
  makeStorageFile,
} from '../replit_integrations/object_storage/objectStorage';

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';

function getBucketName(): string {
  if (!BUCKET_ID) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
  return BUCKET_ID;
}

/**
 * Upload a buffer to the public/ai-images directory of the object storage bucket.
 * Returns an app-relative URL served through /api/media/ai-image/:filename.
 */
export async function uploadPublicBuffer(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await uploadBuffer(
    getBucketName(),
    `public/ai-images/${filename}`,
    buffer,
    contentType,
    { cacheControl: 'public, max-age=31536000' },
  );
  return `/api/media/ai-image/${filename}`;
}

/**
 * Download an image from a URL and upload it to permanent object storage.
 *
 * @param sourceUrl  - The temporary URL to download from (e.g. DALL-E URL)
 * @param filename   - Destination filename (e.g. "abc123.jpg")
 * @returns          - App-relative permanent URL, or the original URL on failure
 */
export async function archiveImageToPermanentStorage(
  sourceUrl: string,
  filename: string
): Promise<string> {
  if (!BUCKET_ID) {
    console.warn('[ImageStorage] Object storage not configured — returning source URL');
    return sourceUrl;
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';

    const appUrl = await uploadPublicBuffer(filename, buffer, contentType);
    console.log(`[ImageStorage] Archived ${filename} → ${appUrl}`);
    return appUrl;
  } catch (err: any) {
    console.error(`[ImageStorage] Failed to archive ${filename}: ${err.message} — falling back to source URL`);
    return sourceUrl;
  }
}

/**
 * Normalise any stored image URL so it is always an app-relative proxy URL.
 *
 * Old images were stored with a raw GCS URL that returns 403 in the browser.
 * This function converts those to the proxy path; already-normalised paths
 * and external URLs (e.g. expiring DALL-E URLs) are returned unchanged.
 */
export function normalizeImageUrl(url: string): string {
  // Already an app-relative proxy URL — leave as-is
  if (url.startsWith('/api/media/ai-image/')) return url;

  // Old format: https://storage.googleapis.com/<bucket>/public/ai-images/<filename>
  const gcsMatch = url.match(/https:\/\/storage\.googleapis\.com\/[^/]+\/public\/ai-images\/([^?#]+)/);
  if (gcsMatch) {
    return `/api/media/ai-image/${gcsMatch[1]}`;
  }

  return url;
}

/**
 * Download a stored AI image from object storage as a Buffer.
 * Returns null if the file is not found or storage is not configured.
 */
export async function downloadAiImageAsBuffer(
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!BUCKET_ID) return null;
  return downloadBuffer(getBucketName(), `public/ai-images/${filename}`);
}

/**
 * Stream a stored AI image from object storage to the Express response.
 * Used by GET /api/media/ai-image/:filename.
 */
export async function serveStoredAiImage(
  filename: string,
  res: import('express').Response
): Promise<void> {
  if (!BUCKET_ID) {
    res.status(404).json({ error: 'Object storage not configured' });
    return;
  }

  const file = makeStorageFile(getBucketName(), `public/ai-images/${filename}`);

  if (!(await file.exists())) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const metadata = await file.getMetadata();
  res.set({
    'Content-Type': metadata.contentType || 'image/jpeg',
    'Cache-Control': 'public, max-age=3600',
  });

  file.createReadStream()
    .on('error', (err: Error) => {
      console.error(`[ImageStorage] Stream error for ${filename}:`, err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
    })
    .pipe(res);
}
