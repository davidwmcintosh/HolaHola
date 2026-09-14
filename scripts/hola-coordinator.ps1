[CmdletBinding()]
param()

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$LauncherPath = $MyInvocation.MyCommand.Path
$LauncherRoot = Split-Path -Parent $LauncherPath
$ApprovedWorktree = [System.IO.Path]::GetFullPath((Join-Path $LauncherRoot '..'))
$ApprovedTsx = Join-Path $ApprovedWorktree 'node_modules\tsx\dist\cli.mjs'
$CoordinatorScript = Join-Path $ApprovedWorktree 'server\scripts\coordination-v2-cli.ts'
$CurrentUserScope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser

function Fail-Safe {
    param([Parameter(Mandatory = $true)][string]$Code)
    $safeCode = ($Code -replace '[^a-zA-Z0-9_-]', '_')
    $safeCode = $safeCode.Substring(0, [Math]::Min(80, $safeCode.Length))
    throw ('hola_coordinator_' + $safeCode)
}

function Resolve-ApprovedNode {
    $candidates = @(
        (Join-Path $ApprovedWorktree 'runtime\node.exe'),
        (Join-Path $ApprovedWorktree '.runtime\node.exe')
    )
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -ne $command -and $command.Source) {
        $candidates += $command.Source
    }
    foreach ($candidate in $candidates) {
        if ($candidate -and [System.IO.File]::Exists($candidate)) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }
    Fail-Safe 'approved_node_missing'
}

$ApprovedNode = Resolve-ApprovedNode

function Assert-NoReparse {
    param([Parameter(Mandatory = $true)][string]$Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        Fail-Safe 'reparse_point'
    }
}

function Assert-ReadablePrivateAcl {
    param([Parameter(Mandatory = $true)][string]$Path)
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    if ($null -eq $acl -or $acl.Access.Count -lt 1) { Fail-Safe 'acl_unavailable' }
}

function Assert-ApprovedRepository {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $git) { Fail-Safe 'git_missing' }
    $clean = (& $git.Source -C $ApprovedWorktree status --porcelain 2>$null)
    if ($LASTEXITCODE -ne 0 -or $clean) { Fail-Safe 'repository_dirty' }
    # Commit/tree/publication authority is supplied by the signed V2 preflight
    # envelope. This launcher deliberately does not trust a local SHA artifact.
}

function Assert-ApprovedSignatureAndDigest {
    param([Parameter(Mandatory = $true)][string]$Path)
    $signature = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
    if ($signature.Status -ne 'Valid') { Fail-Safe 'signature_invalid' }
    $digest = Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop
    if ($null -eq $digest.Hash -or $digest.Hash.Length -ne 64) { Fail-Safe 'digest_unavailable' }
}

function Write-DpapiBase64Atomic {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][byte[]]$Bytes)
    $encoded = [Convert]::ToBase64String($Bytes)
    $temporary = $Path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    [IO.File]::WriteAllText($temporary, $encoded, (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Test-SafeCliOutput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Output
    )

    # A native child is allowed through only when it produced exactly one
    # complete, known CLI status.  This accepts both the JSON and text forms
    # emitted by the CLI, while preventing arbitrary child stdout from being
    # mistaken for a safe diagnostic.
    if ($null -eq $Output -or $Output.Count -ne 1) { return $false }
    $line = [string]$Output[0]
    if ([string]::IsNullOrWhiteSpace($line)) { return $false }

    $safeStates = @(
        'preparing', 'ready', 'running', 'waiting_for_host', 'verifying',
        'succeeded', 'failed', 'exhausted', 'expired', 'revoked',
        'cleanup_pending', 'preflight_failed', 'host_unavailable',
        'invalid_request', 'host_child_unclassified_exit'
    )

    # Text is intentionally checked against the same closed state vocabulary.
    if ($safeStates -contains $line -or $line -eq 'succeeded (cleanup pending)') {
        return $true
    }

    try {
        $payload = $line | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return $false
    }
    if ($null -eq $payload -or $payload -is [System.Array]
        -or $payload -isnot [PSCustomObject]) { return $false }
    if ($payload.state -isnot [string] -or $safeStates -notcontains $payload.state) {
        return $false
    }
    if ($payload.cleanupAcknowledged -isnot [bool]) { return $false }
    $propertyNames = @($payload.PSObject.Properties | ForEach-Object { $_.Name })
    return $propertyNames.Count -eq 2 `
        -and $propertyNames -contains 'state' `
        -and $propertyNames -contains 'cleanupAcknowledged'
}

function Assert-Host {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { Fail-Safe 'windows_required' }
    if ($PSVersionTable.PSVersion.Major -lt 5 -or
        ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -lt 1)) {
        Fail-Safe 'powershell_5_1_required'
    }
    if (-not [System.IO.File]::Exists($ApprovedNode)) { Fail-Safe 'approved_node_missing' }
    if (-not [System.IO.File]::Exists($ApprovedTsx)) { Fail-Safe 'approved_tsx_missing' }
    if (-not [System.IO.File]::Exists($CoordinatorScript)) { Fail-Safe 'coordinator_script_missing' }
    if (-not [System.IO.Directory]::Exists($ApprovedWorktree)) { Fail-Safe 'approved_worktree_missing' }
    if ($null -eq ('System.Security.Cryptography.ProtectedData' -as [type])) {
        Fail-Safe 'dpapi_current_user_unavailable'
    }
    if ($null -eq $CurrentUserScope -or $CurrentUserScope.ToString() -ne 'CurrentUser') {
        Fail-Safe 'dpapi_scope'
    }
    Assert-NoReparse -Path $ApprovedWorktree
    Assert-NoReparse -Path $ApprovedNode
    Assert-NoReparse -Path $ApprovedTsx
    Assert-NoReparse -Path $CoordinatorScript
    Assert-ReadablePrivateAcl -Path $ApprovedWorktree
    Assert-ReadablePrivateAcl -Path $ApprovedNode
    Assert-ReadablePrivateAcl -Path $ApprovedTsx
    Assert-ReadablePrivateAcl -Path $CoordinatorScript
    Assert-ApprovedRepository
    Assert-ApprovedSignatureAndDigest -Path $LauncherPath
    Assert-ApprovedSignatureAndDigest -Path $ApprovedNode
    Assert-ApprovedSignatureAndDigest -Path $ApprovedTsx
    Assert-ApprovedSignatureAndDigest -Path $CoordinatorScript
}

# BEGIN COORDINATION_INVOKE_BOUNDARY
function Invoke-HolaCoordinator {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [ValidatePattern('^[1-9][0-9]*$')]
        [string]$TaskRef,
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$Policy,
        [Parameter(Mandatory = $false)]
        [ValidateSet('text', 'json')]
        [string]$Format = 'text'
    )

    Assert-Host
    $arguments = @($ApprovedTsx, $CoordinatorScript, '--task-ref', $TaskRef, '--format', $Format)
    if ($PSBoundParameters.ContainsKey('Policy')) {
        $arguments += @('--policy', $Policy)
    }
    # Keep safe stdout from the CLI, but never surface a child native error
    # stream. Capture it so an unstructured nonzero child exit can be replaced
    # with a bounded, safe diagnostic.
    Push-Location $ApprovedWorktree
    try {
        $childOutput = @(& $ApprovedNode @arguments 2>$null)
        $observedChildExit = [int64]$LASTEXITCODE
    } finally {
        Pop-Location
    }
    $childExit = $observedChildExit
    if (-not (Test-SafeCliOutput -Output $childOutput)) {
        # Native Windows exit status is a bounded signed integer. Do not
        # coerce it in diagnostics: the exact observed status is retained.
        if ($observedChildExit -lt -2147483648 -or $observedChildExit -gt 2147483647) {
            Fail-Safe 'child_exit_out_of_range'
        }
        $childOutput = @(
            ([ordered]@{
                state = 'host_child_unclassified_exit'
                cleanupAcknowledged = $false
                executableRole = 'coordinator_cli'
                exitStatus = $observedChildExit
            } | ConvertTo-Json -Compress)
        )
        # A zero-exit child with missing or unstructured output did not satisfy
        # the coordinator contract. Preserve its observed zero above but make
        # the wrapper fail closed.
        if ($observedChildExit -eq 0) { $childExit = 70 }
    }
    foreach ($line in $childOutput) {
        [Console]::Out.WriteLine([string]$line)
    }
    # Preserve native status for callers without emitting it as a pipeline
    # value (which would contaminate the CLI's safe stdout contract).
    $global:LASTEXITCODE = $childExit
    [Environment]::ExitCode = $childExit
}
# END COORDINATION_INVOKE_BOUNDARY

# BEGIN COORDINATION_REGISTER_BOUNDARY
function Register-HolaCoordinatorHost {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][ValidatePattern('^https://')][string]$Endpoint,
        [Parameter(Mandatory = $true)][ValidatePattern('^https://')][string]$FounderApprovalUrl,
        [Parameter(Mandatory = $false)][string]$DisplayName = $env:COMPUTERNAME
    )
    Assert-Host
    $registrationRoot = Join-Path $env:LOCALAPPDATA 'HolaHola\CoordinatorV2'
    New-Item -ItemType Directory -Path $registrationRoot -Force | Out-Null
    $privatePath = Join-Path $registrationRoot 'host-private-key.dpapi'
    $requestPath = Join-Path $registrationRoot 'enrollment-request.dpapi'
    $materialPath = Join-Path $registrationRoot 'host-material.dpapi'
    $endpointBase = $Endpoint.TrimEnd('/')
    $rsa = $null
    try {
        $b64url = {
            param([byte[]]$Bytes)
            ([Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_'))
        }
        if (Test-Path -LiteralPath $requestPath) {
            $requestCipher = [Convert]::FromBase64String([IO.File]::ReadAllText($requestPath))
            $requestBytes = [Security.Cryptography.ProtectedData]::Unprotect(
                $requestCipher, $null, $CurrentUserScope)
            $requestState = [Text.Encoding]::UTF8.GetString($requestBytes) | ConvertFrom-Json
            if ([string]$requestState.endpoint -ne $endpointBase -or
                [string]::IsNullOrWhiteSpace([string]$requestState.privateXml) -or
                [string]::IsNullOrWhiteSpace([string]$requestState.body) -or
                [string]::IsNullOrWhiteSpace([string]$requestState.requestKey) -or
                [string]$requestState.fingerprint -notmatch '^[a-f0-9]{64}$') {
                Fail-Safe 'enrollment_retry_authority_corrupted'
            }
            $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
            $rsa.FromXmlString([string]$requestState.privateXml)
        } else {
            if (Test-Path -LiteralPath $privatePath) {
                Fail-Safe 'enrollment_retry_authority_missing'
            }
            $bootstrap = [string]$env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET
            if ($bootstrap -notmatch '^[A-Za-z0-9_-]{43}$') {
                Fail-Safe 'initial_bootstrap_unavailable'
            }
            $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider(2048)
            $parameters = $rsa.ExportParameters($true)
            $public = [ordered]@{
                kty = 'RSA'; n = & $b64url $parameters.Modulus; e = & $b64url $parameters.Exponent
            }
            $publicJson = $public | ConvertTo-Json -Compress
            $fingerprintBytes = [Text.Encoding]::UTF8.GetBytes(('{"e":"' + $public.e + '","kty":"RSA","n":"' + $public.n + '"}'))
            $fingerprint = ([Security.Cryptography.SHA256]::Create().ComputeHash($fingerprintBytes) |
                ForEach-Object { $_.ToString('x2') }) -join ''
            $requestKey = [Guid]::NewGuid().ToString('N')
            $hostJson = ([string][Environment]::MachineName | ConvertTo-Json -Compress)
            $capabilitiesJson = '["host:cleanup","host:transport"]'
            $declarationDigestInput = '{"capabilities":' + $capabilitiesJson + ',"hostId":' + $hostJson + ',"protocolVersion":1}'
            $declarationDigest = ([Security.Cryptography.SHA256]::Create().ComputeHash(
                [Text.Encoding]::UTF8.GetBytes($declarationDigestInput)) |
                ForEach-Object { $_.ToString('x2') }) -join ''
            $issuedAt = [DateTime]::UtcNow.ToString('o')
            $expiresAt = [DateTime]::UtcNow.AddMinutes(15).ToString('o')
            $payloadJson = '{"capabilities":' + $capabilitiesJson + ',"declarationDigest":"' + $declarationDigest + '","hostId":' + $hostJson + ',"protocolVersion":1}'
            $envelopeBase = '{"correlationId":"' + $requestKey + '","expiresAt":"' + $expiresAt + '","issuedAt":"' + $issuedAt + '","kind":"enrollment_declaration","payload":' + $payloadJson + ',"protocolVersion":1,"requestId":"' + $requestKey + '"}'
            $envelopeDigest = ([Security.Cryptography.SHA256]::Create().ComputeHash(
                [Text.Encoding]::UTF8.GetBytes($envelopeBase)) |
                ForEach-Object { $_.ToString('x2') }) -join ''
            $declaration = [ordered]@{
                protocolVersion = 1; kind = 'enrollment_declaration'; requestId = $requestKey
                correlationId = $requestKey; issuedAt = $issuedAt; expiresAt = $expiresAt
                payload = [ordered]@{
                    hostId = [Environment]::MachineName; declarationDigest = $declarationDigest
                    capabilities = @('host:cleanup', 'host:transport'); protocolVersion = 1
                }; digest = $envelopeDigest
            }
            $body = [ordered]@{
                requestKey = $requestKey; declaration = $declaration
                publicKey = $publicJson; keyFingerprint = $fingerprint
                capabilities = $declaration.payload.capabilities
            } | ConvertTo-Json -Depth 5 -Compress
            $requestState = [ordered]@{
                endpoint = $endpointBase; requestId = ''; requestKey = $requestKey
                fingerprint = $fingerprint; body = $body; privateXml = $rsa.ToXmlString($true)
            }
            $requestCipher = [Security.Cryptography.ProtectedData]::Protect(
                [Text.Encoding]::UTF8.GetBytes(($requestState | ConvertTo-Json -Depth 5 -Compress)),
                $null, $CurrentUserScope)
            Write-DpapiBase64Atomic -Path $requestPath -Bytes $requestCipher
        }

        $parameters = $rsa.ExportParameters($false)
        $public = [ordered]@{
            kty = 'RSA'; n = & $b64url $parameters.Modulus; e = & $b64url $parameters.Exponent
        }
        $derivedFingerprintBytes = [Text.Encoding]::UTF8.GetBytes(
            ('{"e":"' + $public.e + '","kty":"RSA","n":"' + $public.n + '"}'))
        $derivedFingerprint = ([Security.Cryptography.SHA256]::Create().ComputeHash($derivedFingerprintBytes) |
            ForEach-Object { $_.ToString('x2') }) -join ''
        $derivedPublicJson = $public | ConvertTo-Json -Compress
        $parsedBody = [string]$requestState.body | ConvertFrom-Json
        if ($derivedFingerprint -ne [string]$requestState.fingerprint -or
            [string]$parsedBody.keyFingerprint -ne $derivedFingerprint -or
            [string]$parsedBody.publicKey -ne $derivedPublicJson -or
            [string]$parsedBody.requestKey -ne [string]$requestState.requestKey) {
            Fail-Safe 'enrollment_retry_authority_corrupted'
        }

        $privateXml = $rsa.ToXmlString($true)
        $protected = [Security.Cryptography.ProtectedData]::Protect(
            [Text.Encoding]::UTF8.GetBytes($privateXml), $null, $CurrentUserScope)
        Write-DpapiBase64Atomic -Path $privatePath -Bytes $protected

        if ([string]::IsNullOrWhiteSpace([string]$requestState.requestId)) {
            $bootstrap = [string]$env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET
            if ($bootstrap -notmatch '^[A-Za-z0-9_-]{43}$') {
                Fail-Safe 'initial_bootstrap_unavailable'
            }
            $request = Invoke-RestMethod -Method Post -Uri ($endpointBase + '/api/coordination/v2/host-enrollment-requests') `
                -Headers @{ 'x-coordination-initial-bootstrap' = $bootstrap } `
                -ContentType 'application/json' -Body ([string]$requestState.body) -UseBasicParsing
            if ([string]$request.requestId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
                Fail-Safe 'enrollment_response_invalid'
            }
            $requestState.requestId = [string]$request.requestId
            $requestCipher = [Security.Cryptography.ProtectedData]::Protect(
                [Text.Encoding]::UTF8.GetBytes(($requestState | ConvertTo-Json -Depth 5 -Compress)),
                $null, $CurrentUserScope)
            Write-DpapiBase64Atomic -Path $requestPath -Bytes $requestCipher
            $env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET = $null
            Remove-Item Env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET -ErrorAction SilentlyContinue
            Set-Clipboard -Value $null -ErrorAction SilentlyContinue
            return [ordered]@{
                requestId = [string]$request.requestId
                fingerprint = [string]$requestState.fingerprint
                status = [string]$request.status
                created = [bool]$request.created
            }
        }

        $env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET = $null
        Remove-Item Env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET -ErrorAction SilentlyContinue
        Set-Clipboard -Value $null -ErrorAction SilentlyContinue
        $approvalFragment = ''
        $approvalBase = $FounderApprovalUrl
        $fragmentIndex = $FounderApprovalUrl.IndexOf('#')
        if ($fragmentIndex -ge 0) {
            $approvalFragment = $FounderApprovalUrl.Substring($fragmentIndex)
            $approvalBase = $FounderApprovalUrl.Substring(0, $fragmentIndex)
        }
        $approvalSeparator = if ($approvalBase.Contains('?')) { '&' } else { '?' }
        Start-Process ($approvalBase + $approvalSeparator + 'requestId=' +
            [Uri]::EscapeDataString([string]$requestState.requestId) + $approvalFragment) | Out-Null
        $deadline = [DateTime]::UtcNow.AddMinutes(15)
        while ([DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Seconds 2
            $status = Invoke-RestMethod -Method Get -Uri ($endpointBase + '/api/coordination/v2/host-enrollment-requests/' + $requestState.requestId + '/status?requestKey=' + [Uri]::EscapeDataString([string]$requestState.requestKey)) -UseBasicParsing
            if ($status.challenge) {
                $challenge = $status.challenge
                $signature = $rsa.SignData([Text.Encoding]::UTF8.GetBytes([string]$challenge.nonce), [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
                $proof = @{ challengeId = $challenge.id; nonce = $challenge.nonce; signature = [Convert]::ToBase64String($signature) } | ConvertTo-Json -Compress
                $issued = Invoke-RestMethod -Method Post -Uri ($endpointBase + '/api/coordination/v2/host-enrollment-requests/' + $requestState.requestId + '/proof') `
                    -ContentType 'application/json' -Body $proof -UseBasicParsing
                if ([string]$issued.accessToken -notmatch '^v2h_[A-Za-z0-9_-]{32,}$') {
                    Fail-Safe 'host_credential_invalid'
                }
                $material = @{ endpoint = $endpointBase; accessToken = $issued.accessToken } | ConvertTo-Json -Compress
                $materialCipher = [Security.Cryptography.ProtectedData]::Protect(
                    [Text.Encoding]::UTF8.GetBytes($material), $null, $CurrentUserScope)
                Write-DpapiBase64Atomic -Path $materialPath -Bytes $materialCipher
                Remove-Item -LiteralPath $requestPath -Force -ErrorAction SilentlyContinue
                return [ordered]@{
                    requestId = [string]$requestState.requestId
                    fingerprint = [string]$requestState.fingerprint
                    status = 'completed'
                    credentialProtected = $true
                }
            }
        }
        Fail-Safe 'enrollment_approval_timeout'
    } finally {
        if ($null -ne $rsa) { $rsa.Dispose() }
    }
}
# END COORDINATION_REGISTER_BOUNDARY

# No import-time lifecycle execution. Operators explicitly call
# Invoke-HolaCoordinator -TaskRef <task reference>.
