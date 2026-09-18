import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, open, readFile, rename, rm, lstat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { Gate3Executor } from './coordination-runtime-antigravity';
import { prepareCoordinationWindowsGeneration } from './coordination-windows-prepare';
import { runCoordinationWindowsPreflight, type PreflightDependencies, type PreflightOptions, type PreflightReport } from './coordination-windows-preflight';
import { createHostEnvelope, type HostEnvelope } from '../services/coordination-host-protocol';
import { canonicalJson } from '../services/coordination-policy-canonicalization';
import { verifyCoordinationV2PreflightEnvelope } from './coordination-v2-preflight-verifier';
import { resolveCoordinationV2ProtectedRemoteCommit } from '../services/coordination-v2-preparation-material-service';
import { normalizeCoordinationRepositoryIdentity } from '../services/coordination-repository-identity';
import type { CoordinationWindowsBoundState, CoordinationWindowsHostDependencies, CoordinationWindowsLifecycleState, CoordinationWindowsOperatorInput, CoordinationWindowsPreparationInput } from './coordination-windows-host';
import type { HostOperationAdapter } from '../services/coordination-host-operation-service';

export type CoordinationV2DpapiMaterial = Readonly<{ endpoint: string; accessToken: string }>;
export type CoordinationV2HttpFactoryOptions = {
  materialPath?: string;
  request?: (url: string, init: RequestInit) => Promise<Response>;
  material?: CoordinationV2DpapiMaterial;
  /** Hermetic route tests may inject a proof; production always uses DPAPI. */
  signProof?: (token: string) => Promise<string>;
  verifyPreparationEnvelope?: typeof verifyCoordinationV2PreflightEnvelope;
  readRepositoryIdentity?: () => Promise<string>;
};
const SAFE_TOKEN = /^v2h_[A-Za-z0-9_-]{32,}$/;
const endpointPattern = /^https:\/\/[^/\s]+(?:\/[^/\s]+)*$/;
const execFile = promisify(execFileCallback);

export function assertCoordinationV2LifecycleHostIdentity(started: {
  opaque?: unknown;
  preparation?: { reservation?: { enrolledHostId?: unknown } };
}): string {
  const opaqueHostEnrollmentId = (started.opaque as Record<string, unknown> | undefined)?.hostEnrollmentId;
  if (typeof opaqueHostEnrollmentId !== 'string' || !opaqueHostEnrollmentId) throw new Error('v2_host_lifecycle_identity_missing');
  const startedReservation = started.preparation?.reservation;
  if (startedReservation && startedReservation.enrolledHostId !== opaqueHostEnrollmentId) {
    throw new Error('v2_host_lifecycle_identity_mismatch');
  }
  return opaqueHostEnrollmentId;
}

function defaultMaterialPath() {
  const root = process.env.LOCALAPPDATA;
  if (!root) throw new Error('current_user_local_appdata_unavailable');
  return join(root, 'HolaHola', 'CoordinatorV2', 'host-material.dpapi');
}
function powershell(script: string, input: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
    });
    const output: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolveOutput(Buffer.concat(output).toString('utf8')) : reject(new Error('dpapi_current_user_operation_failed')));
    child.stdin.end(input);
  });
}
function validMaterial(value: unknown): CoordinationV2DpapiMaterial {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('host_material_invalid');
  const row = value as Record<string, unknown>;
  if (typeof row.endpoint !== 'string' || !endpointPattern.test(row.endpoint)
    || typeof row.accessToken !== 'string' || !SAFE_TOKEN.test(row.accessToken)) throw new Error('host_material_invalid');
  return Object.freeze({ endpoint: row.endpoint.replace(/\/+$/, ''), accessToken: row.accessToken });
}
export async function readCoordinationV2CurrentUserMaterial(path = defaultMaterialPath()) {
  if (process.platform !== 'win32') throw new Error('windows_required');
  const ciphertext = (await readFile(path, 'utf8')).trim();
  const json = await powershell(
    '$ErrorActionPreference="Stop";$b=[Convert]::FromBase64String(([Console]::In.ReadToEnd()).Trim());[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))',
    ciphertext,
  );
  return validMaterial(JSON.parse(json));
}
export async function writeCoordinationV2CurrentUserMaterial(material: CoordinationV2DpapiMaterial, path = defaultMaterialPath()) {
  if (process.platform !== 'win32') throw new Error('windows_required');
  const value = validMaterial(material);
  const ciphertext = await powershell(
    '$ErrorActionPreference="Stop";$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))',
    JSON.stringify(value),
  );
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, ciphertext, { mode: 0o600 });
  await rename(temporary, path);
}
function digest(value: Uint8Array | string | unknown) {
  return createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : canonicalJson(value)).digest('hex');
}
function id(prefix: string) { return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`; }
function envelope(kind: any, payload: Record<string, unknown>, requestId = id(kind)) {
  const issuedAt = new Date().toISOString();
  return createHostEnvelope(kind, payload, { requestId, correlationId: requestId, issuedAt, expiresAt: new Date(Date.now() + 120_000).toISOString() });
}
async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`v2_host_http_${response.status}`);
  const value = await response.json() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('v2_host_response_invalid');
  return value as Record<string, unknown>;
}
async function signHostToken(token: string, privatePath = join(process.env.LOCALAPPDATA ?? '', 'HolaHola', 'CoordinatorV2', 'host-private-key.dpapi')) {
  const cipher = (await readFile(privatePath, 'utf8')).trim();
  return powershell(
    '$ErrorActionPreference="Stop";$v=ConvertFrom-Json ([Console]::In.ReadToEnd());$c=[Convert]::FromBase64String($v.cipher);$xml=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($c,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser));$r=New-Object Security.Cryptography.RSACryptoServiceProvider;$r.FromXmlString($xml);[Console]::Out.Write([Convert]::ToBase64String($r.SignData([Text.Encoding]::UTF8.GetBytes($v.token),[Security.Cryptography.CryptoConfig]::MapNameToOID("SHA256"))))',
    JSON.stringify({ cipher, token }),
  );
}

const WINDOWS_INSPECTION_SCRIPT = `
$ErrorActionPreference = "Stop"
$p = ([Console]::In.ReadToEnd()).Trim()
if ([string]::IsNullOrWhiteSpace($p)) { throw "path_required" }
$item = Get-Item -LiteralPath $p -Force
$acl = Get-Acl -LiteralPath $p
$toSid = {
  param($identity)
  if ($identity -is [Security.Principal.SecurityIdentifier]) { return $identity.Value }
  $account = New-Object -TypeName System.Security.Principal.NTAccount -ArgumentList ([string]$identity)
  $translated = $account.Translate([Security.Principal.SecurityIdentifier])
  return $translated.Value
}
$current = & $toSid ([Security.Principal.WindowsIdentity]::GetCurrent().User)
$owner = & $toSid $acl.Owner
$allowedOwners = @($current, "S-1-5-18", "S-1-5-32-544")
$dangerous = @("S-1-1-0", "S-1-5-32-545", "S-1-5-11")
$writable = @($acl.Access | Where-Object {
  $_.AccessControlType -eq "Allow" -and
  ([string]$_.FileSystemRights -match "Write|Modify|FullControl|Delete")
} | ForEach-Object { & $toSid $_.IdentityReference })
$broadWritable = @($writable | Where-Object { $dangerous -contains $_ })
$entries = @($acl.Access | ForEach-Object {
  @{ identity=(& $toSid $_.IdentityReference); rights=[string]$_.FileSystemRights;
     type=[string]$_.AccessControlType; inherited=([bool]$_.IsInherited) }
})
$resolved = [IO.Path]::GetFullPath($item.FullName)
$result = @{
  exists=$true; isDirectory=$item.PSIsContainer; isFile=(-not $item.PSIsContainer)
  reparseFree=(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)
  ownerAllowed=($allowedOwners -contains $owner)
  aclSafe=(($allowedOwners -contains $owner) -and $broadWritable.Count -eq 0)
  resolvedFullName=$resolved; entries=$entries
}
[Console]::Out.Write(($result | ConvertTo-Json -Compress -Depth 5))
`;

async function inspectWindowsPath(path: string) {
  if (process.platform !== 'win32') return { exists: false, reparseFree: false, aclSafe: false };
  try {
    const item = await lstat(path);
    const result = JSON.parse(await powershell(WINDOWS_INSPECTION_SCRIPT, path)) as Record<string, unknown>;
    if (result.exists !== true || typeof result.resolvedFullName !== 'string'
      || typeof result.reparseFree !== 'boolean' || typeof result.aclSafe !== 'boolean'
      || typeof result.ownerAllowed !== 'boolean' || !Array.isArray(result.entries)) {
      throw new Error('windows_inspection_malformed');
    }
    const normalize = (value: string) => value.replaceAll('/', '\\').replace(/[\\]+$/, '').toLowerCase();
    const containment = normalize(result.resolvedFullName) === normalize(path);
    return {
      exists: item.isFile() || item.isDirectory(), isDirectory: item.isDirectory(), isFile: item.isFile(),
      reparseFree: result.reparseFree === true && !item.isSymbolicLink(),
      aclSafe: result.aclSafe === true && result.ownerAllowed === true && containment,
      evidenceDigest: digest({ resolvedFullName: result.resolvedFullName, ownerAllowed: result.ownerAllowed, entries: result.entries }),
    };
  } catch {
    return { exists: false, reparseFree: false, aclSafe: false };
  }
}

async function concretePreflight(material: CoordinationV2DpapiMaterial, root: string, request: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init)): Promise<PreflightReport> {
  const launcher = resolve(root, 'scripts/hola-coordinator.ps1');
  const runtime = process.execPath;
  const inspect = inspectWindowsPath;
  const signedDigest = async (path: string) => {
    const signatureValid = process.platform === 'win32'
      && (await powershell('$ErrorActionPreference="Stop";[Console]::Out.Write((Get-AuthenticodeSignature -LiteralPath ([Console]::In.ReadToEnd()).Trim()).Status)', path)).trim() === 'Valid';
    return { digest: digest(await readFile(path)), signatureValid };
  };
  const git = async (args: string[]) => (await execFile('git', ['-C', root, ...args], { windowsHide: true })).stdout.trim();
  const repository = async () => ({
    identity: await git(['config', '--get', 'remote.origin.url']).catch(() => root),
    branch: await git(['rev-parse', '--abbrev-ref', 'HEAD']),
    clean: (await git(['status', '--porcelain'])) === '',
    startingCommit: await git(['rev-parse', 'HEAD']),
  });
  const repo = await repository();
  const deps: PreflightDependencies = {
    fs: { inspect, inventory: () => ({ active: null, staged: [] }) },
    process: {
       powershellVersion: async () => {
         if (process.platform !== 'win32') return { major: 0, minor: 0 };
         const version = await powershell('$v=$PSVersionTable.PSVersion;[Console]::Out.Write("$($v.Major).$($v.Minor)")', '');
         const [major, minor] = version.trim().split('.').map(Number);
         return { major, minor };
       },
       currentUserContext: async () => {
         if (process.platform !== 'win32') return { available: false };
         return JSON.parse(await powershell('[Console]::Out.Write((@{available=(([Security.Principal.WindowsIdentity]::GetCurrent()).User -ne $null)} | ConvertTo-Json -Compress))', ''));
       },
       dpapiCurrentUser: async () => process.platform === 'win32',
      signedDigest,
    },
    repository,
    network: async () => {
      if (!endpointPattern.test(material.endpoint)) return false;
      try { return (await request(`${material.endpoint}/api/coordination/v2/host/protocol`, {})).ok; } catch { return false; }
    },
    server: {
      protocolVersion: async () => {
        const response = await request(`${material.endpoint}/api/coordination/v2/host/protocol`, {});
        const body = await response.json() as { protocolVersion?: number };
        return body.protocolVersion ?? 0;
      },
      enrollmentCompatible: async () => {
        const response = await request(`${material.endpoint}/api/coordination/v2/host/protocol`, {});
        const body = await response.json() as { enrollmentCompatible?: boolean };
        return body.enrollmentCompatible === true;
      },
    },
  };
  const options: PreflightOptions = {
    approvedInstallationPath: root, approvedWorktreePath: root, launcherPath: launcher,
    launcherDigest: digest(await readFile(launcher)), runtimePath: runtime, runtimeDigest: digest(await readFile(runtime)),
    repositoryIdentity: repo.identity, branch: repo.branch, startingCommit: repo.startingCommit,
  };
  return runCoordinationWindowsPreflight(options, deps);
}

function fileJournal(root: string): CoordinationWindowsHostDependencies['executionJournal'] {
  const directory = join(root, '.coordination-v2-execution-journal');
  const pathFor = (key: string) => join(directory, `${digest(key)}.json`);
  return {
    async begin(key, claim) {
      await mkdir(directory, { recursive: true });
      const path = pathFor(key);
      try {
        const row = JSON.parse(await readFile(path, 'utf8')) as { state: string; result?: HostEnvelope };
        return row.state === 'completed' && row.result ? { state: 'completed', result: row.result as HostEnvelope<'structured_result'> } : { state: 'started', fresh: false };
      } catch { /* claim the durable file below */ }
      try {
        const handle = await open(path, 'wx');
        await handle.writeFile(JSON.stringify({ state: 'started', claimDigest: digest(JSON.stringify(claim)) }));
        await handle.close();
        return { state: 'started', fresh: true };
      } catch { return { state: 'started', fresh: false }; }
    },
    async complete(key, result) {
      const path = pathFor(key); const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ state: 'completed', result }), { mode: 0o600 });
      await rename(temporary, path);
    },
    async reconcile({ claimIdentity }) {
      try {
        const row = JSON.parse(await readFile(pathFor(claimIdentity), 'utf8')) as { result?: HostEnvelope };
        return row.result as HostEnvelope<'structured_result'> | undefined;
      } catch { return undefined; }
    },
  };
}

function concreteAdapter(root: string): HostOperationAdapter {
  const executor = new Gate3Executor(root);
  return { execute: (request) => executor.execute({ name: request.operation, arguments: request.input }) };
}

export async function createCoordinationV2HttpDependencyFactory(options: CoordinationV2HttpFactoryOptions = {}) {
  const material = options.material ?? await readCoordinationV2CurrentUserMaterial(options.materialPath);
  const request = options.request ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }));
  const root = process.cwd();
  const verifyRepository = async () => normalizeCoordinationRepositoryIdentity(
    (await execFile('git', ['-C', root, 'config', '--get', 'remote.origin.url'])).stdout.trim(),
  );
  const post = async (path: string, body: unknown, token = material.accessToken, session = true, proof?: string) => jsonResponse(await request(`${material.endpoint}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', [session ? 'x-coordination-v2-session-token' : 'x-coordination-v2-host-token']: token, ...(proof ? { [session ? 'x-coordination-v2-session-proof' : 'x-coordination-v2-host-proof']: proof } : {}) }, body: JSON.stringify(body),
  }));
  return async (input: CoordinationWindowsOperatorInput): Promise<CoordinationWindowsHostDependencies> => {
    let sessionToken = '';
    let cleanupSessionToken = '';
    let acknowledgedSessionId = '';
    let lifecycleOpaque: Record<string, unknown> = {};
    // This is transport lineage, not operator authority. Generate it once for
    // this CLI run and never derive it from argv, host names, or credentials.
    const holderInstanceId = `holder-${randomUUID()}`;
    const sign = options.signProof ?? signHostToken;
    const sessionPost = async (path: string, body: unknown) => {
      const proof = await sign(sessionToken);
      return post(path, body, sessionToken, true, proof);
    };
    const transport = {
      start: async () => {
        const started = await post('/api/coordination/v2/host/lifecycle', { ...input, holderInstanceId }, material.accessToken, false, await sign(material.accessToken));
        const opaqueHostEnrollmentId = assertCoordinationV2LifecycleHostIdentity(started);
        lifecycleOpaque = (started.opaque as Record<string, unknown> | undefined) ?? {};
        if (started.opaqueState && typeof started.opaqueState === 'object' && !Array.isArray(started.opaqueState)) {
          lifecycleOpaque = { ...lifecycleOpaque, ...(started.opaqueState as Record<string, unknown>) };
        }
        if (started.preflightEnvelope) {
          const envelope = started.preflightEnvelope as { payload: Record<string, unknown>; signature: string; keyFingerprint: string };
          const verifyEnvelope = options.verifyPreparationEnvelope ?? verifyCoordinationV2PreflightEnvelope;
          await verifyEnvelope({
            ...envelope, expectedHostEnrollmentId: opaqueHostEnrollmentId,
            expectedRepositoryIdentity: await (options.readRepositoryIdentity ?? verifyRepository)(),
            expectedTaskArtifactSha: String(envelope.payload.taskArtifactSha ?? ''),
            expectedPublicMaterialDigest: String(envelope.payload.publicMaterialDigest ?? ''),
            verifyCheckout: async (commit, tree, repository) => {
              const proof = await resolveCoordinationV2ProtectedRemoteCommit(commit, repository);
              return proof.sha === commit && proof.treeSha === tree;
            },
          });
        }
        const startedPreparation = started.preparation as any;
        if (startedPreparation?.envelope?.payload) {
          const payload = startedPreparation.envelope.payload as Record<string, unknown>;
          const reservation = startedPreparation.reservation;
          started.preparation = {
            reservation: {
              id: reservation.id, sessionId: reservation.sessionId, enrolledHostId: reservation.enrolledHostId,
              generationId: reservation.generationId, reservationDigest: reservation.reservationDigest,
              taskRef: reservation.taskRef, taskArtifactSha256: reservation.taskArtifactSha256,
              promotionRecordId: reservation.promotionRecordId, promotedCommitSha: reservation.promotedCommitSha,
              exactTreeSha: reservation.exactTreeSha, policyIdentityId: reservation.policyIdentityId,
              policyVersionId: reservation.policyVersionId, operatorGrantId: reservation.operatorGrantId,
              operatorActor: reservation.operatorActor,
              publicMaterialDigest: reservation.publicMaterialDigest, protocolVersion: reservation.protocolVersion,
              repositoryIdentity: reservation.repositoryIdentity, branch: reservation.branch,
              startingCommit: reservation.startingCommit, state: reservation.state,
              reserveRequestKey: reservation.reserveRequestKey, reserveCommandDigest: reservation.reserveCommandDigest,
              acknowledgementRequestKey: reservation.acknowledgementRequestKey, ackCommandDigest: reservation.ackCommandDigest,
              safePromotionEvidenceDigest: reservation.safePromotionEvidenceDigest, createdAt: reservation.createdAt,
              expiresAt: reservation.expiresAt, promotedAt: reservation.promotedAt,
              acknowledgedAt: reservation.acknowledgedAt, expiredAt: reservation.expiredAt,
              failedAt: reservation.failedAt, abandonedAt: reservation.abandonedAt,
              failureCode: reservation.failureCode, abandonCode: reservation.abandonCode,
            },
            root, activePointer: join(root, '.coordination-v2-active'),
            publicArtifacts: {
              'task-artifact': Buffer.from(String(payload.taskArtifact || ''), 'base64'),
              'coordinator-config.json': Buffer.from(String(payload.publicCoordinatorConfig || ''), 'base64'),
            },
            dependencies: {} as any,
            acknowledgementRequestKey: `${reservation.id}:acknowledge`,
            safePromotionEvidenceDigest: reservation.reservationDigest,
          };
        }
        if (typeof started.sessionToken === 'string' && /^v2s_/.test(started.sessionToken)) sessionToken = started.sessionToken;
        return started;
      },
      acquireLease: async ({ state }: any) => {
        const effectiveState = {
          ...state,
          ...(state.sessionId ? {} : { sessionId: acknowledgedSessionId || lifecycleOpaque.sessionId }),
          holderInstanceId,
        };
        const result = await post('/api/coordination/v2/host/leases', envelope('lease_request', {
        sessionId: effectiveState.sessionId, holderInstanceId: effectiveState.holderInstanceId, durationMs: effectiveState.durationMs ?? 900_000,
        }), material.accessToken, false, await sign(material.accessToken));
        if (typeof result.sessionToken !== 'string' || !/^v2s_/.test(result.sessionToken)
          || typeof result.cleanupSessionToken !== 'string' || !/^v2s_/.test(result.cleanupSessionToken)) throw new Error('v2_host_session_credential_missing');
        sessionToken = result.sessionToken; cleanupSessionToken = result.cleanupSessionToken;
        const bound: CoordinationWindowsBoundState = {
          sessionId: String(result.sessionId ?? effectiveState.sessionId ?? ''),
           reservationId: String(lifecycleOpaque.preparationReservationId ?? lifecycleOpaque.reservationId ?? ''),
           generationId: String(lifecycleOpaque.generationId ?? ''),
           policyVersionId: String(lifecycleOpaque.policyVersionId ?? ''),
           attemptId: String(result.attemptId ?? lifecycleOpaque.attemptId ?? ''),
           enrolledHostId: String(lifecycleOpaque.hostEnrollmentId ?? lifecycleOpaque.enrolledHostId ?? ''),
          leaseId: String(result.id ?? ''),
          leaseEpoch: Number(result.epoch),
          holderInstanceId: String(result.holderInstanceId ?? effectiveState.holderInstanceId ?? ''),
          binding: {
            policyVersionId: String(lifecycleOpaque.policyVersionId ?? ''),
            sessionId: String(result.sessionId ?? effectiveState.sessionId ?? ''),
            attemptId: String(result.attemptId ?? ''),
            enrolledHostId: String(lifecycleOpaque.hostEnrollmentId ?? ''),
            transportLeaseId: String(result.id ?? ''),
            leaseEpoch: Number(result.epoch),
            holderInstanceId: String(result.holderInstanceId ?? effectiveState.holderInstanceId ?? ''),
            operation: 'lease',
            operationDigest: digest({
              operation: 'lease',
              sessionId: String(result.sessionId ?? effectiveState.sessionId ?? ''),
              holderInstanceId: String(result.holderInstanceId ?? effectiveState.holderInstanceId ?? ''),
              durationMs: effectiveState.durationMs ?? 900_000,
            }),
          },
          sessionToken: result.sessionToken, cleanupSessionToken: result.cleanupSessionToken,
          cleanupCredentialId: String(result.cleanupCredentialId ?? ''),
        };
        return { ...result, state: bound };
      },
      poll: async ({ state, requestKey }: any) => {
        const sessionId = String(state.sessionId ?? '');
        const payload = { operation: 'poll', requestKey };
        const binding = operationBinding(state, 'poll', payload);
        const response = await sessionPost(`/api/coordination/v2/host/sessions/${encodeURIComponent(sessionId)}/poll`, envelope('work_poll', { binding }));
        const polledAttempt = response.attempt as Record<string, unknown> | null | undefined;
        const offer = polledAttempt
          && ['intent_ready', 'waiting_for_host'].includes(String(polledAttempt.state))
          && typeof polledAttempt.id === 'string'
          ? { attemptId: polledAttempt.id, operation: 'execute' } : undefined;
        return {
          state,
          action: offer ? 'operation_available' as const : 'renew' as const,
          ...(offer ? { offer } : {}),
        };
      },
      claim: async ({ state, requestKey, offer }: any) => {
        const payload = { operation: 'claim', requestKey, offer };
        const binding = operationBinding(state, 'claim', payload);
        const response = await sessionPost(`/api/coordination/v2/host/sessions/${encodeURIComponent(String(state.sessionId))}/claim`, envelope('operation_claim', { binding }));
        const claimedState = { ...state, ...(typeof response.claimId === 'string' ? { claimId: response.claimId } : {}),
          ...(typeof response.attemptId === 'string' ? { attemptId: response.attemptId } : {}) };
        const claimBinding = operationBinding(claimedState, 'claim', payload);
        return {
          state: claimedState,
          claim: envelope('operation_claim', { binding: claimBinding }, `${requestKey}:server-claim`),
        };
      },
      renew: async ({ state, requestKey }: any) => {
        const sessionProof = await sign(sessionToken);
        await jsonResponse(await request(`${material.endpoint}/api/coordination/v2/host/sessions/${encodeURIComponent(String(state.sessionId))}/renew`, {
          method: 'POST', headers: {
            'content-type': 'application/json', 'x-coordination-v2-session-token': sessionToken,
            'x-coordination-v2-session-proof': sessionProof,
          }, body: JSON.stringify({ holderInstanceId: state.holderInstanceId }),
        }));
        const payload = { operation: 'renew', requestKey, durationMs: 900_000 };
        const binding = operationBinding(state, 'renew', payload);
        await sessionPost(`/api/coordination/v2/host/leases/${encodeURIComponent(String(state.leaseId))}/renew`, envelope('lease_renewal', { binding, durationMs: 900_000 }));
        return { state };
      },
      result: async ({ state, requestKey, result: value }: any) => {
        const resultDigest = digest(value);
        const binding = operationBinding(state, 'result', { operation: 'result', requestKey, result: value, resultDigest });
        const response = await sessionPost(`/api/coordination/v2/host/sessions/${encodeURIComponent(String(state.sessionId))}/result`, envelope('structured_result', { binding, result: value, resultDigest }));
        return {
          state: { ...state, ...(typeof response.obligationId === 'string' ? { obligationId: response.obligationId } : {}) },
          ...(typeof response.terminalState === 'string' ? { terminalState: response.terminalState } : {}),
        };
      },
      cleanup: async ({ state, requestKey }: any) => {
        if (!cleanupSessionToken) throw new Error('v2_host_cleanup_credential_missing');
        const proof = await sign(cleanupSessionToken);
        const evidence = {};
        const evidenceDigest = digest(evidence);
        const binding = operationBinding(state, 'cleanup', { operation: 'cleanup', requestKey, obligationId: state.obligationId, evidenceDigest });
        const response = await post(`/api/coordination/v2/host/sessions/${encodeURIComponent(String(state.sessionId))}/cleanup`,
          envelope('cleanup_acknowledgement', { binding, obligationId: state.obligationId, evidence, evidenceDigest }),
          cleanupSessionToken, true, proof);
        return { state, acknowledged: response.accepted === true || response.outcome === 'acknowledged' };
      },
      maxRetries: 2,
    };
    function operationBinding(state: CoordinationWindowsBoundState, operation: string, payload: unknown) {
      void payload;
      return {
        policyVersionId: state.policyVersionId,
        sessionId: state.sessionId,
        attemptId: state.attemptId,
        enrolledHostId: state.enrolledHostId,
        transportLeaseId: state.leaseId,
        leaseEpoch: state.leaseEpoch,
        holderInstanceId: state.holderInstanceId,
        operation,
        // The coordinator reconstructs this authority payload from the
        // authenticated request and locked lease. Keep it operation-specific
        // while excluding mutable offer/result bytes from the binding itself.
        operationDigest: digest({
          policyVersionId: state.policyVersionId,
          sessionId: state.sessionId,
          attemptId: state.attemptId,
          operation,
        }),
      };
    }
    const prepare = async (input: CoordinationWindowsPreparationInput) => {
      const dependencies = {
        storage: {
          inspect: async (path: string) => {
            return inspectWindowsPath(path);
          },
          mkdir: (path: string) => mkdir(path, { recursive: true }),
          write: (path: string, bytes: Uint8Array) => writeFile(path, bytes),
          read: async (path: string) => new Uint8Array(await readFile(path)),
          atomicReplace: (from: string, to: string) => rename(from, to),
          rename: (from: string, to: string) => rename(from, to),
          remove: (path: string) => rm(path, { recursive: true, force: true }),
        },
        protect: async (plaintext: Uint8Array) => new Uint8Array(Buffer.from(await powershell(
          '$ErrorActionPreference="Stop";$b=[Convert]::FromBase64String(([Console]::In.ReadToEnd()).Trim());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))',
          Buffer.from(plaintext).toString('base64'),
        ), 'base64')),
        server: {
          promote: async (value: unknown) => post('/api/coordination/v2/host/preparation/promote', value, material.accessToken, false, await sign(material.accessToken)),
          acknowledge: async (value: unknown) => {
            const result = await post('/api/coordination/v2/host/preparation/acknowledge', value, material.accessToken, false, await sign(material.accessToken));
            if (typeof result.sessionId === 'string') acknowledgedSessionId = result.sessionId;
            if (result.state && typeof result.state === 'object' && !Array.isArray(result.state)) {
              lifecycleOpaque = { ...lifecycleOpaque, ...(result.state as Record<string, unknown>) };
            }
            return result;
          },
          recover: async (value: unknown) => post('/api/coordination/v2/host/preparation/recover', value, material.accessToken, false, await sign(material.accessToken)),
        },
      } as CoordinationWindowsPreparationInput['dependencies'];
      return prepareCoordinationWindowsGeneration({ ...input, dependencies });
    };
    void input;
    return {
      transport: transport as unknown as CoordinationWindowsHostDependencies['transport'],
      preflight: () => concretePreflight(material, root, request),
      prepare,
      executionJournal: fileJournal(root),
      operationAdapter: concreteAdapter(root),
      reconcileExecution: fileJournal(root).reconcile,
    };
  };
}
export const createCoordinationV2AuthenticatedHttpTransport = createCoordinationV2HttpDependencyFactory;