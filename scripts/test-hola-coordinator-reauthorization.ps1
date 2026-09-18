$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot 'hola-coordinator.ps1')

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
        $crashedAfterTerminal = ([string]$_.Exception.Message -eq 'test_crash_after_terminal_persist')
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
    if ($null -ne $testRoot -and [IO.Directory]::Exists($testRoot)) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
    $rsa.Dispose()
}