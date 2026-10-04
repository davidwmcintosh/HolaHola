import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertUnchangedHelper, finalizeRuntimeOnboardingPackage, assertSignatureEvidence,
} from './finalize-runtime-onboarding-package.mjs';
import { HELPER, PAYLOADS, sha256, snapshotPackage } from './runtime-onboarding-package-integrity.mjs';

const block = '\n# SIG # Begin signature block\r\n# c3ludGhldGlj\r\n# SIG # End signature block\r\n';
const signer = {
  subject: 'CN=Hermetic fixture, not a real signer',
  certificateSha256: 'a'.repeat(64), timestampPolicy: 'absent-internal-pilot',
};
const encode = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'onboarding-finalization-'));
  try {
    const packageDirectory = join(root, 'package');
    const unsigned = Buffer.from('[CmdletBinding()]\nparam([string]$Operation)\nWrite-Output $Operation\n');
    const files = [];
    for (const path of PAYLOADS) {
      await mkdir(dirname(join(packageDirectory, path)), { recursive: true });
      const bytes = path === HELPER ? unsigned : Buffer.from(`fixture ${path}\n`);
      await writeFile(join(packageDirectory, path), bytes);
      files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const original = {
      format: 'holahola-runtime-onboarding-package/v1', sourceRevision: 'b'.repeat(40),
      sourceDirty: true, release: false, nodeMinimum: 20, entrypoint: PAYLOADS[0], files,
    };
    const originalBytes = encode(original);
    const unsignedManifestPath = join(root, 'unsigned-manifest.json');
    const unsignedHelperPath = join(root, 'unsigned.ps1');
    await writeFile(unsignedManifestPath, originalBytes);
    await writeFile(unsignedHelperPath, unsigned);
    await writeFile(join(packageDirectory, 'manifest.json'), originalBytes);
    const signed = Buffer.concat([unsigned, Buffer.from(block)]);
    await writeFile(join(packageDirectory, HELPER), signed);
    const approval = {
      format: 'holahola-runtime-onboarding-finalization-approval/v1',
      approvalId: 'synthetic approval; no operation authorized',
      unsignedManifestSha256: sha256(originalBytes),
      sourceRevision: original.sourceRevision, sourceDirty: true, release: false,
      files: files.map((file) => file.path === HELPER
        ? { path: HELPER, bytes: signed.length, sha256: sha256(signed) } : file),
      signer: { ...signer },
    };
    const approvalPath = join(root, 'approval.json');
    const options = {
      mode: 'finalize', packageDirectory, approvalPath, unsignedManifestPath, unsignedHelperPath,
    };
    async function saveApproval() {
      const bytes = encode(approval);
      await writeFile(approvalPath, bytes);
      options.approvalSha256 = sha256(bytes);
    }
    await saveApproval();
    const evidence = {
      format: 'holahola-runtime-onboarding-authenticode/v1', helperSha256: sha256(signed),
      winVerifyTrustStatus: 0, subject: signer.subject, certificateSha256: signer.certificateSha256,
      timestampPresent: false, certificateNotAfter: '2099-01-01T00:00:00.000Z',
    };
    const probe = async () => ({ ...evidence });
    await run({
      root, options, approval, saveApproval, original, originalBytes,
      unsigned, signed, evidence, probe,
    });
  } finally { await rm(root, { force: true, recursive: true }); }
}

async function mustRejectWithoutWriting(f, pattern, probe = f.probe) {
  const before = await readFile(join(f.options.packageDirectory, 'manifest.json'));
  await assert.rejects(finalizeRuntimeOnboardingPackage(f.options, probe), pattern);
  assert.deepEqual(await readFile(join(f.options.packageDirectory, 'manifest.json')), before);
}

test('finalize hashes externally signed bytes, preserves source flags, verify is read-only', async () => {
  await fixture(async (f) => {
    const before = await snapshotPackage(f.options.packageDirectory);
    const receipt = await finalizeRuntimeOnboardingPackage(f.options, f.probe);
    assert.notEqual(receipt.manifestSha256, sha256(f.originalBytes));
    const manifest = JSON.parse(await readFile(join(f.options.packageDirectory, 'manifest.json'), 'utf8'));
    for (const key of ['sourceRevision', 'sourceDirty', 'release', 'nodeMinimum', 'entrypoint']) {
      assert.equal(manifest[key], f.original[key]);
    }
    assert.equal(manifest.sourceDirty, true);
    assert.equal(manifest.release, false);
    assert.equal(manifest.finalization.unsignedManifestSha256, sha256(f.originalBytes));
    assert.equal(manifest.finalization.unsignedHelperSha256, sha256(f.unsigned));
    assert.equal(manifest.finalization.approvalSha256, f.options.approvalSha256);
    for (const file of manifest.files) {
      const bytes = await readFile(join(f.options.packageDirectory, file.path));
      assert.equal(file.bytes, bytes.length);
      assert.equal(file.sha256, sha256(bytes));
      assert.deepEqual(bytes, before.get(file.path));
    }
    const finalBytes = await readFile(join(f.options.packageDirectory, 'manifest.json'));
    f.options.mode = 'verify';
    f.options.manifestSha256 = receipt.manifestSha256;
    const verified = await finalizeRuntimeOnboardingPackage(f.options, f.probe);
    assert.equal(verified.manifestSha256, receipt.manifestSha256);
    assert.deepEqual(await readFile(join(f.options.packageDirectory, 'manifest.json')), finalBytes);
  });
});

test('verify refuses stale unsigned manifest even when its pin is supplied', async () => {
  await fixture(async (f) => {
    f.options.mode = 'verify';
    f.options.manifestSha256 = sha256(f.originalBytes);
    await mustRejectWithoutWriting(f, /stale_or_altered_final_manifest/);
  });
});

test('verify refuses stale helper hash in otherwise finalized manifest', async () => {
  await fixture(async (f) => {
    await finalizeRuntimeOnboardingPackage(f.options, f.probe);
    const path = join(f.options.packageDirectory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.files.find((file) => file.path === HELPER).sha256 = sha256(f.unsigned);
    const bytes = encode(manifest);
    await writeFile(path, bytes);
    f.options.mode = 'verify';
    f.options.manifestSha256 = sha256(bytes);
    await mustRejectWithoutWriting(f, /stale_or_altered_final_manifest/);
  });
});

test('altered executable logic is refused even with matching newly approved signed file pin', async () => {
  await fixture(async (f) => {
    const changed = Buffer.from(f.signed.toString().replace('Write-Output', 'Write-Warning'));
    await writeFile(join(f.options.packageDirectory, HELPER), changed);
    Object.assign(f.approval.files.find((file) => file.path === HELPER),
      { bytes: changed.length, sha256: sha256(changed) });
    f.evidence.helperSha256 = sha256(changed);
    await f.saveApproval();
    await mustRejectWithoutWriting(f, /helper_logic_changed/);
  });
});

test('byte-exact source comparison rejects BOM, line-ending and whitespace rewrites', () => {
  const source = Buffer.from('param()\nWrite-Output "x"\n');
  for (const changed of [
    '\uFEFF' + source.toString(), source.toString().replaceAll('\n', '\r\n'),
    source.toString().replace('param()', 'param() '),
  ]) {
    assert.throws(() => assertUnchangedHelper(source, Buffer.from(changed + block)), /helper_logic_changed/);
  }
  assertUnchangedHelper(source, Buffer.concat([source, Buffer.from(block)]));
});

test('unsigned helper, duplicate blocks and executable suffix cannot pass as signing', () => {
  const source = Buffer.from('param()\n');
  for (const suffix of ['', block + block, block + 'Write-Output "evil"\n',
    block + '\n', block.replace('# c3ludGhldGlj', 'Write-Output "evil"')]) {
    assert.throws(() => assertUnchangedHelper(source, Buffer.concat([source, Buffer.from(suffix)])),
      /invalid_signature_block/);
  }
});

test('approval, source, unsigned helper, signer, timestamp and payload mismatches fail closed', async (t) => {
  const mutations = [
    ['approval pin', (f) => { f.options.approvalSha256 = 'c'.repeat(64); }, /approval_pin_mismatch/],
    ['unsigned manifest pin', async (f) => { f.approval.unsignedManifestSha256 = 'c'.repeat(64); await f.saveApproval(); }, /unsigned_manifest_pin_mismatch/],
    ['source revision', async (f) => { f.approval.sourceRevision = 'c'.repeat(40); await f.saveApproval(); }, /source_provenance_mismatch/],
    ['dirty flag', async (f) => { f.approval.sourceDirty = false; await f.saveApproval(); }, /source_provenance_mismatch/],
    ['release flag', async (f) => { f.approval.release = true; await f.saveApproval(); }, /source_provenance_mismatch/],
    ['unsigned source', async (f) => { await writeFile(f.options.unsignedHelperPath, 'changed'); }, /unsigned_helper_pin_mismatch/],
    ['signed helper pin', async (f) => { f.approval.files.find((file) => file.path === HELPER).sha256 = 'c'.repeat(64); await f.saveApproval(); }, /file_pin_mismatch/],
    ['signer certificate', (f) => { f.evidence.certificateSha256 = 'c'.repeat(64); }, /signer_pin_mismatch/],
    ['signer identity', (f) => { f.evidence.subject = 'CN=Other'; }, /signer_pin_mismatch/],
    ['invalid signature', (f) => { f.evidence.winVerifyTrustStatus = -1; }, /authenticode_invalid/],
    ['revoked certificate', (f) => { f.evidence.winVerifyTrustStatus = 0x800B010C; }, /authenticode_invalid/],
    ['untrusted root', (f) => { f.evidence.winVerifyTrustStatus = 0x800B0109; }, /authenticode_invalid/],
    ['offline revocation cache unavailable', (f) => { f.evidence.winVerifyTrustStatus = 0x80092013; }, /authenticode_invalid/],
    ['wrong probed file', (f) => { f.evidence.helperSha256 = 'c'.repeat(64); }, /signature_file_mismatch/],
    ['unexpected timestamp', (f) => { f.evidence.timestampPresent = true; }, /timestamp_policy_mismatch/],
    ['missing required timestamp', async (f) => { f.approval.signer.timestampPolicy = 'required'; await f.saveApproval(); }, /timestamp_policy_mismatch/],
    ['expired pilot', (f) => { f.evidence.certificateNotAfter = '2000-01-01T00:00:00Z'; }, /pilot_certificate_expired/],
    ['changed nonsigned file', async (f) => { await writeFile(join(f.options.packageDirectory, 'README.txt'), 'changed'); }, /file_pin_mismatch/],
    ['repinned nonsigned file', async (f) => { f.approval.files.find((file) => file.path === 'README.txt').sha256 = 'c'.repeat(64); await f.saveApproval(); }, /non_helper_changed/],
  ];
  for (const [name, mutate, pattern] of mutations) {
    await t.test(name, () => fixture(async (f) => { await mutate(f); await mustRejectWithoutWriting(f, pattern); }));
  }
});

test('required timestamp accepts only native-validated evidence with timestamp present', async () => {
  await fixture(async (f) => {
    f.approval.signer.timestampPolicy = 'required';
    f.evidence.timestampPresent = true;
    await f.saveApproval();
    const receipt = await finalizeRuntimeOnboardingPackage(f.options, f.probe);
    assert.equal(receipt.signer.timestampPolicy, 'required');
  });
});

test('exact file set, manifest path and link policy are enforced', async (t) => {
  const cases = [
    ['unexpected file', async (f) => writeFile(join(f.options.packageDirectory, 'extra.pfx'), 'fixture'), /unexpected_file_set/],
    ['unexpected directory', async (f) => mkdir(join(f.options.packageDirectory, 'extra')), /unexpected_file_set/],
    ['missing payload', async (f) => rm(join(f.options.packageDirectory, 'README.txt')), /unexpected_file_set/],
    ['symlink payload', async (f) => {
      const path = join(f.options.packageDirectory, 'README.txt');
      await rm(path); await symlink(f.options.unsignedHelperPath, path);
    }, /unsafe_path/],
    ['hard link payload', async (f) => {
      const path = join(f.options.packageDirectory, 'README.txt');
      await link(path, join(f.root, 'hardlink.txt'));
    }, /unsafe_path/],
    ['linked staging root', async (f) => {
      const path = join(f.root, 'linked');
      await symlink(f.options.packageDirectory, path, 'junction'); f.options.packageDirectory = path;
    }, /unsafe_path/],
    ['traversal in manifest', async (f) => {
      f.original.files[0].path = '../outside';
      const bytes = encode(f.original);
      await writeFile(f.options.unsignedManifestPath, bytes);
      await writeFile(join(f.options.packageDirectory, 'manifest.json'), bytes);
      f.approval.unsignedManifestSha256 = sha256(bytes);
      await f.saveApproval();
    }, /unexpected_file_set/],
    ['duplicate approval path', async (f) => {
      f.approval.files[1] = f.approval.files[0]; await f.saveApproval();
    }, /unexpected_file_set/],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () => fixture(async (f) => { await mutate(f); await mustRejectWithoutWriting(f, pattern); }));
  }
});

test('observed changes during native verification never produce a final manifest', async () => {
  await fixture(async (f) => {
    await mustRejectWithoutWriting(f, /package_changed_during_verification/, async () => {
      await writeFile(join(f.options.packageDirectory, HELPER), 'changed during probe');
      return f.evidence;
    });
  });
});

test('external baselines and approval remain unchanged throughout finalization', async () => {
  await fixture(async (f) => {
    await mustRejectWithoutWriting(f, /approval_input_changed_during_verification/, async () => {
      await writeFile(f.options.unsignedHelperPath, 'changed baseline during probe');
      return f.evidence;
    });
  });
  await fixture(async (f) => {
    f.options.unsignedManifestPath = join(f.options.packageDirectory, 'manifest.json');
    await mustRejectWithoutWriting(f, /external_inputs_and_tooling_required/);
  });
});

test('finalize refuses already-finalized output and verify requires an independent final pin', async () => {
  await fixture(async (f) => {
    await finalizeRuntimeOnboardingPackage(f.options, f.probe);
    await mustRejectWithoutWriting(f, /staging_manifest_mismatch/);
    f.options.mode = 'verify';
    await mustRejectWithoutWriting(f, /invalid_sha256/);
    f.options.manifestSha256 = 'c'.repeat(64);
    await mustRejectWithoutWriting(f, /final_manifest_pin_mismatch/);
  });
});

test('real CLI has no imported signature receipt or bypass and non-Windows cannot finalize', async () => {
  const path = join(import.meta.dirname, 'finalize-runtime-onboarding-package.mjs');
  const usage = spawnSync(process.execPath, [path, 'verify', '--mock-probe', 'true'], { encoding: 'utf8' });
  assert.equal(usage.status, 64);
  await fixture(async (f) => {
    if (process.platform === 'win32') return; // Native Windows evidence is separately authorized.
    const before = await readFile(join(f.options.packageDirectory, 'manifest.json'));
    const result = spawnSync(process.execPath, [
      path, 'finalize', '--package', f.options.packageDirectory, '--approval', f.options.approvalPath,
      '--approval-sha256', f.options.approvalSha256, '--unsigned-manifest', f.options.unsignedManifestPath,
      '--unsigned-helper', f.options.unsignedHelperPath,
    ], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /windows_verification_required/);
    assert.deepEqual(await readFile(join(f.options.packageDirectory, 'manifest.json')), before);
  });
});

test('Windows probe is cache-only/read-only tooling, never an execution or signing shortcut', async () => {
  const probe = await readFile(join(import.meta.dirname, 'verify-runtime-onboarding-authenticode.ps1'), 'utf8');
  assert.match(probe, /providerFlags = 0x1080/);
  assert.match(probe, /revocationChecks = 1/);
  assert.match(probe, /uiChoice = 2/);
  assert.match(probe, /stateAction = 2/);
  assert.match(probe, /WTHelperGetProvSignerFromChain/);
  assert.match(probe, /counter\.error != 0/);
  assert.match(probe, /timestamp_not_validated/);
  assert.match(probe, /\$cms\.CheckSignature\(\$true\)/);
  assert.match(probe, /sha256_signing_required/);
  assert.match(probe, /if \(\$status -ne 0\) \{ throw/);
  assert.match(probe, /ReparsePoint/);
  assert.match(probe, /unexpected_stream/);
  assert.doesNotMatch(probe, /Set-AuthenticodeSignature|Import-Certificate|Set-ExecutionPolicy|Unblock-File|Invoke-Expression|Invoke-WebRequest/);
  const finalizer = await readFile(join(import.meta.dirname, 'finalize-runtime-onboarding-package.mjs'), 'utf8');
  assert.doesNotMatch(finalizer, /-ExecutionPolicy|-EncodedCommand|-Command'/);
});

test('unchanged real native helper source can be compared without exercising DPAPI', async () => {
  const source = await readFile(join(import.meta.dirname, '../server/scripts/runtime-onboarding-native-store.ps1'));
  assertUnchangedHelper(source, Buffer.concat([source, Buffer.from(block)]));
  const noNewline = Buffer.from('param()');
  assertUnchangedHelper(noNewline, Buffer.concat([noNewline, Buffer.from(block)]));
  assert.throws(() => assertUnchangedHelper(noNewline,
    Buffer.concat([noNewline, Buffer.from(block.slice(1))])), /invalid_signature_block/);
});