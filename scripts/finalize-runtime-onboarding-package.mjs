import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HELPER, PAYLOADS, assertHash, exactKeys, fail, filePins, pinsFromSnapshot,
  readRegular, sha256, snapshotPackage, unsignedManifest,
} from './runtime-onboarding-package-integrity.mjs';

const tooling = dirname(fileURLToPath(import.meta.url));
const BEGIN = '# SIG # Begin signature block';
const END = '# SIG # End signature block';

export function assertUnchangedHelper(unsigned, signed) {
  // Decode without substitution. Replacement characters could hide altered bytes.
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const source = decoder.decode(unsigned);
  if (source.includes(BEGIN) || source.includes(END)
    || !signed.subarray(0, unsigned.length).equals(unsigned)) {
    fail('helper_logic_changed');
  }
  const suffix = decoder.decode(signed.subarray(unsigned.length));
  // One optional line break separates the exact source from the comment block.
  // No executable text, extra signatures, or arbitrary trailing comments allowed.
  const separator = source.endsWith('\n') ? '(?:\\r?\\n)?' : '\\r?\\n';
  if (!new RegExp(`^${separator}# SIG # Begin signature block\\r?\\n`
    + '(?:# [A-Za-z0-9+/=]+\\r?\\n)+# SIG # End signature block(?:\\r?\\n)?(?![\\s\\S])').test(suffix)) {
    fail('invalid_signature_block');
  }
}

function parseApproval(bytes) {
  const approval = JSON.parse(bytes.toString('utf8'));
  exactKeys(approval, ['format', 'approvalId', 'unsignedManifestSha256',
    'sourceRevision', 'sourceDirty', 'release', 'files', 'signer']);
  if (approval.format !== 'holahola-runtime-onboarding-finalization-approval/v1'
    || typeof approval.approvalId !== 'string' || !approval.approvalId.trim()
    || approval.approvalId.length > 200) fail('invalid_approval');
  assertHash(approval.unsignedManifestSha256);
  filePins(approval.files);
  exactKeys(approval.signer, ['subject', 'certificateSha256', 'timestampPolicy']);
  assertHash(approval.signer.certificateSha256);
  if (typeof approval.signer.subject !== 'string' || !approval.signer.subject.trim()
    || !['required', 'absent-internal-pilot'].includes(approval.signer.timestampPolicy)) {
    fail('invalid_signer_approval');
  }
  return approval;
}

export function assertSignatureEvidence(evidence, signer, helperSha256) {
  exactKeys(evidence, ['format', 'helperSha256', 'winVerifyTrustStatus', 'subject',
    'certificateSha256', 'timestampPresent', 'certificateNotAfter']);
  if (evidence.format !== 'holahola-runtime-onboarding-authenticode/v1'
    || evidence.winVerifyTrustStatus !== 0) fail('authenticode_invalid');
  if (evidence.helperSha256 !== helperSha256) fail('signature_file_mismatch');
  if (evidence.subject !== signer.subject
    || evidence.certificateSha256 !== signer.certificateSha256) fail('signer_pin_mismatch');
  if (typeof evidence.timestampPresent !== 'boolean'
    || evidence.timestampPresent !== (signer.timestampPolicy === 'required')) fail('timestamp_policy_mismatch');
  if (!Number.isFinite(Date.parse(evidence.certificateNotAfter))) fail('invalid_certificate_expiry');
  if (signer.timestampPolicy === 'absent-internal-pilot'
    && Date.parse(evidence.certificateNotAfter) <= Date.now()) fail('pilot_certificate_expired');
}

// Production path only. No caller-supplied JSON receipt, fixture or bypass CLI.
// The independently reviewed probe lives beside this tool, NOT in the package.
export async function probeWindowsSignature(helper) {
  if (process.platform !== 'win32') fail('windows_verification_required');
  if (!process.env.SystemRoot || !/^[A-Za-z]:\\/.test(process.env.SystemRoot)) fail('windows_system_root_required');
  const powershell = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const stdout = execFileSync(powershell, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-File',
    join(tooling, 'verify-runtime-onboarding-authenticode.ps1'),
    '-LiteralPath', resolve(helper),
  ], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}

/** Synthetic probe injection is for hermetic library tests only; never CLI. */
export async function finalizeRuntimeOnboardingPackage(options, probe = probeWindowsSignature) {
  const { mode, packageDirectory, approvalPath, approvalSha256,
    unsignedManifestPath, unsignedHelperPath, manifestSha256 } = options;
  if (!['finalize', 'verify'].includes(mode)) fail('invalid_mode');
  for (const input of [approvalPath, unsignedManifestPath, unsignedHelperPath, tooling]) {
    const location = relative(resolve(packageDirectory), resolve(input));
    if (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
      fail('external_inputs_and_tooling_required');
    }
  }
  assertHash(approvalSha256);
  if (mode === 'verify') assertHash(manifestSha256);
  else if (manifestSha256 !== undefined) fail('unexpected_final_manifest_pin');
  const approvalBytes = await readRegular(approvalPath);
  if (sha256(approvalBytes) !== approvalSha256) fail('approval_pin_mismatch');
  const approval = parseApproval(approvalBytes);
  const originalBytes = await readRegular(unsignedManifestPath);
  if (sha256(originalBytes) !== approval.unsignedManifestSha256) fail('unsigned_manifest_pin_mismatch');
  const original = unsignedManifest(originalBytes);
  for (const key of ['sourceRevision', 'sourceDirty', 'release']) {
    if (approval[key] !== original[key]) fail('source_provenance_mismatch');
  }
  const baseline = filePins(original.files);
  const approved = filePins(approval.files);
  const unsigned = await readRegular(unsignedHelperPath);
  if (unsigned.length !== baseline.get(HELPER).bytes
    || sha256(unsigned) !== baseline.get(HELPER).sha256) fail('unsigned_helper_pin_mismatch');
  for (const path of PAYLOADS.filter((path) => path !== HELPER)) {
    if (approved.get(path).sha256 !== baseline.get(path).sha256
      || approved.get(path).bytes !== baseline.get(path).bytes) fail('non_helper_changed');
  }
  const before = await snapshotPackage(packageDirectory);
  const currentManifest = before.get('manifest.json');
  if (mode === 'finalize' && !currentManifest.equals(originalBytes)) fail('staging_manifest_mismatch');
  if (mode === 'verify' && sha256(currentManifest) !== manifestSha256) fail('final_manifest_pin_mismatch');
  const files = pinsFromSnapshot(before);
  for (const file of files) {
    const pin = approved.get(file.path);
    if (file.sha256 !== pin.sha256 || file.bytes !== pin.bytes) fail('file_pin_mismatch');
  }
  assertUnchangedHelper(unsigned, before.get(HELPER));
  const evidence = await probe(join(packageDirectory, HELPER));
  assertSignatureEvidence(evidence, approval.signer, sha256(before.get(HELPER)));
  const finalization = {
    format: 'holahola-runtime-onboarding-finalization/v1',
    approvalId: approval.approvalId,
    approvalSha256,
    unsignedManifestSha256: approval.unsignedManifestSha256,
    unsignedHelperSha256: baseline.get(HELPER).sha256,
    signer: approval.signer,
  };
  const finalManifest = { ...original, files, finalization };
  const finalBytes = Buffer.from(JSON.stringify(finalManifest, null, 2) + '\n');
  if (mode === 'verify' && !currentManifest.equals(finalBytes)) fail('stale_or_altered_final_manifest');
  // Reinspect exact paths and every byte after the native probe. Nothing is
  // written on any failure, including an observed concurrent modification.
  const after = await snapshotPackage(packageDirectory);
  for (const [path, bytes] of before) {
    if (!after.get(path).equals(bytes)) fail('package_changed_during_verification');
  }
  for (const [path, bytes] of [
    [approvalPath, approvalBytes], [unsignedManifestPath, originalBytes], [unsignedHelperPath, unsigned],
  ]) {
    if (!(await readRegular(path)).equals(bytes)) fail('approval_input_changed_during_verification');
  }
  if (mode === 'finalize') {
    const temporary = join(packageDirectory, `.manifest-${randomUUID()}.tmp`);
    let created = false;
    try {
      await writeFile(temporary, finalBytes, { flag: 'wx', mode: 0o600 });
      created = true;
      await rename(temporary, join(packageDirectory, 'manifest.json'));
    } finally {
      if (created) await rm(temporary, { force: true });
    }
  }
  return {
    mode, sourceRevision: original.sourceRevision, sourceDirty: original.sourceDirty,
    release: original.release, approvalSha256,
    unsignedManifestSha256: approval.unsignedManifestSha256,
    manifestSha256: sha256(finalBytes), files, signer: approval.signer,
    certificateNotAfter: evidence.certificateNotAfter,
    authorizationScope: 'offline-finalization-only',
  };
}

function cliOptions(args) {
  const mode = args.shift();
  const flags = {
    '--package': 'packageDirectory', '--approval': 'approvalPath',
    '--approval-sha256': 'approvalSha256', '--unsigned-manifest': 'unsignedManifestPath',
    '--unsigned-helper': 'unsignedHelperPath', '--manifest-sha256': 'manifestSha256',
  };
  const options = { mode };
  while (args.length) {
    const flag = args.shift();
    const value = args.shift();
    if (!flags[flag] || !value || value.startsWith('--') || options[flags[flag]] !== undefined) fail('usage');
    options[flags[flag]] = value;
  }
  if (!['finalize', 'verify'].includes(mode)
    || Object.values(flags).filter((key) => key !== 'manifestSha256').some((key) => !options[key])
    || (mode === 'verify' ? !options.manifestSha256 : options.manifestSha256 !== undefined)) fail('usage');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = cliOptions(process.argv.slice(2));
    finalizeRuntimeOnboardingPackage(options).then((receipt) => {
      process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
    }).catch((error) => {
      process.stderr.write(error.message.startsWith('onboarding_')
        ? `${error.message}\n` : 'onboarding_offline_verification_failed\n');
      process.exitCode = 1;
    });
  } catch {
    process.stderr.write('Usage: node scripts/finalize-runtime-onboarding-package.mjs finalize|verify'
      + ' --package PATH --approval PATH --approval-sha256 HASH --unsigned-manifest PATH'
      + ' --unsigned-helper PATH [--manifest-sha256 HASH (verify only)]\n');
    process.exitCode = 64;
  }
}