/**
 * upload-madrigal-scans.test.ts
 *
 * Verifies the per-page error-recovery loop inside upload-madrigal-scans.ts:
 *
 *   - A page whose uploadBuffer call throws increments `failed`.
 *   - All other pages upload normally and increment `uploaded`.
 *   - The loop does NOT throw (the process would exit 0).
 *   - A page whose storage.exists() returns true is skipped (increments `skipped`).
 *
 * The logic is inlined here (same approach as quiz-correct-index-bounds.test.ts)
 * so the test has zero server-side import dependencies (no DB, no S3, etc.).
 *
 * Run standalone:
 *   npx tsx --test server/scripts/upload-madrigal-scans.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inlined uploadSource loop
// ---------------------------------------------------------------------------
// Mirrors the for-loop in uploadSource() in upload-madrigal-scans.ts exactly.
// If the production loop changes, update this mirror and the test behaviour.

interface SourceConfig {
  label: string;
  storagePrefix: string;
  totalPages: number;
}

interface StorageFile {
  exists(): Promise<boolean>;
}

type MakeStorageFile = (bucket: string, destination: string) => StorageFile;
type UploadBuffer = (
  bucket: string,
  destination: string,
  buffer: Buffer,
  contentType: string,
) => Promise<void>;

interface UploadResult {
  uploaded: number;
  skipped: number;
  failed: number;
}

/**
 * Runs the upload loop for a source with injectable storage helpers.
 *
 * `getPageBuffer` returns a Buffer for a given page number (or throws to
 * simulate pdftoppm / read failure for that page).
 */
async function runUploadLoop(
  source: SourceConfig,
  getPageBuffer: (pageNum: number) => Buffer | Promise<Buffer>,
  makeStorageFile: MakeStorageFile,
  uploadBuffer: UploadBuffer,
): Promise<UploadResult> {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let pageNum = 1; pageNum <= source.totalPages; pageNum++) {
    const padded = String(pageNum).padStart(3, '0');
    const destination = `${source.storagePrefix}/page-${padded}.jpg`;

    try {
      const exists = await makeStorageFile('test-bucket', destination).exists();
      if (exists) {
        skipped++;
        continue;
      }

      const imageBuffer = await getPageBuffer(pageNum);
      await uploadBuffer('test-bucket', destination, imageBuffer, 'image/jpeg');
      uploaded++;
    } catch (_err) {
      failed++;
      // production code continues; so do we
    }
  }

  return { uploaded, skipped, failed };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** makeStorageFile that always reports "not yet uploaded". */
function alwaysNew(): MakeStorageFile {
  return (_bucket, _dest) => ({ exists: async () => false });
}

/** makeStorageFile that reports "already uploaded" for a set of destinations. */
function alreadyUploaded(destinations: Set<string>): MakeStorageFile {
  return (_bucket, dest) => ({ exists: async () => destinations.has(dest) });
}

/** uploadBuffer that succeeds for all pages. */
function successUpload(): UploadBuffer {
  return async () => {};
}

/**
 * uploadBuffer that throws for the given page numbers, succeeds for the rest.
 * `failOnPages` is 1-based.
 */
function failOnPages(failPages: number[], storagePrefix: string): UploadBuffer {
  return async (_bucket, destination) => {
    const pageNum = Number(
      destination.replace(`${storagePrefix}/page-`, '').replace('.jpg', ''),
    );
    if (failPages.includes(pageNum)) {
      throw new Error(`Simulated upload failure for page ${pageNum}`);
    }
  };
}

/** getPageBuffer that always returns a dummy Buffer. */
function dummyBuffer(): (pageNum: number) => Buffer {
  return (_pageNum) => Buffer.from('fake-jpeg-data');
}

/** getPageBuffer that throws for the given page numbers. */
function failGetBuffer(failPages: number[]): (pageNum: number) => Buffer {
  return (pageNum) => {
    if (failPages.includes(pageNum)) {
      throw new Error(`Simulated pdftoppm failure for page ${pageNum}`);
    }
    return Buffer.from('fake-jpeg-data');
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const TEST_SOURCE: SourceConfig = {
  label: 'main',
  storagePrefix: 'public/madrigal/scans/main',
  totalPages: 5, // small N so the test runs fast
};

describe('uploadSource loop — single page upload failure', () => {
  it('failed counter is 1 when uploadBuffer throws on page 2', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alwaysNew(),
      failOnPages([2], TEST_SOURCE.storagePrefix),
    );

    assert.equal(result.failed, 1, 'exactly one page should fail');
  });

  it('uploaded counter is totalPages-1 when one page fails', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alwaysNew(),
      failOnPages([2], TEST_SOURCE.storagePrefix),
    );

    assert.equal(result.uploaded, TEST_SOURCE.totalPages - 1,
      'all pages except the failing one should upload');
  });

  it('skipped counter is 0 when no pages are pre-uploaded', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alwaysNew(),
      failOnPages([2], TEST_SOURCE.storagePrefix),
    );

    assert.equal(result.skipped, 0, 'no pages should be skipped');
  });

  it('loop does not throw — process would exit 0', async () => {
    await assert.doesNotReject(
      () =>
        runUploadLoop(
          TEST_SOURCE,
          dummyBuffer(),
          alwaysNew(),
          failOnPages([2], TEST_SOURCE.storagePrefix),
        ),
      'the upload loop must not throw even when a page fails',
    );
  });
});

describe('uploadSource loop — multiple page failures', () => {
  it('failed=2, uploaded=3 when pages 1 and 4 fail out of 5', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alwaysNew(),
      failOnPages([1, 4], TEST_SOURCE.storagePrefix),
    );

    assert.equal(result.failed, 2, 'two pages should fail');
    assert.equal(result.uploaded, 3, 'three pages should upload');
    assert.equal(result.skipped, 0);
  });

  it('all pages fail gracefully when uploadBuffer always throws', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alwaysNew(),
      failOnPages([1, 2, 3, 4, 5], TEST_SOURCE.storagePrefix),
    );

    assert.equal(result.failed, TEST_SOURCE.totalPages);
    assert.equal(result.uploaded, 0);
    assert.equal(result.skipped, 0);
  });
});

describe('uploadSource loop — pdftoppm / buffer failure path', () => {
  it('failed=1, uploaded=4 when getPageBuffer throws on page 3', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      failGetBuffer([3]),
      alwaysNew(),
      successUpload(),
    );

    assert.equal(result.failed, 1, 'page 3 buffer failure should increment failed');
    assert.equal(result.uploaded, 4);
    assert.equal(result.skipped, 0);
  });
});

describe('uploadSource loop — skip-if-exists behaviour', () => {
  it('already-uploaded pages are skipped, not re-uploaded or failed', async () => {
    const uploaded: Set<string> = new Set([
      'public/madrigal/scans/main/page-001.jpg',
      'public/madrigal/scans/main/page-003.jpg',
    ]);

    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alreadyUploaded(uploaded),
      successUpload(),
    );

    assert.equal(result.skipped, 2, 'two already-present pages should be skipped');
    assert.equal(result.uploaded, TEST_SOURCE.totalPages - 2,
      'remaining pages should upload');
    assert.equal(result.failed, 0);
  });

  it('a page that is already uploaded AND would fail upload is still only skipped', async () => {
    // Page 2 is "already uploaded" — the uploadBuffer is never called for it,
    // so even though we tell it to fail for page 2, skipped=1 not failed=1.
    const uploaded: Set<string> = new Set([
      'public/madrigal/scans/main/page-002.jpg',
    ]);

    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alreadyUploaded(uploaded),
      failOnPages([2], TEST_SOURCE.storagePrefix),
    );

    assert.equal(result.skipped, 1, 'page 2 should be skipped (exists check fires first)');
    assert.equal(result.uploaded, TEST_SOURCE.totalPages - 1);
    assert.equal(result.failed, 0);
  });
});

describe('uploadSource loop — happy path (no failures)', () => {
  it('all pages upload when nothing fails', async () => {
    const result = await runUploadLoop(
      TEST_SOURCE,
      dummyBuffer(),
      alwaysNew(),
      successUpload(),
    );

    assert.equal(result.uploaded, TEST_SOURCE.totalPages);
    assert.equal(result.skipped, 0);
    assert.equal(result.failed, 0);
  });
});

// ---------------------------------------------------------------------------
// Missing-PDF early-return path
// ---------------------------------------------------------------------------
// Mirrors the pdfPath existsSync guard in uploadSource():
//
//   if (!existsSync(pdfPath)) {
//     console.warn(`… skipping`);
//     return;               // <-- early return; tmpDir is created AFTER this
//   }
//   const tmpDir = …;
//   mkdirSync(tmpDir, …);
//   … loop …
//   rm -rf tmpDir
//
// We inline the same guard so the test has zero production-import dependencies.
// ---------------------------------------------------------------------------

interface SourceConfigWithPdf extends SourceConfig {
  pdfExists: boolean;
}

async function runUploadSourceWithPdfGuard(
  source: SourceConfigWithPdf,
  getPageBuffer: (pageNum: number) => Buffer | Promise<Buffer>,
  makeStorageFileFn: MakeStorageFile,
  uploadBufferFn: UploadBuffer,
  tmpDirCreated: { value: boolean },
): Promise<UploadResult | null> {
  // Mirror the production guard
  if (!source.pdfExists) {
    // tmpDir is intentionally NOT created — this mirrors the production path
    return null; // signals "early return"
  }

  // Only reached when pdfExists is true
  tmpDirCreated.value = true;

  const result = await runUploadLoop(source, getPageBuffer, makeStorageFileFn, uploadBufferFn);

  // Cleanup (mirrors production `rm -rf tmpDir`)
  tmpDirCreated.value = false;

  return result;
}

describe('uploadSource — missing PDF early-return path', () => {
  it('returns null (early exit) when the PDF does not exist', async () => {
    const created = { value: false };
    const result = await runUploadSourceWithPdfGuard(
      { ...TEST_SOURCE, pdfExists: false },
      dummyBuffer(),
      alwaysNew(),
      successUpload(),
      created,
    );

    assert.equal(result, null, 'uploadSource must return early when PDF is missing');
  });

  it('uploaded=0, failed=0, skipped=0 when PDF is missing (no pages processed)', async () => {
    // Because the function returns null we record 0/0/0 as the "effective" result.
    const created = { value: false };
    const result = await runUploadSourceWithPdfGuard(
      { ...TEST_SOURCE, pdfExists: false },
      dummyBuffer(),
      alwaysNew(),
      successUpload(),
      created,
    );

    const effective = result ?? { uploaded: 0, skipped: 0, failed: 0 };
    assert.equal(effective.uploaded, 0, 'no pages should be uploaded');
    assert.equal(effective.skipped, 0, 'no pages should be skipped');
    assert.equal(effective.failed, 0, 'no pages should be failed');
  });

  it('tmp directory is never created when the PDF is missing', async () => {
    const created = { value: false };
    await runUploadSourceWithPdfGuard(
      { ...TEST_SOURCE, pdfExists: false },
      dummyBuffer(),
      alwaysNew(),
      successUpload(),
      created,
    );

    assert.equal(
      created.value,
      false,
      'tmpDir must not be created on the early-return path',
    );
  });

  it('does process pages normally when PDF exists', async () => {
    const created = { value: false };
    const result = await runUploadSourceWithPdfGuard(
      { ...TEST_SOURCE, pdfExists: true },
      dummyBuffer(),
      alwaysNew(),
      successUpload(),
      created,
    );

    assert.ok(result !== null, 'should return a result when PDF exists');
    assert.equal(result!.uploaded, TEST_SOURCE.totalPages);
    assert.equal(result!.failed, 0);
    assert.equal(result!.skipped, 0);
  });
});

// ---------------------------------------------------------------------------
// Missing-bucket guard
// ---------------------------------------------------------------------------
// Mirrors the top-level guard in upload-madrigal-scans.ts (lines 22-32).
// Tests verify the guard fires before any upload attempt and that it does NOT
// require a real bucket or call process.exit().

interface BucketGuardResult {
  /** true when no bucket name could be resolved — process.exit(1) would fire */
  shouldExit: boolean;
  bucketName: string;
}

/**
 * Inlined version of the bucket-name resolution + guard in upload-madrigal-scans.ts.
 *
 * Production code:
 *   const BUCKET_NAME =
 *     process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ||
 *     process.env.AWS_S3_DESTINATION_BUCKET ||
 *     "";
 *   if (!BUCKET_NAME) { console.error(...); process.exit(1); }
 *
 * Here we accept an explicit env map so the test controls the env without
 * touching process.env or calling process.exit.
 */
function checkBucketGuard(env: Record<string, string | undefined>): BucketGuardResult {
  const bucketName =
    env['DEFAULT_OBJECT_STORAGE_BUCKET_ID'] ||
    env['AWS_S3_DESTINATION_BUCKET'] ||
    '';
  return { shouldExit: !bucketName, bucketName };
}

/**
 * Simulates the top-level startup: guard fires first, upload loop runs only
 * when a bucket name is available.  Returns the number of upload calls made
 * so the test can assert that zero uploads happened when the guard fires.
 */
async function runWithGuard(
  env: Record<string, string | undefined>,
  source: SourceConfig,
): Promise<{ guardFired: boolean; uploadAttempts: number }> {
  const { shouldExit, bucketName } = checkBucketGuard(env);
  if (shouldExit) {
    return { guardFired: true, uploadAttempts: 0 };
  }

  let uploadAttempts = 0;
  await runUploadLoop(
    source,
    dummyBuffer(),
    alwaysNew(),
    async (_bucket, _dest, _buf, _ct) => { uploadAttempts++; },
  );
  return { guardFired: false, uploadAttempts };
}

describe('missing-bucket guard', () => {
  it('guard fires when both env vars are absent', () => {
    const { shouldExit } = checkBucketGuard({});
    assert.equal(shouldExit, true, 'guard must fire when no bucket env var is set');
  });

  it('guard fires when both env vars are empty strings', () => {
    const { shouldExit } = checkBucketGuard({
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: '',
      AWS_S3_DESTINATION_BUCKET: '',
    });
    assert.equal(shouldExit, true, 'empty strings must trigger the guard');
  });

  it('guard does NOT fire when DEFAULT_OBJECT_STORAGE_BUCKET_ID is set', () => {
    const { shouldExit, bucketName } = checkBucketGuard({
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: 'my-bucket',
    });
    assert.equal(shouldExit, false);
    assert.equal(bucketName, 'my-bucket');
  });

  it('guard does NOT fire when AWS_S3_DESTINATION_BUCKET is set', () => {
    const { shouldExit, bucketName } = checkBucketGuard({
      AWS_S3_DESTINATION_BUCKET: 'fallback-bucket',
    });
    assert.equal(shouldExit, false);
    assert.equal(bucketName, 'fallback-bucket');
  });

  it('DEFAULT_OBJECT_STORAGE_BUCKET_ID takes priority over AWS_S3_DESTINATION_BUCKET', () => {
    const { bucketName } = checkBucketGuard({
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: 'primary',
      AWS_S3_DESTINATION_BUCKET: 'secondary',
    });
    assert.equal(bucketName, 'primary');
  });

  it('guard fires BEFORE any upload attempt — zero uploads when bucket is missing', async () => {
    const { guardFired, uploadAttempts } = await runWithGuard({}, TEST_SOURCE);
    assert.equal(guardFired, true, 'guard must fire');
    assert.equal(uploadAttempts, 0, 'no upload must be attempted when the guard fires');
  });

  it('uploads proceed normally when a bucket name is present', async () => {
    const { guardFired, uploadAttempts } = await runWithGuard(
      { DEFAULT_OBJECT_STORAGE_BUCKET_ID: 'good-bucket' },
      TEST_SOURCE,
    );
    assert.equal(guardFired, false, 'guard must not fire when bucket is configured');
    assert.equal(uploadAttempts, TEST_SOURCE.totalPages, 'all pages should be attempted');
  });
});
