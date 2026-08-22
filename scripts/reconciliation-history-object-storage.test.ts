import assert from "node:assert/strict";
import test from "node:test";

import {
  assertIndependentReplica,
  normalizeReplicaRegion,
  receiptContent,
} from "./reconciliation-history-object-storage.ts";

const primary = {
  bucket: "primary-history",
  prefix: "history-archives/reconciliation-2026-08-21",
  region: "primary-region",
  accessKeyId: "primary-access-key",
  secretAccessKey: "primary-secret-key",
  endpoint: "https://primary.example.test",
  accountLabel: "primary-archive",
};

const replica = {
  bucket: "independent-history",
  prefix: "history-archives/reconciliation-2026-08-21",
  region: "replica-region",
  accessKeyId: "replica-access-key",
  secretAccessKey: "replica-secret-key",
  endpoint: "https://replica.example.test",
  accountLabel: "independent-replica",
};

test("independent replica guard accepts separate account configuration", () => {
  assert.doesNotThrow(() => assertIndependentReplica(primary, replica));
});

test("independent replica guard rejects primary credential reuse", () => {
  assert.throws(
    () => assertIndependentReplica(primary, { ...replica, accessKeyId: primary.accessKeyId }),
    /must not reuse the primary archive access key/,
  );
});

test("independent replica guard rejects an unchanged destination", () => {
  assert.throws(
    () => assertIndependentReplica(primary, {
      ...replica,
      bucket: primary.bucket,
      endpoint: primary.endpoint,
    }),
    /must use a different bucket or endpoint/,
  );
});

test("independent replica guard rejects a manifest-breaking prefix", () => {
  assert.throws(
    () => assertIndependentReplica(primary, {
      ...replica,
      prefix: "other-history-archive",
    }),
    /replica prefix must match/,
  );
});

test("Cloudflare R2 location labels normalize to the S3 API region", () => {
  assert.equal(
    normalizeReplicaRegion(
      " Eastern North America (ENAM) ",
      "https://account.r2.cloudflarestorage.com",
    ),
    "auto",
  );
});

test("non-R2 region values are only whitespace-trimmed", () => {
  assert.equal(
    normalizeReplicaRegion(" us-east-1 ", "https://s3.example.test"),
    "us-east-1",
  );
});

test("replication receipt records checksums without recording credentials", () => {
  const receipt = receiptContent(primary, replica, {
    bundleSha256: "bundle-sha",
    bundleBytes: 123,
    manifestSha256: "manifest-sha",
    manifestBytes: 456,
  });

  assert.match(receipt, /^bundle_sha256=bundle-sha$/m);
  assert.match(receipt, /^manifest_sha256=manifest-sha$/m);
  assert.match(receipt, /^credentials=not-recorded$/m);
  assert.match(receipt, /^recovery_rule=never-force-push-or-overwrite-github-main$/m);
  assert.doesNotMatch(receipt, /primary-secret-key|replica-secret-key|primary-access-key|replica-access-key/);
});