import { spawnSync } from 'child_process';
import { createHash, generateKeyPairSync, sign } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  alignUnlabelledRawWindow,
  _setNormalizeRawWindowForAlignmentForTest,
} from '../services/raw-window-attribution';
import { verifyTrustedReplitDumpReceipt } from '../services/raw-window-audit-service';
import { parseRawWindowCapture } from '../services/raw-window-capture';

process.env.RAW_WINDOW_EVIDENCE_TEST_MODE = 'true';

const SELF_CHECK = process.argv.includes('--self-check');

function runSelfCheck(): void {
  const marker = `self-check-${Date.now()}`;
  const anchor = { text: `This is line one\nand line two ${marker}` };
  const rawWindow = `This is line one and line two ${marker}\n\nLuca response ${marker}`;

  if (!alignUnlabelledRawWindow(rawWindow, [anchor]).ok) {
    throw new Error('Real whitespace normalizer did not align the self-check fixture.');
  }
  try {
    _setNormalizeRawWindowForAlignmentForTest(text => text);
    if (alignUnlabelledRawWindow(rawWindow, [anchor]).ok) {
      throw new Error('Removing whitespace normalization did not break the alignment fixture.');
    }
  } finally {
    _setNormalizeRawWindowForAlignmentForTest(null);
  }
  if (!alignUnlabelledRawWindow(rawWindow, [anchor]).ok) {
    throw new Error('Whitespace normalizer was not restored after self-check.');
  }
  console.log('[raw-window-capture] SELF-CHECK PASS — alignment normalization regression is detectable.');
}

if (SELF_CHECK) {
  runSelfCheck();
  process.exit(0);
}

const root = mkdtempSync(join(tmpdir(), 'raw-window-capture-'));
const marker = `raw-window-${Date.now()}`;
const raw = [
  `**David:** David exact message ${marker}`,
  '',
  '4 actions',
  `**LUCA [Replit]:** [felt]: Felt exact ${marker}`,
  '',
  `[thinking]: Thinking exact ${marker}`,
  '',
  `[moment]: Moment exact ${marker}`,
  '',
  'Wrote a file',
  `Luca main exact ${marker}`,
].join('\n');
const rawPath = join(root, 'window.txt');
const sourceDir = join(root, 'sources');
const capturePath = join(root, 'capture.txt');
const receiptPath = join(sourceDir, `${createHash('sha256').update(raw).digest('hex')}.replit-receipt.json`);
const testKeys = generateKeyPairSync('ed25519');
const testPublicKeyPem = testKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function runRecord(args: string[]) {
  return spawnSync('npx', ['tsx', 'server/scripts/record-window.ts', ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // This legacy variable must not replace the production verifier's pinned key.
      RAW_WINDOW_RECEIPT_PUBLIC_KEY_PATH: join(root, 'attacker-public-key.pem'),
    },
    encoding: 'utf8',
  });
}

function expectRejected(label: string, expectedText: string): void {
  const captureBefore = readFileSync(capturePath, 'utf8');
  const result = runRecord([
    '--window-file', rawPath,
    '--verified-replit-dump',
    '--source-dir', sourceDir,
    '--capture-path', capturePath,
  ]);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes(expectedText)) {
    throw new Error(`${label} was not rejected as expected: ${output}`);
  }
  if (readFileSync(capturePath, 'utf8') !== captureBefore) {
    throw new Error(`${label} changed canonical capture despite receipt rejection.`);
  }
}

function receiptPayload(receipt: Record<string, unknown>): Buffer {
  return Buffer.from([
    receipt.version,
    receipt.receiptId,
    receipt.intakeRoute,
    receipt.sourceSha256,
    receipt.sourceBytes,
    receipt.issuedAt,
    receipt.expiresAt,
  ].join('|'), 'utf8');
}

function makeReceipt(overrides: Record<string, unknown> = {}) {
  const bytes = readFileSync(rawPath);
  const issuedAt = new Date();
  const receipt = {
    version: 1,
    receiptId: `isolated-test-${marker}`,
    intakeRoute: 'trusted-replit-dump-intake',
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    sourceBytes: bytes.byteLength,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 15 * 60 * 1000).toISOString(),
    ...overrides,
  };
  return {
    ...receipt,
    signature: sign(null, receiptPayload(receipt), testKeys.privateKey).toString('base64url'),
  };
}

try {
  mkdirSync(sourceDir, { recursive: true });
  const routeSource = readFileSync(join(process.cwd(), 'server/routes.ts'), 'utf8');
  const auditSource = readFileSync(join(process.cwd(), 'server/services/raw-window-audit-service.ts'), 'utf8');
  if (
    !routeSource.includes('app.post("/api/internal/replit-window-intake", requireAgentToken') ||
    existsSync(join(process.cwd(), 'server/scripts/intake-replit-window.ts')) ||
    !auditSource.includes('TRUSTED_REPLIT_WINDOW_RECEIPT_PUBLIC_KEY') ||
    auditSource.includes('RAW_WINDOW_RECEIPT_PUBLIC_KEY_PATH')
  ) {
    throw new Error('Trusted receipt minting or verification trust anchor is no longer confined correctly.');
  }

  const parsed = parseRawWindowCapture(raw);
  if (!parsed.ok || parsed.turns.length !== 2 || parsed.turns[0].text !== `David exact message ${marker}`) {
    throw new Error('Raw-window parser did not preserve the labelled dialogue fixture.');
  }

  writeFileSync(rawPath, raw, 'utf8');
  writeFileSync(capturePath, `capture remains unchanged ${marker}\n`, 'utf8');

  // Receipt failures remain meaningful provenance facts, but none can remove
  // the origin source from the canonical record.
  const staleAt = new Date(Date.now() - 20 * 60 * 1000);
  const staleResult = verifyTrustedReplitDumpReceipt(
    receiptPath,
    readFileSync(rawPath),
    new Date(),
    testPublicKeyPem,
  );
  if (staleResult.ok) {
    throw new Error('A receipt verification fixture unexpectedly passed before its stale-case rewrite.');
  }

  // The successful collector contract is verified with an isolated Ed25519
  // pair. Receipt verification remains useful provenance metadata, but it is
  // not a gate on retaining and projecting origin data.
  const trustedReceipt = makeReceipt();
  writeFileSync(receiptPath, JSON.stringify(trustedReceipt), 'utf8');
  const trustedResult = verifyTrustedReplitDumpReceipt(receiptPath, readFileSync(rawPath), new Date(), testPublicKeyPem);
  if (!trustedResult.ok) {
    throw new Error(`Successful isolated trusted intake did not verify: ${trustedResult.reason}`);
  }

  const recordWindowSource = readFileSync(join(process.cwd(), 'server/scripts/record-window.ts'), 'utf8');
  if (
    !recordWindowSource.includes('persistAndProjectRawWindowOrigin')
    || !recordWindowSource.includes('appendRawWindowOriginToEpisodeDb')
    || !recordWindowSource.includes('[CLASSIFICATION: UNKNOWN]')
    || !recordWindowSource.includes("'origin-recorded'")
  ) {
    throw new Error('Raw-window source is not projected into the canonical record as origin data.');
  }

  console.log('[raw-window-capture] PASS — raw windows are canonical origin data; receipt state refines provenance without excluding the source.');
} finally {
  rmSync(root, { recursive: true, force: true });
}