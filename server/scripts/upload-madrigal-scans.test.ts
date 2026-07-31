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
