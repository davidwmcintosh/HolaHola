$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot 'hola-coordinator.ps1')
& (Join-Path $PSScriptRoot 'test-hola-coordinator-recovery-diagnostics.ps1')

function Assert-Test {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if (-not $Condition) { throw $Message }
}

$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider 2048
$originalRuntimeBootstrapRoot = $RuntimeBootstrapRoot
$originalDeclarationHelper = (Get-Item Function:\New-InternalHolaCoordinatorReauthorizationDeclaration).ScriptBlock
$existingInvokeRestFunction = Get-Item Function:\script:Invoke-RestMethod -ErrorAction SilentlyContinue
$testRoot = $null
try {
    $fingerprint = Get-RsaFingerprint -Rsa $rsa
    $parameters = $rsa.ExportParameters($false)
    $b64url = {
        param([byte[]]$Bytes)
        [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }
    $publicKey = [ordered]@{
        kty = 'RSA'
        n = & $b64url $parameters.Modulus
        e = & $b64url $parameters.Exponent
    } | ConvertTo-Json -Compress
    $issuedAt = [DateTime]::SpecifyKind(
        [DateTime]::Parse('2026-09-17T12:00:00.0000000'),
        [DateTimeKind]::Utc)

    $fresh = New-InternalHolaCoordinatorReauthorizationDeclaration `
        -RequestKey '11111111-1111-4111-8111-111111111111' `
        -HostId 'WINDOWS-TEST' -Fingerprint $fingerprint -Generation 2 -Now $issuedAt
    $freshIssuedAt = [DateTime]::Parse([string]$fresh.issuedAt).ToUniversalTime()
    $freshExpiresAt = [DateTime]::Parse([string]$fresh.expiresAt).ToUniversalTime()
    Assert-Test (($freshExpiresAt - $freshIssuedAt).TotalMilliseconds -eq 3600000) `
        'Fresh declaration lifetime was not exactly one hour'

    function New-LegacyState {
        param(
            [Parameter(Mandatory = $true)][double]$LifetimeMs,
            [string]$RequestId = '',
            [string]$RequestKey = '22222222-2222-4222-8222-222222222222',
            [string]$HostId = 'WINDOWS-TEST',
            [string]$Endpoint = 'https://example.invalid',
            [int]$Generation = 1,
            [switch]$CorruptSignature
        )
        $declaration = [ordered]@{
            kind = 'host_credential_reauthorization'
            requestKey = $requestKey
            issuedAt = $issuedAt.ToString('o')
            expiresAt = $issuedAt.AddMilliseconds($LifetimeMs).ToString('o')
            protocolVersion = 1
            hostId = $HostId
            keyFingerprint = $fingerprint
            requestGeneration = $Generation
        }
        $canonical = ConvertTo-CanonicalJson -Value $declaration
        $signature = $rsa.SignData(
            [Text.Encoding]::UTF8.GetBytes($canonical),
            [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
        if ($CorruptSignature) { $signature[0] = $signature[0] -bxor 1 }
        $body = [ordered]@{
            declaration = $declaration
            publicKey = $publicKey
            keyFingerprint = $fingerprint
            signature = [Convert]::ToBase64String($signature)
        } | ConvertTo-Json -Depth 8 -Compress
        return [ordered]@{
            endpoint = $Endpoint
            requestKey = $requestKey
            requestId = $RequestId
            generation = $Generation
            hostId = $HostId
            fingerprint = $fingerprint
            declaration = $declaration
            body = $body
            terminal = $false
            completionAmbiguous = $false
        }
    }

    $expiredNow = $issuedAt.AddHours(2)
    $legacy = New-LegacyState -LifetimeMs 3600001
    Assert-Test (Test-InternalHolaCoordinatorLegacyTwoClockRequest `
        -State $legacy -Rsa $rsa -HostId 'WINDOWS-TEST' `
        -Fingerprint $fingerprint -Now $expiredNow) `
        'Exact expired two-clock request was not recognized'

    $acceptedRequest = New-LegacyState -LifetimeMs 3600001 `
        -RequestId '33333333-3333-4333-8333-333333333333'
    Assert-Test (-not (Test-InternalHolaCoordinatorLegacyTwoClockRequest `
        -State $acceptedRequest -Rsa $rsa -HostId 'WINDOWS-TEST' `
        -Fingerprint $fingerprint -Now $expiredNow)) `
        'A request with a server request ID was eligible for local retirement'

    Assert-Test (-not (Test-InternalHolaCoordinatorLegacyTwoClockRequest `
        -State $legacy -Rsa $rsa -HostId 'WINDOWS-TEST' `
        -Fingerprint $fingerprint -Now $issuedAt.AddMinutes(30))) `
        'An unexpired malformed request was eligible for local retirement'

    $validLifetime = New-LegacyState -LifetimeMs 3600000
    Assert-Test (-not (Test-InternalHolaCoordinatorLegacyTwoClockRequest `
        -State $validLifetime -Rsa $rsa -HostId 'WINDOWS-TEST' `
        -Fingerprint $fingerprint -Now $expiredNow)) `
        'A valid one-hour request was eligible for legacy retirement'

    $outsideAllowlist = New-LegacyState -LifetimeMs 3660001
    Assert-Test (-not (Test-InternalHolaCoordinatorLegacyTwoClockRequest `
        -State $outsideAllowlist -Rsa $rsa -HostId 'WINDOWS-TEST' `
        -Fingerprint $fingerprint -Now $expiredNow)) `
        'A request outside the narrow two-clock window was eligible for retirement'

    $badSignature = New-LegacyState -LifetimeMs 3600001 -CorruptSignature
    Assert-Test (-not (Test-InternalHolaCoordinatorLegacyTwoClockRequest `
        -State $badSignature -Rsa $rsa -HostId 'WINDOWS-TEST' `
        -Fingerprint $fingerprint -Now $expiredNow)) `
        'A request with an invalid signature was eligible for retirement'

    # Execute the real restore lifecycle against isolated DPAPI files. Force a
    # crash after terminal persistence, then resume and capture the exact body
    # at the HTTP command boundary.
    $testRoot = Join-Path (Join-Path $env:LOCALAPPDATA 'HolaHola') (
        'CoordinatorV2-reauthorization-test-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    $RuntimeBootstrapRoot = $testRoot
    $endpoint = 'https://example.invalid'
    $machineHostId = [Environment]::MachineName
    $legacyRequestKey = '44444444-4444-4444-8444-444444444444'
    $lifecycleState = New-LegacyState -LifetimeMs 3600001 `
        -RequestKey $legacyRequestKey -HostId $machineHostId -Endpoint $endpoint

    Write-DpapiJsonAtomic -Path (Join-Path $testRoot 'host-material.dpapi') -Value ([ordered]@{
        endpoint = $endpoint
        accessToken = 'v2h_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    })
    $privateCipher = [Security.Cryptography.ProtectedData]::Protect(
        [Text.Encoding]::UTF8.GetBytes($rsa.ToXmlString($true)),
        $null, $CurrentUserScope)
    Write-DpapiBase64Atomic -Path (Join-Path $testRoot 'host-private-key.dpapi') `
        -Bytes $privateCipher
    Write-DpapiJsonAtomic -Path (Join-Path $testRoot 'host-reauthorization-request.dpapi') `
        -Value $lifecycleState
    Set-Item Function:\script:Invoke-RestMethod -Value {
        [CmdletBinding()]
        param($Method, $Uri, $ContentType, $Body, [switch]$UseBasicParsing, $MaximumRedirection, $Headers)
        if ([string]$Uri -notlike '*/host/recovery-context') { throw 'test_unexpected_network' }
        $query = ([string]$Body | ConvertFrom-Json).declaration
        return [pscustomobject]@{
            contextKey = [string]$query.contextKey; nextGeneration = 2
            issuedAt = [string]$query.issuedAt; expiresAt = [string]$query.expiresAt
        }
    }

    Set-Item Function:\New-InternalHolaCoordinatorReauthorizationDeclaration -Value {
        param(
            [string]$RequestKey, [string]$HostId, [string]$Fingerprint,
            [int]$Generation, [DateTime]$Now
        )
        throw 'test_crash_after_terminal_persist'
    }
    $crashedAfterTerminal = $false
    try {
        Restore-HolaCoordinatorHostCredential -Endpoint $endpoint | Out-Null
    } catch {
        $crashedAfterTerminal = ([string]$_.Exception.Message -match '^hola_coordinator_host_recovery_failed ::')
    }
    Assert-Test $crashedAfterTerminal 'Restore did not reach the post-terminal crash point'
    $terminalState = Read-DpapiJson `
        -Path (Join-Path $testRoot 'host-reauthorization-request.dpapi') `
        -FailureCode 'test_terminal_state_corrupted'
    Assert-Test ([bool]$terminalState.terminal) 'Malformed generation was not persisted terminal before rollover'
    Assert-Test ([int]$terminalState.generation -eq 1) 'Crash changed the malformed generation'
    Assert-Test ([string]$terminalState.requestKey -ceq $legacyRequestKey) `
        'Crash changed the malformed request key'
    Assert-Test ([string]::IsNullOrWhiteSpace([string]$terminalState.requestId)) `
        'Crash introduced a server request ID'

    Set-Item Function:\New-InternalHolaCoordinatorReauthorizationDeclaration `
        -Value $originalDeclarationHelper
    $global:ReauthorizationTestBody = $null
    Set-Item Function:\script:Invoke-RestMethod -Value {
        [CmdletBinding()]
        param(
            $Method, $Uri, $ContentType, $Body,
            [switch]$UseBasicParsing,
            $MaximumRedirection, $Headers
        )
        if ([string]$Uri -like '*/host/recovery-context') {
            $global:ReauthorizationTestContextBody = [string]$Body
            $query = ([string]$Body | ConvertFrom-Json).declaration
            return [pscustomobject]@{
                contextKey = [string]$query.contextKey; nextGeneration = 2
                issuedAt = [string]$query.issuedAt; expiresAt = [string]$query.expiresAt
            }
        }
        $global:ReauthorizationTestBody = [string]$Body
        return [pscustomobject]@{
            requestId = '55555555-5555-4555-8555-555555555555'
            status = 'pending'
            approvalUrl = '/coordination/v2/host-reauthorization-approval?requestId=55555555-5555-4555-8555-555555555555'
        }
    }
    $mockCommand = Get-Command Invoke-RestMethod -CommandType Function -ErrorAction Stop
    Assert-Test ([string]$mockCommand.Name -ceq 'Invoke-RestMethod') `
        'Script-scoped Invoke-RestMethod mock was not selected'
    Invoke-RestMethod -Method Post -Uri ($endpoint + '/test-binding') `
        -ContentType 'application/json' -Body '{}' -UseBasicParsing `
        -MaximumRedirection 0 -ErrorAction Stop | Out-Null
    Assert-Test ([string]$global:ReauthorizationTestBody -ceq '{}') `
        'PowerShell 5.1 production-shaped mock binding did not capture the body'
    $global:ReauthorizationTestBody = $null
    $result = Restore-HolaCoordinatorHostCredential -Endpoint $endpoint
    Assert-Test ([int]$result.generation -eq 2) 'Restore did not advance to generation 2'
    Assert-Test ([string]$result.status -ceq 'pending') 'Restore did not return pending'
    Assert-Test ([string]$result.approvalUrl -ceq (
        'https://example.invalid/coordination/v2/host-reauthorization-approval?' +
        'requestId=55555555-5555-4555-8555-555555555555')) `
        'Restore did not present the exact absolute founder approval URL'
    Assert-Test (-not [string]::IsNullOrWhiteSpace([string]$global:ReauthorizationTestBody)) `
        'Restore did not submit a request body'

    $resumedState = Read-DpapiJson `
        -Path (Join-Path $testRoot 'host-reauthorization-request.dpapi') `
        -FailureCode 'test_resumed_state_corrupted'
    Assert-Test ([int]$resumedState.generation -eq 2) 'Persisted state did not advance to generation 2'
    Assert-Test (-not [bool]$resumedState.terminal) 'Fresh generation remained terminal'
    Assert-Test ([string]$resumedState.requestKey -cne $legacyRequestKey) `
        'Fresh generation reused the malformed request key'
    Assert-Test ([string]$resumedState.requestId -ceq '55555555-5555-4555-8555-555555555555') `
        'Fresh generation did not persist the server request ID'
    Assert-Test ([string]$resumedState.body -ceq [string]$global:ReauthorizationTestBody) `
        'Persisted generation differs from the submitted bytes'

    $payloadPath = Join-Path $testRoot 'synthetic-wire-payload.json'
    [IO.File]::WriteAllText(
        $payloadPath,
        [string]$global:ReauthorizationTestBody,
        (New-Object Text.UTF8Encoding($false)))
    & node (Join-Path $PSScriptRoot 'verify-hola-coordinator-reauthorization-payload.mjs') `
        $payloadPath
    Assert-Test ($LASTEXITCODE -eq 0) 'Node rejected the PowerShell wire payload'
    Remove-Item -LiteralPath $payloadPath -Force

    [IO.File]::WriteAllText($payloadPath, [string]$global:ReauthorizationTestContextBody,
        (New-Object Text.UTF8Encoding($false)))
    & node (Join-Path $PSScriptRoot 'verify-hola-coordinator-reauthorization-payload.mjs') $payloadPath
    Assert-Test ($LASTEXITCODE -eq 0) 'Node rejected the PowerShell recovery-context proof'
    Remove-Item -LiteralPath $payloadPath -Force

    # Material validation is exercised without opening real credentials or any
    # policy/trust changes. All following files remain inside this disposable root.
    $expiredMaterial = [pscustomobject][ordered]@{
        endpoint = $endpoint; accessToken = 'v2h_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        expiresAt = [DateTime]::UtcNow.AddDays(-1).ToString('o')
    }
    Assert-InternalHolaCoordinatorRecoveryMaterial -Material $expiredMaterial
    foreach ($badExpiry in @('not-a-date', '2026-01-01', 123)) {
        $badMaterial = [pscustomobject][ordered]@{
            endpoint = $endpoint; accessToken = $expiredMaterial.accessToken; expiresAt = $badExpiry
        }
        $denied = $false
        try { Assert-InternalHolaCoordinatorRecoveryMaterial -Material $badMaterial }
        catch { $denied = ([string]$_.Exception.Message -match 'host_credential_expiry_invalid') }
        Assert-Test $denied 'Malformed expiry was accepted'
    }
    $futureMaterial = [pscustomobject][ordered]@{
        endpoint = $endpoint; accessToken = $expiredMaterial.accessToken
        expiresAt = [DateTime]::UtcNow.AddDays(1).ToString('o')
    }
    $denied = $false
    try { Assert-InternalHolaCoordinatorRecoveryMaterial -Material $futureMaterial }
    catch { $denied = ([string]$_.Exception.Message -match 'host_credential_reauthorization_not_required') }
    Assert-Test $denied 'Unexpired replacement credential was accepted for recovery'

    $requestPath = Join-Path $testRoot 'host-reauthorization-request.dpapi'
    $materialPath = Join-Path $testRoot 'host-material.dpapi'
    $privatePath = Join-Path $testRoot 'host-private-key.dpapi'
    Remove-Item -LiteralPath $requestPath -Force
    Write-DpapiJsonAtomic -Path $materialPath -Value $expiredMaterial
    $materialBefore = [IO.File]::ReadAllText($materialPath)
    $privateBefore = [IO.File]::ReadAllText($privatePath)
    $global:RecoveryContextCalls = 0
    $global:RecoverySubmitCalls = 0
    $global:RecoverySubmittedBody = ''
    $global:RecoveryBadContext = ''
    Set-Item Function:\script:Invoke-RestMethod -Value {
        [CmdletBinding()]
        param($Method, $Uri, $ContentType, $Body, [switch]$UseBasicParsing, $MaximumRedirection, $Headers)
        if ([string]$Uri -like '*/host/recovery-context') {
            $global:RecoveryContextCalls++
            $query = ([string]$Body | ConvertFrom-Json).declaration
            Assert-Test ([string]$Body -notmatch 'accessToken|v2h_') 'Expired token was sent as context authority'
            $reply = [pscustomobject]@{
                contextKey = [string]$query.contextKey; nextGeneration = 3
                issuedAt = [string]$query.issuedAt; expiresAt = [string]$query.expiresAt
            }
            if ($global:RecoveryBadContext -eq 'correlation') { $reply.contextKey = 'wrong-context' }
            if ($global:RecoveryBadContext -eq 'generation') { $reply.nextGeneration = '3' }
            if ($global:RecoveryBadContext -eq 'extra') { $reply | Add-Member NoteProperty accessToken 'not-authority' }
            return $reply
        }
        if ([string]$Uri -like '*/status') {
            return [pscustomobject]@{ requestId = '66666666-6666-4666-8666-666666666666'; status = 'pending' }
        }
        Assert-Test ([string]$Uri -like '*/host/reauthorization-requests') 'Unexpected recovery request route'
        $global:RecoverySubmitCalls++
        if ($global:RecoverySubmitCalls -eq 1) {
            $global:RecoverySubmittedBody = [string]$Body
            throw 'test_lost_submission_response'
        }
        Assert-Test ([string]$Body -ceq $global:RecoverySubmittedBody) 'Retry replaced the persisted signed bytes'
        return [pscustomobject]@{
            requestId = '66666666-6666-4666-8666-666666666666'; status = 'pending'
            approvalUrl = '/coordination/v2/host-reauthorization-approval?requestId=66666666-6666-4666-8666-666666666666'
        }
    }
    foreach ($badContext in @('correlation', 'generation', 'extra')) {
        $global:RecoveryBadContext = $badContext
        $denied = $false
        try { Restore-HolaCoordinatorHostCredential -Endpoint $endpoint | Out-Null }
        catch { $denied = ([string]$_.Exception.Message -match 'host_recovery_context_(shape|mismatch)') }
        Assert-Test $denied 'Invalid recovery context was accepted'
        Assert-Test (-not [IO.File]::Exists($requestPath)) 'Invalid context wrote request state'
        Assert-Test ($global:RecoverySubmitCalls -eq 0) 'Invalid context submitted a request'
    }
    $global:RecoveryBadContext = ''
    $global:RecoveryContextCalls = 0
    $lost = $false
    try { Restore-HolaCoordinatorHostCredential -Endpoint $endpoint | Out-Null }
    catch { $lost = ([string]$_.Exception.Message -match 'host_reauthorization_transport') }
    Assert-Test $lost 'Lost response was not bounded as a transport failure'
    $persisted = Read-DpapiJson -Path $requestPath -FailureCode 'test_missing_persisted_request'
    Assert-Test ([int]$persisted.generation -eq 3) 'Missing local state restarted at generation 1'
    Assert-Test ([string]$persisted.body -ceq $global:RecoverySubmittedBody) 'Submit happened before exact persistence'
    $resumed = Restore-HolaCoordinatorHostCredential -Endpoint $endpoint
    Assert-Test ([int]$resumed.generation -eq 3) 'Retry changed the generation'
    Assert-Test ($global:RecoveryContextCalls -eq 1) 'Retry looked up a new generation'
    $pending = Restore-HolaCoordinatorHostCredential -Endpoint $endpoint
    Assert-Test ([string]$pending.status -ceq 'pending') 'Pending request was not resumed'
    Assert-Test ($global:RecoverySubmitCalls -eq 2) 'Pending request was submitted again'
    Assert-Test ([IO.File]::ReadAllText($materialPath) -ceq $materialBefore) 'Recovery changed credential before founder approval'
    Assert-Test ([IO.File]::ReadAllText($privatePath) -ceq $privateBefore) 'Recovery changed the enrolled private key'

    # Only an approved challenge can reach proof/store. The HTTP fixture checks
    # the real PowerShell signature and the ambiguity marker before returning a
    # synthetic replacement; it never touches a live host or founder session.
    $approvedAt = [DateTime]::UtcNow
    $global:RecoveryApprovedChallenge = [pscustomobject]@{
        challengeId = '77777777-7777-4777-8777-777777777777'
        nonce = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
        issuedAt = $approvedAt.ToString('o'); expiresAt = $approvedAt.AddMinutes(2).ToString('o')
        requestId = [string]$persisted.requestId; requestKey = [string]$persisted.requestKey
        hostEnrollmentId = '88888888-8888-4888-8888-888888888888'
        keyFingerprint = $fingerprint; protocolVersion = 1; requestGeneration = 3
    }
    # Reload the ID persisted after the lost-response retry.
    $persisted = Read-DpapiJson -Path $requestPath -FailureCode 'test_request_corrupted'
    $global:RecoveryApprovedChallenge.requestId = [string]$persisted.requestId
    Set-Item Function:\script:Invoke-RestMethod -Value {
        [CmdletBinding()]
        param($Method, $Uri, $ContentType, $Body, [switch]$UseBasicParsing, $MaximumRedirection, $Headers)
        $challenge = $global:RecoveryApprovedChallenge
        if ([string]$Uri -like '*/status') {
            return [pscustomobject]@{ status = 'approved'; requestId = $challenge.requestId
                requestKey = $challenge.requestKey; challenge = $challenge }
        }
        Assert-Test ([string]$Uri -like '*/proof') 'Unapproved fixture path reached credential store'
        $proof = [string]$Body | ConvertFrom-Json
        $proofState = Read-DpapiJson -Path (Join-Path $RuntimeBootstrapRoot 'host-reauthorization-request.dpapi') `
            -FailureCode 'test_proof_state_corrupted'
        Assert-Test ([bool]$proofState.completionAmbiguous) 'Proof was sent before ambiguity persistence'
        $signed = [ordered]@{ kind = 'host_credential_reauthorization_challenge' }
        foreach ($property in $challenge.PSObject.Properties) { $signed[$property.Name] = $property.Value }
        Assert-Test ($rsa.VerifyData([Text.Encoding]::UTF8.GetBytes((ConvertTo-CanonicalJson -Value $signed)),
            [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'),
            [Convert]::FromBase64String([string]$proof.signature))) 'Enrolled key did not sign the exact approved challenge'
        return [pscustomobject]@{ accessToken = 'v2h_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
            expiresAt = [DateTime]::UtcNow.AddDays(1).ToString('o') }
    }
    $completed = Restore-HolaCoordinatorHostCredential -Endpoint $endpoint
    Assert-Test ([string]$completed.status -ceq 'completed') 'Approved recovery did not complete'
    Assert-Test (-not [IO.File]::Exists($requestPath)) 'Completed request state was not cleared'
    Assert-Test ([IO.File]::ReadAllText($privatePath) -ceq $privateBefore) 'Completed recovery changed the enrolled key'
    $stored = Read-DpapiJson -Path $materialPath -FailureCode 'test_replacement_missing'
    Assert-ExactPropertySet -Value $stored -Names @('endpoint', 'accessToken', 'expiresAt') `
        -FailureCode 'test_replacement_shape'
    $denied = $false
    try { Restore-HolaCoordinatorHostCredential -Endpoint $endpoint | Out-Null }
    catch { $denied = ([string]$_.Exception.Message -match 'host_credential_reauthorization_not_required') }
    Assert-Test $denied 'Successful recovery allowed immediate replacement of a valid credential'

    Write-Host '[coordinator-v2] Windows reauthorization lifecycle checks passed'
} finally {
    Set-Item Function:\New-InternalHolaCoordinatorReauthorizationDeclaration `
        -Value $originalDeclarationHelper
    if ($null -ne $existingInvokeRestFunction) {
        Set-Item Function:\script:Invoke-RestMethod -Value $existingInvokeRestFunction.ScriptBlock
    } else {
        Remove-Item Function:\script:Invoke-RestMethod -ErrorAction SilentlyContinue
    }
    $RuntimeBootstrapRoot = $originalRuntimeBootstrapRoot
    $global:ReauthorizationTestBody = $null
    $global:ReauthorizationTestContextBody = $null
    $global:RecoveryContextCalls = $null
    $global:RecoverySubmitCalls = $null
    $global:RecoverySubmittedBody = $null
    $global:RecoveryBadContext = $null
    $global:RecoveryApprovedChallenge = $null
    if ($null -ne $testRoot -and [IO.Directory]::Exists($testRoot)) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
    $rsa.Dispose()
}