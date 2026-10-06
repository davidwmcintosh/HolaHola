[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][switch]$PublicationGatesVerified,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ExpectedSourceCommit,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f-]{36}$')][string]$PublishedRuntimeReleaseId
)

# These receipts/switches are NOT publication authority. The founder's fresh
# exact-source AND runtime gates must be independently verified before invoking
# this fixture. Enforce the explicit stop before loading the changed launcher.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
if (-not $PublicationGatesVerified -or $env:OS -ne 'Windows_NT' -or
    $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) {
    throw 'Native disposable Windows PowerShell 5.1 and verified publication gates required'
}
$checkout = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$head = (& git.exe -C $checkout rev-parse HEAD 2>$null)
if ($LASTEXITCODE -ne 0 -or $head -cne $ExpectedSourceCommit) { throw 'Published source mismatch' }
$dirty = (& git.exe -C $checkout status --porcelain 2>$null)
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Published checkout must be clean' }

. (Join-Path $PSScriptRoot 'hola-coordinator.ps1')

function Assert-RecoveryFixture {
    param([bool]$Condition, [string]$Name)
    if (-not $Condition) { throw ('Synthetic recovery fixture failed: ' + $Name) }
}
function Expect-RecoveryFailure {
    param([scriptblock]$Action, [string]$Code)
    try { & $Action | Out-Null } catch {
        Assert-RecoveryFixture ($_.Exception.Message -eq ('hola_coordinator_' + $Code)) $Code
        return
    }
    throw ('Synthetic fixture unexpectedly accepted: ' + $Code)
}
function New-RecoveryEnvelope {
    param([string]$Key, [switch]$Fresh)
    $now = [DateTime]::UtcNow
    $issued = if ($Fresh) { $now.AddSeconds(-5) } else { $now.AddMinutes(-6) }
    $payload = [ordered]@{
        protocolVersion = 1; kind = 'runtime_bootstrap_manifest'
        issueId = [Guid]::NewGuid().ToString(); requestKeyDigest = Get-RuntimeRecoveryDigest -Value $Key
        hostEnrollmentId = [Guid]::NewGuid().ToString(); hostKeyFingerprint = $identity.fingerprint
        runtimeReleaseId = [Guid]::NewGuid().ToString(); runtimeReleaseDigest = ('b' * 64)
        sourcePromotionId = [Guid]::NewGuid().ToString(); repositoryIdentity = ('synthetic/caf' + [char]0x00e9)
        promotedCommitSha = ('a' * 40); exactTreeSha = ('b' * 40)
        publicationReference = 'synthetic-publication'; protectedValidationId = 'synthetic-validation'
        sourcePromotionRecordDigest = ('c' * 64); nonce = ('d' * 64)
        issuedAt = $issued.ToString('o'); expiresAt = $issued.AddMinutes(5).ToString('o')
        artifacts = @(
            [ordered]@{ artifactId = [Guid]::NewGuid().ToString(); role = 'node_executable'
                fixedDestination = 'runtime/node.exe'; objectDigest = ('e' * 64); byteLength = 4
                mediaType = 'application/vnd.microsoft.portable-executable'; requiresAuthenticode = $true },
            [ordered]@{ artifactId = [Guid]::NewGuid().ToString(); role = 'tsx_runtime_module'
                fixedDestination = 'node_modules/tsx/index.mjs'; objectDigest = ('f' * 64); byteLength = 4
                mediaType = 'text/javascript'; requiresAuthenticode = $false }
        )
        sourceMembers = @($ApprovedSourceMemberPaths | ForEach-Object {
            [ordered]@{ fixedPath = $_; sha256 = ('a' * 64) }
        })
    }
    $der = [Convert]::FromBase64String(($PinnedServerPublicKeyPem -replace
        '-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s', ''))
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $fp = ($hash.ComputeHash($der) | ForEach-Object { $_.ToString('x2') }) -join '' }
    finally { $hash.Dispose() }
    # Intentionally invalid but well-formed signature: evidence is NOT trusted.
    return ([ordered]@{ payload = $payload; canonicalResponseDigest = Get-RuntimeRecoveryDigest -Value $payload
        signature = [Convert]::ToBase64String((New-Object byte[] 64)); keyFingerprint = $fp } |
        ConvertTo-Json -Depth 30 -Compress | ConvertFrom-Json)
}
function New-RecoveryState {
    return ([ordered]@{ endpoint = 'https://runtime-fixture.invalid'
        requestKey = [Guid]::NewGuid().ToString(); issueId = ''; manifest = $null
        installed = $false; ackPayload = $null; ackSignature = '' } |
        ConvertTo-Json -Compress | ConvertFrom-Json)
}

# All custody roots are generated and isolated BEFORE any helper is invoked.
# No enrolled host credential, key, endpoint, DPAPI file, or issue is read.
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('hola-runtime-fixture-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot -ErrorAction Stop | Out-Null
$ApprovedWorktree = Join-Path $fixtureRoot 'worktree'
$RuntimeBootstrapRoot = Join-Path $fixtureRoot 'dpapi'
New-Item -ItemType Directory -Path $ApprovedWorktree, $RuntimeBootstrapRoot | Out-Null
$RuntimeRequestPath = Join-Path $RuntimeBootstrapRoot 'runtime-bootstrap-request.dpapi'
$RuntimeAckPath = Join-Path $RuntimeBootstrapRoot 'runtime-bootstrap-ack.dpapi'
$RuntimeManifest = Join-Path $ApprovedWorktree '.coordination-v2-runtime-manifest.json'
$PinnedServerPublicKey = Join-Path $ApprovedWorktree 'synthetic-pinned.pem'
[IO.File]::WriteAllText($PinnedServerPublicKey, $PinnedServerPublicKeyPem)
$rsa = New-Object Security.Cryptography.RSACryptoServiceProvider -ArgumentList 2048
$identity = [ordered]@{ fingerprint = Get-RsaFingerprint -Rsa $rsa }
try {
    Assert-PrivatePath -Path $fixtureRoot -Root $fixtureRoot
    Assert-PrivatePath -Path $RuntimeBootstrapRoot -Root $fixtureRoot
    # Sentinels are generated synthetic DPAPI values, never live materials.
    foreach ($name in @('host-material.dpapi', 'host-private-key.dpapi', 'runtime-bootstrap-ack.dpapi')) {
        Write-RuntimeRecoveryDpapi -Path (Join-Path $RuntimeBootstrapRoot $name) `
            -Value ([ordered]@{ marker = 'synthetic-' + [Guid]::NewGuid().ToString() })
    }
    $sentinels = @{}
    foreach ($name in @('host-material.dpapi', 'host-private-key.dpapi', 'runtime-bootstrap-ack.dpapi')) {
        $sentinels[$name] = [IO.File]::ReadAllText((Join-Path $RuntimeBootstrapRoot $name))
    }
    $state = New-RecoveryState
    $envelope = New-RecoveryEnvelope -Key $state.requestKey
    Write-RuntimeRecoveryDpapi -Path $RuntimeRequestPath -Value $state
    # Before journal commit, abandoned partial temporary files grant no authority.
    $orphan = (Get-RuntimeRecoveryRecordPath -RequestKey $state.requestKey) + '.synthetic.tmp'
    [IO.File]::WriteAllText($orphan, 'incomplete synthetic ciphertext')
    $before = Resume-RuntimeRecovery -State $state -Endpoint $state.endpoint -Identity $identity
    Assert-RecoveryFixture (-not $before.rotated -and $before.state.requestKey -ceq $state.requestKey) 'before-journal'
    $stage = Join-Path $ApprovedWorktree ('.runtime-bootstrap-staging-' + $envelope.payload.issueId)
    New-Item -ItemType Directory -Path $stage | Out-Null
    $journal = Save-RuntimeExpiredEvidence -State $state -Envelope $envelope -Identity $identity
    Assert-RecoveryFixture ((Get-RuntimeRecoveryDigest -Value $journal.originalEnvelope) -ceq
        (Get-RuntimeRecoveryDigest -Value $envelope)) 'canonical-DPAPI-roundtrip'
    Assert-RecoveryFixture ($journal.originalEnvelope.signature -ceq $envelope.signature) 'unverified-signature-retained'
    $again = Save-RuntimeExpiredEvidence -State $state -Envelope $envelope -Identity $identity
    Assert-RecoveryFixture ($again.successorRequestKey -ceq $journal.successorRequestKey) 'create-once'
    # Journal committed, active still old: restart completes the exact transition.
    $resumed = Resume-RuntimeRecovery -State $state -Endpoint $state.endpoint -Identity $identity
    Assert-RecoveryFixture ($resumed.rotated -and $resumed.state.requestKey -ceq $journal.successorRequestKey) 'journal-before-active'
    Assert-RecoveryFixture (-not [IO.Directory]::Exists($stage)) 'old-stage-only-cleanup'
    $active = Read-DpapiJson -Path $RuntimeRequestPath -FailureCode 'fixture_read'
    $replayed = Resume-RuntimeRecovery -State $active -Endpoint $state.endpoint -Identity $identity
    Assert-RecoveryFixture (-not $replayed.rotated -and $replayed.state.requestKey -ceq $journal.successorRequestKey) 'active-before-POST-and-lost-response'
    # Second expiry checkpoint never creates a successor; later invocation may.
    $second = New-RecoveryEnvelope -Key $active.requestKey
    $observation = Save-RuntimeExpiredEvidence -State $active -Envelope $second -Identity $identity -ObserveOnly
    Assert-RecoveryFixture ($observation.successorRequestKey -ceq '') 'second-expiry-observation'
    Assert-RecoveryFixture (-not [IO.File]::Exists((Get-RuntimeRecoveryRecordPath -RequestKey $active.requestKey))) 'no-second-successor'
    $later = Save-RuntimeExpiredEvidence -State $active -Envelope $second -Identity $identity
    Assert-RecoveryFixture ($later.oldRequestKey -ceq $active.requestKey) 'later-invocation-retirement'
    $freshState = New-RecoveryState
    $fresh = New-RecoveryEnvelope -Key $freshState.requestKey -Fresh
    Assert-RecoveryFixture (-not (Assert-RuntimeRecoveryEvidence -Envelope $fresh `
        -RequestKey $freshState.requestKey -Identity $identity)) 'fresh-no-rotation'
    Expect-RecoveryFailure { Save-RuntimeExpiredEvidence -State $freshState -Envelope $fresh -Identity $identity } 'runtime_recovery_not_expired'
    Expect-RecoveryFailure { Assert-RuntimeRecoveryEvidence -Envelope $envelope `
        -RequestKey ([Guid]::NewGuid().ToString()) -Identity $identity } 'runtime_recovery_binding_invalid'
    Expect-RecoveryFailure { Assert-RuntimeRecoveryEvidence -Envelope $envelope `
        -RequestKey $state.requestKey -Identity ([ordered]@{ fingerprint = ('0' * 64) }) } 'runtime_recovery_binding_invalid'
    $bad = ($envelope | ConvertTo-Json -Depth 30 -Compress | ConvertFrom-Json)
    $bad.canonicalResponseDigest = ('0' * 64)
    Expect-RecoveryFailure { Assert-RuntimeRecoveryEvidence -Envelope $bad -RequestKey $state.requestKey -Identity $identity } 'runtime_recovery_digest_invalid'
    $bad = ($envelope | ConvertTo-Json -Depth 30 -Compress | ConvertFrom-Json)
    $bad.signature = 'invalid'
    Expect-RecoveryFailure { Assert-RuntimeRecoveryEvidence -Envelope $bad -RequestKey $state.requestKey -Identity $identity } 'runtime_recovery_signature_shape'
    $bad = ($envelope | ConvertTo-Json -Depth 30 -Compress | ConvertFrom-Json)
    $bad.payload.expiresAt = $bad.payload.issuedAt
    $bad.canonicalResponseDigest = Get-RuntimeRecoveryDigest -Value $bad.payload
    Expect-RecoveryFailure { Assert-RuntimeRecoveryEvidence -Envelope $bad -RequestKey $state.requestKey -Identity $identity } 'runtime_manifest_expired'
    $installed = New-RecoveryState
    $installed.installed = $true
    $installedReply = New-RecoveryEnvelope -Key $installed.requestKey
    Expect-RecoveryFailure { Save-RuntimeExpiredEvidence -State $installed -Envelope $installedReply -Identity $identity } 'runtime_recovery_baseline_invalid'
    foreach ($name in $sentinels.Keys) {
        Assert-RecoveryFixture ([IO.File]::ReadAllText((Join-Path $RuntimeBootstrapRoot $name)) -ceq $sentinels[$name]) 'credential-and-ack-preservation'
    }
    Write-Output 'Synthetic native recovery helper fixtures passed; full initializer/signature/installed-generation matrix remains a separate native release proof.'
} finally {
    $rsa.Dispose()
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction Stop
}
