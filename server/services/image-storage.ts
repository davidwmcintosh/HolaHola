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
 * Old images were stored with a raw GCS URL that returns 403 (or 404 after R2
 * migration) in the browser.  This function converts those to the proxy path;
 * already-normalised paths and external URLs (e.g. expiring DALL-E URLs) are
 * returned unchanged.
 *
 * Handled GCS shapes:
 *   1. https://storage.googleapis.com/<bucket>/public/ai-images/<file>
 *   2. https://storage.googleapis.com/<bucket>/public/ai-images/<file>?<signed>
 *   3. https://<bucket>.storage.googleapis.com/public/ai-images/<file>
 *   4. https://<bucket>.storage.googleapis.com/public/ai-images/<file>?<signed>
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url;

  // Already an app-relative proxy URL — leave as-is
  if (url.startsWith('/api/media/ai-image/')) return url;

  // Path-style GCS URL (patterns 1 & 2):
  //   https://storage.googleapis.com/<bucket>/public/ai-images/<filename>[?query]
  const pathMatch = url.match(
    /https:\/\/storage\.googleapis\.com\/[^/]+\/public\/ai-images\/([^?#]+)/
  );
  if (pathMatch) return `/api/media/ai-image/${pathMatch[1]}`;

  // Subdomain-style GCS URL (patterns 3 & 4):
  //   https://<bucket>.storage.googleapis.com/public/ai-images/<filename>[?query]
  const subdomainMatch = url.match(
    /https:\/\/[^.]+\.storage\.googleapis\.com\/public\/ai-images\/([^?#]+)/
  );
  if (subdomainMatch) return `/api/media/ai-image/${subdomainMatch[1]}`;

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
