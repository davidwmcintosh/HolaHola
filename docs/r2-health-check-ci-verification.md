# R2 Read-Path Health Check — CI Verification Record

## Summary

The `checkR2ReadPaths` section of `server/scripts/verify-system-health.ts` was
exercised against real R2 credentials. All four checks passed.

## Command sequence

```bash
# 1. Start the application server (required for app-route checks)
npm run dev &

# 2. Wait for the server to come up, then run the verifier
npx tsx server/scripts/verify-system-health.ts
```

The verifier runs independently of the server for the direct-S3 checks.
The app-route checks (`/api/media/ai-image/:filename` and
`/api/media/vm-audio/:filename`) require the server to be listening on
`localhost:5000`.  When the server is not reachable those two checks emit a
`⚠ server-not-reachable` warning instead of failing, so the overall CI run
remains green even in headless scripts that do not start the server.

## Pass conditions

| Check | Required result |
|-------|----------------|
| R2 direct read ai-image | ✓ — GetObject returns > 0 bytes |
| R2 direct read vm-audio | ✓ — GetObject returns > 0 bytes |
| R2 app route ai-image   | ✓ HTTP 200 + bytes  **or** ⚠ server-not-reachable |
| R2 app route vm-audio   | ✓ HTTP 200 + bytes  **or** ⚠ server-not-reachable |

Any `✗` result (ListObjectsV2 error, GetObject error, HTTP non-200, or
0-byte 200 response) is a hard failure that blocks the CI summary.

## Observed results (verified July 30 2026)

### Without server running
```
── R2 Student-Facing Read Paths ────────────────────────
  ✓ R2 direct read ai-image  1680766 bytes (image/png)
  ⚠ R2 app route ai-image    Server not reachable at http://localhost:5000 — app-route check skipped
  ✓ R2 direct read vm-audio  107274 bytes (audio/wav)
  ⚠ R2 app route vm-audio    Server not reachable at http://localhost:5000 — app-route check skipped

── Summary ─────────────────────────────────────────────
  ⚠ 2 warning(s) — review before marking done.
```

### With server running
```
── R2 Student-Facing Read Paths ────────────────────────
  ✓ R2 direct read ai-image  1680766 bytes (image/png)
  ✓ R2 app route ai-image    HTTP 200, 1680766 bytes
  ✓ R2 direct read vm-audio  107274 bytes (audio/wav)
  ✓ R2 app route vm-audio    HTTP 200, 107274 bytes

── Summary ─────────────────────────────────────────────
  ✓ All checks passed — safe to mark done.
```

Byte counts match between direct S3 and app-route reads, confirming the proxy
routes stream the full object without truncation.

## Relevant files

- `server/scripts/verify-system-health.ts` — `checkR2ReadPaths()` function (~line 367)
- `server/scripts/verify-r2-read-paths.ts` — standalone reference script

## Environment variables required

| Variable | Purpose |
|----------|---------|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | R2 bucket name |
| `AWS_S3_ACCESS_KEY_ID` | R2 access key |
| `AWS_S3_SECRET_ACCESS_KEY` | R2 secret key |
| `AWS_S3_ENDPOINT` | R2 S3-compatible endpoint URL |

If any of the three credential vars are absent the checks are skipped with an
`ℹ R2 not configured` info line (not a failure).
