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
$PinnedServerPublicKey = Join-Path $ApprovedWorktree 'scripts\coordination-v2-server-signing-public.pem'
$RuntimeRoot = Join-Path $ApprovedWorktree 'runtime'
$RuntimeNode = Join-Path $RuntimeRoot 'node.exe'
$RuntimeTsxRoot = Join-Path $ApprovedWorktree 'node_modules\tsx'
$RuntimeManifest = Join-Path $ApprovedWorktree '.coordination-v2-runtime-manifest.json'
$RuntimeBootstrapRoot = Join-Path $env:LOCALAPPDATA 'HolaHola\CoordinatorV2'
$RuntimeRequestPath = Join-Path $RuntimeBootstrapRoot 'runtime-bootstrap-request.dpapi'
$RuntimeAckPath = Join-Path $RuntimeBootstrapRoot 'runtime-bootstrap-ack.dpapi'
$PinnedServerPublicKeyPem = @'
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4dQnolcXTJD7krRP6diTzmu7/Sqsqocq6HrX6pfBb1c=
-----END PUBLIC KEY-----
'@
$ApprovedSourceMemberPaths = @(
    'scripts/hola-coordinator.ps1',
    'scripts/coordination-v2-server-signing-public.pem',
    'server/scripts/coordination-v2-cli.ts'
)
$RuntimeTotalArtifactMaxBytes = [int64]268435456
$CurrentUserScope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
$ApprovedNode = $null

function Fail-Safe {
    param([Parameter(Mandatory = $true)][string]$Code)
    $safeCode = ($Code -replace '[^a-zA-Z0-9_-]', '_')
    $safeCode = $safeCode.Substring(0, [Math]::Min(80, $safeCode.Length))
    throw ('hola_coordinator_' + $safeCode)
}

function Resolve-ApprovedNode {
    if ([System.IO.File]::Exists($RuntimeNode)) {
        return [System.IO.Path]::GetFullPath($RuntimeNode)
    }
    Fail-Safe 'approved_node_missing'
}

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

function Assert-SafePath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root
    )
    $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if ($fullPath -ne $fullRoot -and
        -not $fullPath.StartsWith($fullRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Fail-Safe 'path_escape'
    }
    $cursor = $fullPath
    while ($null -ne $cursor -and $cursor.Length -ge $fullRoot.Length) {
        if ([System.IO.File]::Exists($cursor) -or [System.IO.Directory]::Exists($cursor)) {
            Assert-NoReparse -Path $cursor
        }
        if ($cursor -eq $fullRoot) { break }
        $parent = [System.IO.Directory]::GetParent($cursor)
        if ($null -eq $parent) { break }
        $cursor = $parent.FullName
    }
    return $fullPath
}

function Convert-ToSidValue {
    param([Parameter(Mandatory = $true)]$IdentityReference)
    try {
        if ($IdentityReference -is [System.Security.Principal.SecurityIdentifier]) {
            return $IdentityReference.Value
        }
        if ($IdentityReference -is [string]) {
            if ($IdentityReference.StartsWith(
                'S-1-', [System.StringComparison]::OrdinalIgnoreCase)) {
                # Malformed SID strings fail in the constructor and remain fail-closed.
                $sid = New-Object -TypeName System.Security.Principal.SecurityIdentifier `
                    -ArgumentList $IdentityReference
                return $sid.Value
            }
            $account = New-Object -TypeName System.Security.Principal.NTAccount `
                -ArgumentList $IdentityReference
            return $account.Translate([System.Security.Principal.SecurityIdentifier]).Value
        }
        return $IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
    } catch {
        Fail-Safe 'acl_identity_unresolvable'
    }
}

function Assert-SidAcl {
    param([Parameter(Mandatory = $true)][string]$Path)
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    if ($null -eq $acl -or $null -eq $acl.Owner) { Fail-Safe 'acl_unavailable' }
    $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $ownerSid = Convert-ToSidValue -IdentityReference $acl.Owner
    $allowedOwners = @($currentSid, 'S-1-5-18', 'S-1-5-32-544')
    if ($allowedOwners -notcontains $ownerSid) { Fail-Safe 'acl_owner_unsafe' }
    $unsafeWriteMask = [int](
        [System.Security.AccessControl.FileSystemRights]::Write `
        -bor [System.Security.AccessControl.FileSystemRights]::Modify `
        -bor [System.Security.AccessControl.FileSystemRights]::FullControl `
        -bor [System.Security.AccessControl.FileSystemRights]::TakeOwnership `
        -bor [System.Security.AccessControl.FileSystemRights]::ChangePermissions
    )
    foreach ($ace in @($acl.Access)) {
        $sid = Convert-ToSidValue -IdentityReference $ace.IdentityReference
        $rights = [int]$ace.FileSystemRights
        if (($rights -band $unsafeWriteMask) -ne 0 -and $allowedOwners -notcontains $sid) {
            Fail-Safe 'acl_write_unsafe'
        }
        if ($sid -eq 'S-1-1-0' -or $sid -eq 'S-1-5-32-545' -or
            $sid -eq 'S-1-5-32-546' -or $sid -eq 'S-1-5-11') {
            if (($rights -band $unsafeWriteMask) -ne 0) { Fail-Safe 'acl_untrusted_write' }
        }
    }
}

function Assert-PrivatePath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root
    )
    Assert-SafePath -Path $Path -Root $Root | Out-Null
    Assert-SidAcl -Path $Path
}

function Assert-ApprovedRepository {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $git) { Fail-Safe 'git_missing' }
    $clean = (& $git.Source -C $ApprovedWorktree status --porcelain 2>$null)
    if ($LASTEXITCODE -ne 0 -or $clean) { Fail-Safe 'repository_dirty' }
    # Commit/tree/publication authority is supplied by the signed V2 preflight
    # envelope. This launcher deliberately does not trust a local SHA artifact.
}

function Assert-ApprovedDigest {
    param([Parameter(Mandatory = $true)][string]$Path)
    $digest = Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop
    if ($null -eq $digest.Hash -or $digest.Hash.Length -ne 64) { Fail-Safe 'digest_unavailable' }
}

function Assert-ApprovedSignatureAndDigest {
    param([Parameter(Mandatory = $true)][string]$Path)
    # Authenticode is a PE-only authority.  Script/module bytes are authorized
    # by the signed runtime manifest and source-member hashes instead.
    if ([System.IO.Path]::GetExtension($Path).ToLowerInvariant() -eq '.exe') {
        $signature = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
        if ($signature.Status -ne 'Valid') { Fail-Safe 'signature_invalid' }
    }
    Assert-ApprovedDigest -Path $Path
}

function Write-DpapiBase64Atomic {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][byte[]]$Bytes)
    $encoded = [Convert]::ToBase64String($Bytes)
    $temporary = $Path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    [IO.File]::WriteAllText($temporary, $encoded, (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Write-DpapiJsonAtomic {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    $parent = Split-Path -Parent ([System.IO.Path]::GetFullPath($Path))
    if (-not [IO.Directory]::Exists($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Assert-NoReparse -Path $parent
    Assert-SidAcl -Path $parent
    $json = $Value | ConvertTo-Json -Depth 30 -Compress
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
        [Text.Encoding]::UTF8.GetBytes($json), $null, $CurrentUserScope)
    Write-DpapiBase64Atomic -Path $Path -Bytes $cipher
    Assert-NoReparse -Path $Path
    Assert-SidAcl -Path $Path
    Assert-NoReparse -Path $parent
    Assert-SidAcl -Path $parent
}

function Write-InstalledManifestAtomic {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Manifest)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Parent $fullPath
    if (-not [IO.Directory]::Exists($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Assert-NoReparse -Path $parent
    Assert-SidAcl -Path $parent
    $temporary = $fullPath + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    if ([IO.File]::Exists($fullPath)) {
        Assert-NoReparse -Path $fullPath
        Assert-SidAcl -Path $fullPath
    }
    if ([IO.Path]::GetPathRoot($temporary) -ine [IO.Path]::GetPathRoot($fullPath)) {
        Fail-Safe 'runtime_manifest_volume_invalid'
    }
    try {
        $json = $Manifest | ConvertTo-Json -Depth 30 -Compress
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        $stream = New-Object -TypeName IO.FileStream -ArgumentList @(
            $temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush($true)
        } finally {
            $stream.Dispose()
        }
        Assert-NoReparse -Path $temporary
        Assert-SidAcl -Path $temporary
        Move-Item -LiteralPath $temporary -Destination $fullPath -Force
        Assert-NoReparse -Path $fullPath
        Assert-SidAcl -Path $fullPath
    } catch {
        if ([IO.File]::Exists($temporary)) {
            Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
        }
        if ($_.Exception.Message -match '^hola_coordinator_') { throw }
        Fail-Safe 'runtime_manifest_write_failed'
    }
}

function Read-DpapiJson {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$FailureCode)
    try {
        $cipher = [Convert]::FromBase64String([IO.File]::ReadAllText($Path))
        $plain = [Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, $CurrentUserScope)
        return ([Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json -ErrorAction Stop)
    } catch {
        Fail-Safe $FailureCode
    }
}

function Get-PropertyNames {
    param([Parameter(Mandatory = $true)]$Value)
    if ($null -eq $Value -or $Value -is [System.Array] -or $Value -isnot [PSCustomObject]) {
        return @()
    }
    return @($Value.PSObject.Properties | ForEach-Object { $_.Name })
}

function Assert-ExactPropertySet {
    param(
        [Parameter(Mandatory = $true)]$Value,
        [Parameter(Mandatory = $true)][string[]]$Names,
        [Parameter(Mandatory = $true)][string]$FailureCode
    )
    $actual = @(Get-PropertyNames -Value $Value | Sort-Object)
    $expected = @($Names | Sort-Object)
    if ($actual.Count -ne $expected.Count) { Fail-Safe $FailureCode }
    for ($index = 0; $index -lt $expected.Count; $index++) {
        if ($actual[$index] -cne $expected[$index]) { Fail-Safe $FailureCode }
    }
}

function ConvertTo-CanonicalJson {
    param([Parameter(Mandatory = $true)]$Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) { return $(if ($Value) { 'true' } else { 'false' }) }
    if ($Value -is [string]) { return ($Value | ConvertTo-Json -Compress) }
    if ($Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or
        $Value -is [int64] -or $Value -is [decimal] -or $Value -is [double]) {
        return ([Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture))
    }
    if ($Value -is [System.Array]) {
        $parts = @()
        foreach ($item in $Value) { $parts += (ConvertTo-CanonicalJson -Value $item) }
        return '[' + ($parts -join ',') + ']'
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $keys = @($Value.Keys | ForEach-Object { [string]$_ })
        for ($outer = 1; $outer -lt $keys.Count; $outer++) {
            $inner = $outer
            while ($inner -gt 0 -and
                [string]::CompareOrdinal($keys[$inner], $keys[$inner - 1]) -lt 0) {
                $swap = $keys[$inner - 1]
                $keys[$inner - 1] = $keys[$inner]
                $keys[$inner] = $swap
                $inner--
            }
        }
        $parts = @()
        foreach ($key in $keys) {
            $parts += ((ConvertTo-CanonicalJson -Value $key) + ':' +
                (ConvertTo-CanonicalJson -Value $Value[$key]))
        }
        return '{' + ($parts -join ',') + '}'
    }
    if ($Value -isnot [PSCustomObject]) { Fail-Safe 'canonical_value_invalid' }
    $parts = @()
    foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) {
        $parts += ((ConvertTo-CanonicalJson -Value ([string]$property.Name)) + ':' +
            (ConvertTo-CanonicalJson -Value $property.Value))
    }
    return '{' + ($parts -join ',') + '}'
}

function Get-RsaFingerprint {
    param([Parameter(Mandatory = $true)]$Rsa)
    $parameters = $Rsa.ExportParameters($false)
    $b64url = {
        param([byte[]]$Bytes)
        ([Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_'))
    }
    $public = '{"e":"' + (& $b64url $parameters.Exponent) + '","kty":"RSA","n":"' +
        (& $b64url $parameters.Modulus) + '"}'
    return (([Security.Cryptography.SHA256]::Create().ComputeHash(
        [Text.Encoding]::UTF8.GetBytes($public)) | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Get-HostBootstrapIdentity {
    $materialPath = Join-Path $RuntimeBootstrapRoot 'host-material.dpapi'
    $privatePath = Join-Path $RuntimeBootstrapRoot 'host-private-key.dpapi'
    if (-not [IO.File]::Exists($materialPath) -or -not [IO.File]::Exists($privatePath)) {
        Fail-Safe 'host_credential_missing'
    }
    $material = Read-DpapiJson -Path $materialPath -FailureCode 'host_credential_corrupted'
    $materialNames = @(Get-PropertyNames -Value $material)
    if ($materialNames.Count -eq 2 -and $materialNames -contains 'endpoint' -and
        $materialNames -contains 'accessToken') {
        # Legacy material is useful only to the explicit recovery command.  The
        # runtime must not spend the expired token as an authority.
        Fail-Safe 'host_credential_reauthorization_required'
    }
    Assert-ExactPropertySet -Value $material -Names @('endpoint', 'accessToken', 'expiresAt') -FailureCode 'host_credential_shape'
    if ([string]$material.expiresAt -notmatch '^\d{4}-\d{2}-\d{2}T') {
        Fail-Safe 'host_credential_invalid'
    }
    try {
        if ([DateTime]::Parse([string]$material.expiresAt).ToUniversalTime() -le [DateTime]::UtcNow) {
            Fail-Safe 'host_credential_reauthorization_required'
        }
    } catch {
        Fail-Safe 'host_credential_invalid'
    }
    if ([string]$material.accessToken -notmatch '^v2h_[A-Za-z0-9_-]{32,}$') {
        Fail-Safe 'host_credential_invalid'
    }
    $privateXml = [Text.Encoding]::UTF8.GetString(
        [Security.Cryptography.ProtectedData]::Unprotect(
            [Convert]::FromBase64String([IO.File]::ReadAllText($privatePath)),
            $null, $CurrentUserScope))
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
    try { $rsa.FromXmlString($privateXml) } catch { $rsa.Dispose(); Fail-Safe 'host_key_invalid' }
    return [ordered]@{
        endpoint = [string]$material.endpoint
        accessToken = [string]$material.accessToken
        expiresAt = [string]$material.expiresAt
        rsa = $rsa
        fingerprint = Get-RsaFingerprint -Rsa $rsa
    }
}

function Invoke-HostAuthenticatedRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Endpoint,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Identity,
        [AllowEmptyString()][string]$Body = ''
    )
    $signature = $Identity.rsa.SignData(
        [Text.Encoding]::UTF8.GetBytes([string]$Identity.accessToken),
        [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
    $headers = @{
        'x-coordination-v2-host-token' = [string]$Identity.accessToken
        'x-coordination-v2-host-proof' = [Convert]::ToBase64String($signature)
    }
    try {
        return Invoke-RestMethod -Method $Method -Uri ($Endpoint.TrimEnd('/') + $Path) `
            -Headers $headers -ContentType 'application/json' -Body $Body `
            -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
    } catch {
        Fail-Safe 'runtime_bootstrap_transport'
    }
}

function Assert-ManifestPath {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$FailureCode)
    $normalized = $Path.Replace('/', '\')
    $segments = $normalized -split '\\'
    if ([string]::IsNullOrWhiteSpace($Path) -or [IO.Path]::IsPathRooted($normalized) -or
        $normalized.StartsWith('\') -or $normalized -match '^[A-Za-z]:' -or
        $segments.Count -eq 0 -or ($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' }).Count -gt 0 -or
        $normalized -match '[:\x00-\x1f]' -or $normalized -match '[\x00-\x1f]' -or
        $normalized -match '[\*?"<>|]') {
        Fail-Safe $FailureCode
    }
    return $normalized
}

function Assert-StrictUuid {
    param([Parameter(Mandatory = $true)][string]$Value, [Parameter(Mandatory = $true)][string]$FailureCode)
    if ($Value -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') {
        Fail-Safe $FailureCode
    }
}

function Assert-RuntimeManifestShape {
    param([Parameter(Mandatory = $true)]$Envelope, [switch]$AllowExpired)
    Assert-ExactPropertySet -Value $Envelope -Names @(
        'payload', 'canonicalResponseDigest', 'signature', 'keyFingerprint'
    ) -FailureCode 'runtime_manifest_response_shape'
    if ([string]$Envelope.canonicalResponseDigest -notmatch '^[0-9a-f]{64}$' -or
        [string]$Envelope.keyFingerprint -notmatch '^[0-9a-f]{64}$' -or
        [string]::IsNullOrWhiteSpace([string]$Envelope.signature)) {
        Fail-Safe 'runtime_manifest_response_shape'
    }
    $payload = $Envelope.payload
    Assert-ExactPropertySet -Value $payload -Names @(
        'protocolVersion', 'kind', 'issueId', 'requestKeyDigest', 'hostEnrollmentId',
        'hostKeyFingerprint', 'runtimeReleaseId', 'runtimeReleaseDigest',
        'sourcePromotionId', 'repositoryIdentity', 'promotedCommitSha', 'exactTreeSha',
        'publicationReference', 'protectedValidationId', 'sourcePromotionRecordDigest',
        'artifacts', 'sourceMembers', 'issuedAt', 'expiresAt', 'nonce'
    ) -FailureCode 'runtime_manifest_payload_shape'
    if ([int]$payload.protocolVersion -ne 1 -or [string]$payload.kind -cne 'runtime_bootstrap_manifest' -or
        [string]$payload.issueId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' -or
        [string]$payload.hostEnrollmentId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' -or
        [string]$payload.runtimeReleaseId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' -or
        [string]$payload.sourcePromotionId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' -or
        [string]$payload.requestKeyDigest -notmatch '^[0-9a-f]{64}$' -or
        [string]$payload.hostKeyFingerprint -notmatch '^[0-9a-f]{64}$' -or
        [string]$payload.runtimeReleaseDigest -notmatch '^[0-9a-f]{64}$' -or
        [string]$payload.sourcePromotionRecordDigest -notmatch '^[0-9a-f]{64}$' -or
        [string]$payload.promotedCommitSha -notmatch '^[0-9a-f]{40}$' -or
        [string]$payload.exactTreeSha -notmatch '^[0-9a-f]{40}$' -or
        [string]$payload.issuedAt -notmatch '^\d{4}-\d{2}-\d{2}T' -or
        [string]$payload.expiresAt -notmatch '^\d{4}-\d{2}-\d{2}T') {
        Fail-Safe 'runtime_manifest_payload_invalid'
    }
    $issued = [DateTime]::Parse([string]$payload.issuedAt).ToUniversalTime()
    $expires = [DateTime]::Parse([string]$payload.expiresAt).ToUniversalTime()
    if ($expires -le $issued -or $expires -gt $issued.AddMinutes(5) -or
        $issued -gt [DateTime]::UtcNow.AddMinutes(1) -or
        (-not $AllowExpired -and $expires -le [DateTime]::UtcNow)) {
        Fail-Safe 'runtime_manifest_expired'
    }
    if ($payload.artifacts -isnot [System.Array] -or $payload.artifacts.Count -lt 2 -or
        $payload.artifacts.Count -gt 4096 -or $payload.sourceMembers -isnot [System.Array] -or
        $payload.sourceMembers.Count -ne 3) {
        Fail-Safe 'runtime_manifest_members_invalid'
    }
    $nodeCount = 0
    $tsxCount = 0
    $totalBytes = [int64]0
    $seenDestinations = @{}
    foreach ($artifact in @($payload.artifacts)) {
        Assert-ExactPropertySet -Value $artifact -Names @(
            'artifactId', 'role', 'fixedDestination', 'objectDigest', 'byteLength',
            'mediaType', 'requiresAuthenticode'
        ) -FailureCode 'runtime_artifact_shape'
        if ([string]$artifact.role -notin @('node_executable', 'tsx_runtime_module') -or
            [string]$artifact.artifactId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' -or
            [string]$artifact.objectDigest -notmatch '^[0-9a-f]{64}$' -or
            $artifact.requiresAuthenticode -isnot [bool] -or [int64]$artifact.byteLength -le 0 -or
            [int64]$artifact.byteLength -gt $RuntimeTotalArtifactMaxBytes) {
            Fail-Safe 'runtime_artifact_invalid'
        }
        $destination = Assert-ManifestPath -Path ([string]$artifact.fixedDestination) -FailureCode 'runtime_destination_invalid'
        if ($seenDestinations.ContainsKey($destination.ToLowerInvariant())) {
            Fail-Safe 'runtime_destination_duplicate'
        }
        $seenDestinations[$destination.ToLowerInvariant()] = $true
        if (($artifact.role -eq 'node_executable' -and $destination -cne 'runtime\node.exe') -or
            ($artifact.role -eq 'tsx_runtime_module' -and
                -not $destination.StartsWith('node_modules\tsx\', [StringComparison]::OrdinalIgnoreCase)) -or
            ($artifact.role -eq 'node_executable' -and $artifact.requiresAuthenticode -ne $true) -or
            ($artifact.role -eq 'tsx_runtime_module' -and $artifact.requiresAuthenticode -ne $false)) {
            Fail-Safe 'runtime_destination_invalid'
        }
        if ($artifact.role -eq 'node_executable') { $nodeCount++ } else { $tsxCount++ }
        $totalBytes += [int64]$artifact.byteLength
        if ($totalBytes -gt $RuntimeTotalArtifactMaxBytes) { Fail-Safe 'runtime_artifact_total_too_large' }
    }
    if ($nodeCount -ne 1 -or $tsxCount -lt 1 -or $tsxCount -gt 4095) {
        Fail-Safe 'runtime_artifact_roles_invalid'
    }
    foreach ($member in @($payload.sourceMembers)) {
        Assert-ExactPropertySet -Value $member -Names @('fixedPath', 'sha256') -FailureCode 'runtime_source_member_shape'
        if ($ApprovedSourceMemberPaths -cnotcontains [string]$member.fixedPath) {
            Fail-Safe 'runtime_source_path_invalid'
        }
        if ([string]$member.sha256 -notmatch '^[0-9a-f]{64}$') { Fail-Safe 'runtime_source_member_invalid' }
    }
    $sourcePaths = @($payload.sourceMembers | ForEach-Object { [string]$_.fixedPath })
    if (@($sourcePaths | Sort-Object -Unique).Count -ne 3) {
        Fail-Safe 'runtime_source_members_duplicate'
    }
}

function Invoke-PinnedManifestVerifier {
    param(
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$EnvelopePath,
        [Parameter(Mandatory = $true)][string]$ExpectedHostEnrollmentId,
        [Parameter(Mandatory = $true)][string]$StageRoot,
        [Parameter(Mandatory = $true)][bool]$VerifyStagedFiles,
        [switch]$AllowExpired
    )
    if (-not [IO.File]::Exists($PinnedServerPublicKey)) { Fail-Safe 'runtime_public_key_missing' }
    $pinnedPem = $PinnedServerPublicKeyPem
    if ([string]::IsNullOrWhiteSpace($pinnedPem) -or $pinnedPem -notmatch 'BEGIN PUBLIC KEY' -or
        [IO.File]::ReadAllText($PinnedServerPublicKey).Trim() -cne $pinnedPem.Trim()) {
        Fail-Safe 'runtime_public_key_invalid'
    }
    # This verifier is intentionally inline and fixed.  It is passed only to
    # node.exe after Authenticode and the manifest hash have succeeded.  It
    # never imports or executes any staged JavaScript.
    $verifier = @'
const fs = require("node:fs");
const crypto = require("node:crypto");
const envelope = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const expectedHost = process.argv[2];
const stageRoot = process.argv[3];
const verifyFiles = process.argv[4] === "1";
const pinnedPem = process.argv[5];
const allowExpired = process.argv[6] === "1";
const own = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => own(v) && Object.keys(v).sort().join("\0") === [...keys].sort().join("\0");
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const strictUuid = (v) => typeof v === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const normalizeRelative = (v) => {
  if (typeof v !== "string" || v.length === 0) throw new Error("relative_path_invalid");
  const normalized = v.replace(/\//g, "\\");
  if (normalized.startsWith("\\") || /^[A-Za-z]:/.test(normalized)) throw new Error("relative_path_rooted");
  const parts = normalized.split("\\");
  if (parts.some((part) => part.length === 0 || part === "." || part === ".."
    || /[\u0000-\u001f:*?"<>|]/.test(part))) throw new Error("relative_path_segment");
  return normalized;
};
const canonical = (v) => {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (own(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  throw new Error("manifest_canonical_value_invalid");
};
const fail = (code) => { process.stderr.write(code); process.exit(70); };
try {
  if (!exact(envelope, ["payload", "canonicalResponseDigest", "signature", "keyFingerprint"])) fail("response_shape");
  const p = envelope.payload;
  const payloadKeys = [
    "protocolVersion", "kind", "issueId", "requestKeyDigest", "hostEnrollmentId",
    "hostKeyFingerprint", "runtimeReleaseId", "runtimeReleaseDigest", "sourcePromotionId",
    "repositoryIdentity", "promotedCommitSha", "exactTreeSha", "publicationReference",
    "protectedValidationId", "sourcePromotionRecordDigest", "artifacts", "sourceMembers",
    "issuedAt", "expiresAt", "nonce"
  ];
  if (!exact(p, payloadKeys) || p.protocolVersion !== 1 || p.kind !== "runtime_bootstrap_manifest"
    || !strictUuid(p.issueId) || !strictUuid(p.hostEnrollmentId) || !strictUuid(p.runtimeReleaseId)
    || !strictUuid(p.sourcePromotionId)
    || p.hostEnrollmentId !== expectedHost || !/^[0-9a-f]{64}$/.test(p.requestKeyDigest)
    || !/^[0-9a-f]{64}$/.test(p.hostKeyFingerprint) || !/^[0-9a-f]{64}$/.test(p.runtimeReleaseDigest)
    || !/^[0-9a-f]{64}$/.test(p.sourcePromotionRecordDigest) || !/^[0-9a-f]{40}$/.test(p.promotedCommitSha)
    || !/^[0-9a-f]{40}$/.test(p.exactTreeSha) || !Array.isArray(p.artifacts)
    || p.artifacts.length < 2 || p.artifacts.length > 4096
    || !Array.isArray(p.sourceMembers) || p.sourceMembers.length !== 3) fail("payload_shape");
  const key = crypto.createPublicKey(pinnedPem);
  if (key.asymmetricKeyType !== "ed25519") fail("public_key_type");
  const keyFingerprint = crypto.createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
  if (envelope.keyFingerprint !== keyFingerprint) fail("public_key_fingerprint");
  const canonicalPayload = canonical(p);
  if (crypto.createHash("sha256").update(canonicalPayload).digest("hex") !== envelope.canonicalResponseDigest
    && envelope.canonicalResponseDigest !== digest(Buffer.from(canonicalPayload))) fail("canonical_digest");
  if (!crypto.verify(null, Buffer.from(canonicalPayload), key, Buffer.from(envelope.signature, "base64"))) fail("manifest_signature");
  const issued = Date.parse(p.issuedAt), expires = Date.parse(p.expiresAt), now = Date.now();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now + 60000
    || (!allowExpired && expires <= now) || expires - issued > 300000) fail("manifest_expiry");
  const path = require("node:path");
  const stageAbsolute = path.resolve(stageRoot);
  const seenDestinations = new Set();
  let nodeCount = 0, tsxCount = 0, totalBytes = 0;
  for (const a of p.artifacts) {
    if (!exact(a, ["artifactId", "role", "fixedDestination", "objectDigest", "byteLength", "mediaType", "requiresAuthenticode"])
      || (a.role !== "node_executable" && a.role !== "tsx_runtime_module")
      || !strictUuid(a.artifactId) || !/^[0-9a-f]{64}$/.test(a.objectDigest)
      || typeof a.requiresAuthenticode !== "boolean" || !Number.isSafeInteger(a.byteLength)
      || a.byteLength <= 0 || a.byteLength > 268435456) fail("artifact_shape");
    const destination = normalizeRelative(a.fixedDestination);
    const destinationKey = destination.toLowerCase();
    if (seenDestinations.has(destinationKey)) fail("artifact_destination_duplicate");
    seenDestinations.add(destinationKey);
    if ((a.role === "node_executable" && (destination !== "runtime\\node.exe" || a.requiresAuthenticode !== true))
      || (a.role === "tsx_runtime_module"
        && (!destination.toLowerCase().startsWith("node_modules\\tsx\\") || a.requiresAuthenticode !== false))) fail("artifact_path");
    if (a.role === "node_executable") nodeCount++; else tsxCount++;
    totalBytes += a.byteLength;
    if (totalBytes > 268435456) fail("artifact_total_size");
    if (verifyFiles) {
      const target = path.resolve(stageAbsolute, destination);
      if (target !== stageAbsolute && !target.startsWith(stageAbsolute + path.sep)) fail("artifact_containment");
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== a.byteLength
        || digest(fs.readFileSync(target)) !== a.objectDigest) fail("artifact_bytes");
    }
  }
  if (nodeCount !== 1 || tsxCount < 1 || tsxCount > 4095) fail("artifact_roles");
  const approvedSources = new Set([
    "scripts/hola-coordinator.ps1",
    "scripts/coordination-v2-server-signing-public.pem",
    "server/scripts/coordination-v2-cli.ts"
  ]);
  const seenSources = new Set();
  for (const member of p.sourceMembers) {
    if (!exact(member, ["fixedPath", "sha256"]) || !/^[0-9a-f]{64}$/.test(member.sha256)
      || !approvedSources.has(member.fixedPath) || seenSources.has(member.fixedPath)) fail("source_member_shape");
    seenSources.add(member.fixedPath);
  }
  if (seenSources.size !== approvedSources.size) fail("source_member_set");
} catch (e) { fail("manifest_verifier_failed"); }
'@
    $verifyFlag = if ($VerifyStagedFiles) { '1' } else { '0' }
    try {
        & $NodePath -e $verifier -- $EnvelopePath $ExpectedHostEnrollmentId $StageRoot `
            $verifyFlag $pinnedPem $(if ($AllowExpired) { '1' } else { '0' }) 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail-Safe 'runtime_manifest_verification_failed' }
    } catch {
        Fail-Safe 'runtime_manifest_verification_failed'
    }
}

function Get-ManifestArtifact {
    param([Parameter(Mandatory = $true)]$Manifest, [Parameter(Mandatory = $true)][string]$Role)
    $matches = @($Manifest.payload.artifacts | Where-Object { [string]$_.role -ceq $Role })
    if ($matches.Count -ne 1) { Fail-Safe 'runtime_artifact_role_invalid' }
    return $matches[0]
}

function Download-RuntimeArtifact {
    param(
        [Parameter(Mandatory = $true)]$Artifact,
        [Parameter(Mandatory = $true)][string]$Endpoint,
        [Parameter(Mandatory = $true)][string]$IssueId,
        [Parameter(Mandatory = $true)][string]$StageRoot,
        [Parameter(Mandatory = $true)]$Identity
    )
    $destination = Assert-ManifestPath -Path ([string]$Artifact.fixedDestination) -FailureCode 'runtime_destination_invalid'
    $target = Assert-SafePath -Path (Join-Path $StageRoot $destination) -Root $StageRoot
    $parent = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Assert-SafePath -Path $parent -Root $StageRoot | Out-Null
    Assert-NoReparse -Path $parent
    Assert-SidAcl -Path $parent
    $path = '/api/coordination/v2/host/runtime-bootstrap/issues/' +
        [Uri]::EscapeDataString([string]$IssueId) + '/artifacts/' +
        [Uri]::EscapeDataString([string]$Artifact.artifactId)
    $signature = $Identity.rsa.SignData(
        [Text.Encoding]::UTF8.GetBytes([string]$Identity.accessToken),
        [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
    $headers = @{
        'x-coordination-v2-host-token' = [string]$Identity.accessToken
        'x-coordination-v2-host-proof' = [Convert]::ToBase64String($signature)
    }
    $response = $null
    $responseStream = $null
    $targetStream = $null
    $total = [int64]0
    try {
        # HttpWebRequest plus FileMode.CreateNew is used instead of
        # Invoke-WebRequest -OutFile, which can overwrite a preexisting path.
        $request = [Net.HttpWebRequest]::Create($Endpoint.TrimEnd('/') + $path)
        $request.Method = 'GET'
        $request.AllowAutoRedirect = $false
        $request.Headers['x-coordination-v2-host-token'] = [string]$Identity.accessToken
        $request.Headers['x-coordination-v2-host-proof'] = [Convert]::ToBase64String($signature)
        $response = $request.GetResponse()
        if ([int]$response.StatusCode -ne 200) { Fail-Safe 'runtime_artifact_http_status_invalid' }
        if ($response.ContentLength -ne [int64]$Artifact.byteLength) {
            Fail-Safe 'runtime_artifact_length_header_invalid'
        }
        $responseStream = $response.GetResponseStream()
        $targetStream = New-Object -TypeName IO.FileStream -ArgumentList @(
            $target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $buffer = New-Object byte[] 65536
        while (($read = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $total += [int64]$read
            if ($total -gt [int64]$Artifact.byteLength) {
                Fail-Safe 'runtime_artifact_stream_too_large'
            }
            $targetStream.Write($buffer, 0, $read)
        }
        if ($total -ne [int64]$Artifact.byteLength) {
            Fail-Safe 'runtime_artifact_length_invalid'
        }
        $targetStream.Flush($true)
    } catch {
        if ([IO.File]::Exists($target)) {
            Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
        }
        if ($_.Exception.Message -match '^hola_coordinator_') { throw }
        Fail-Safe 'runtime_artifact_download_failed'
    } finally {
        if ($null -ne $targetStream) { $targetStream.Dispose() }
        if ($null -ne $responseStream) { $responseStream.Dispose() }
        if ($null -ne $response) { $response.Dispose() }
    }
    $length = (Get-Item -LiteralPath $target -Force -ErrorAction Stop).Length
    $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    if ($length -ne [int64]$Artifact.byteLength -or $hash -cne [string]$Artifact.objectDigest) {
        Fail-Safe 'runtime_artifact_digest_mismatch'
    }
    $digestHeader = [string]$response.Headers['Digest']
    $expectedDigestHeader = 'sha-256=' + [string]$Artifact.objectDigest
    if ($digestHeader -cne $expectedDigestHeader) { Fail-Safe 'runtime_artifact_digest_header_invalid' }
    Assert-NoReparse -Path $target
    Assert-SidAcl -Path $target
    Assert-SidAcl -Path $parent
}

function Install-RuntimeGenerationAtomic {
    param([Parameter(Mandatory = $true)][string]$StageRoot)
    Assert-SafePath -Path $StageRoot -Root $ApprovedWorktree | Out-Null
    $nodeStage = Join-Path $StageRoot 'runtime\node.exe'
    $tsxStage = Join-Path $StageRoot 'node_modules\tsx'
    if (-not [IO.File]::Exists($nodeStage) -or -not [IO.Directory]::Exists($tsxStage)) {
        Fail-Safe 'runtime_generation_incomplete'
    }
    Assert-NoReparse -Path $nodeStage
    Assert-NoReparse -Path $tsxStage
    New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
    $tsxParent = Join-Path $ApprovedWorktree 'node_modules'
    New-Item -ItemType Directory -Path $tsxParent -Force | Out-Null
    Assert-PrivatePath -Path $RuntimeRoot -Root $ApprovedWorktree
    Assert-PrivatePath -Path $tsxParent -Root $ApprovedWorktree
    # All staging and destinations are beneath one approved volume.  Directory
    # moves are the promotion boundary; active files are never edited in place.
    $nodeBackup = Join-Path $ApprovedWorktree ('.runtime-bootstrap-old-' + [Guid]::NewGuid().ToString('N'))
    $tsxDestination = Join-Path $tsxParent 'tsx'
    $tsxBackup = Join-Path $ApprovedWorktree ('.runtime-bootstrap-old-tsx-' + [Guid]::NewGuid().ToString('N'))
    $hadNode = [IO.File]::Exists($RuntimeNode)
    $hadTsx = [IO.Directory]::Exists($tsxDestination)
    $nodePromoted = $false
    $tsxPromoted = $false
    try {
        if ($hadNode) { Move-Item -LiteralPath $RuntimeNode -Destination $nodeBackup -Force }
        Move-Item -LiteralPath $nodeStage -Destination $RuntimeNode -Force
        $nodePromoted = $true
        if ($hadTsx) { Move-Item -LiteralPath $tsxDestination -Destination $tsxBackup -Force }
        Move-Item -LiteralPath $tsxStage -Destination $tsxDestination -Force
        $tsxPromoted = $true
        Assert-PrivatePath -Path $RuntimeNode -Root $ApprovedWorktree
        Assert-PrivatePath -Path $tsxDestination -Root $ApprovedWorktree
    } catch {
        # Promotion is a two-tree transaction.  A failure at either move or
        # post-move proof restores both old destinations before failing closed.
        try {
            if ($nodePromoted -and [IO.File]::Exists($RuntimeNode)) {
                Remove-Item -LiteralPath $RuntimeNode -Force -ErrorAction Stop
            }
            if ($tsxPromoted -and [IO.Directory]::Exists($tsxDestination)) {
                Remove-Item -LiteralPath $tsxDestination -Recurse -Force -ErrorAction Stop
            }
            if ($hadNode -and [IO.File]::Exists($nodeBackup)) {
                Move-Item -LiteralPath $nodeBackup -Destination $RuntimeNode -Force
            }
            if ($hadTsx -and [IO.Directory]::Exists($tsxBackup)) {
                Move-Item -LiteralPath $tsxBackup -Destination $tsxDestination -Force
            }
        } catch {
            Fail-Safe 'runtime_generation_restore_failed'
        }
        Fail-Safe 'runtime_generation_promotion_failed'
    }
    if ([IO.File]::Exists($nodeBackup)) { Remove-Item -LiteralPath $nodeBackup -Force -ErrorAction Stop }
    if ([IO.Directory]::Exists($tsxBackup)) { Remove-Item -LiteralPath $tsxBackup -Recurse -Force -ErrorAction Stop }
    if ([IO.File]::Exists($nodeBackup) -or [IO.Directory]::Exists($tsxBackup)) {
        Fail-Safe 'runtime_generation_backup_cleanup_failed'
    }
}

function Get-RuntimeSourceEvidence {
    param([Parameter(Mandatory = $true)]$Manifest)
    $evidence = [ordered]@{}
    foreach ($member in @($Manifest.payload.sourceMembers)) {
        $path = Assert-ManifestPath -Path ([string]$member.fixedPath) -FailureCode 'runtime_source_path_invalid'
        $target = Assert-SafePath -Path (Join-Path $ApprovedWorktree $path) -Root $ApprovedWorktree
        if (-not [IO.File]::Exists($target)) { Fail-Safe 'runtime_source_member_missing' }
        Assert-NoReparse -Path $target
        $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
        if ($hash -cne [string]$member.sha256) { Fail-Safe 'runtime_source_member_mismatch' }
        $evidence[$path] = $hash
    }
    return $evidence
}

function Get-RuntimeAcknowledgementResponse {
    param([Parameter(Mandatory = $true)]$Response)
    Assert-ExactPropertySet -Value $Response -Names @(
        'created', 'acknowledgementId', 'acknowledgedAt', 'acknowledgementDigest'
    ) -FailureCode 'runtime_ack_response_shape'
    if ($Response.created -isnot [bool] -or
        [string]::IsNullOrWhiteSpace([string]$Response.acknowledgementId) -or
        [string]::IsNullOrWhiteSpace([string]$Response.acknowledgedAt) -or
        [string]$Response.acknowledgementDigest -notmatch '^[0-9a-f]{64}$') {
        Fail-Safe 'runtime_ack_response_invalid'
    }
    return $Response
}

function Assert-SourceMemberHash {
    param([Parameter(Mandatory = $true)]$Manifest, [Parameter(Mandatory = $true)][string]$FixedPath)
    $member = @($Manifest.payload.sourceMembers | Where-Object {
        ([string]$_.fixedPath).Replace('/', '\') -ceq $FixedPath
    })
    if ($member.Count -ne 1) { Fail-Safe 'runtime_source_member_missing' }
    $target = Assert-SafePath -Path (Join-Path $ApprovedWorktree $FixedPath) -Root $ApprovedWorktree
    if (-not [IO.File]::Exists($target)) { Fail-Safe 'runtime_source_member_missing' }
    Assert-NoReparse -Path $target
    Assert-SidAcl -Path $target
    $sourceParent = Split-Path -Parent $target
    Assert-NoReparse -Path $sourceParent
    Assert-SidAcl -Path $sourceParent
    $digest = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -cne [string]$member[0].sha256) { Fail-Safe 'runtime_source_member_mismatch' }
}

function Assert-InstalledArtifactMembership {
    param([Parameter(Mandatory = $true)]$Manifest)
    foreach ($artifact in @($Manifest.payload.artifacts)) {
        $relative = Assert-ManifestPath -Path ([string]$artifact.fixedDestination) `
            -FailureCode 'runtime_destination_invalid'
        $target = Assert-SafePath -Path (Join-Path $ApprovedWorktree $relative) -Root $ApprovedWorktree
        if (-not [IO.File]::Exists($target)) { Fail-Safe 'runtime_artifact_missing' }
        Assert-NoReparse -Path $target
        Assert-SidAcl -Path $target
        $destinationParent = Split-Path -Parent $target
        Assert-NoReparse -Path $destinationParent
        Assert-SidAcl -Path $destinationParent
        $item = Get-Item -LiteralPath $target -Force
        $digest = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($item.Length -ne [int64]$artifact.byteLength -or
            $digest -cne [string]$artifact.objectDigest) {
            Fail-Safe 'runtime_artifact_membership_invalid'
        }
        if ([string]$artifact.role -ceq 'node_executable') {
            Assert-ApprovedSignatureAndDigest -Path $target
        }
    }
}

function Test-RuntimeGenerationEvidenceEquivalent {
    param(
        [Parameter(Mandatory = $true)]$First,
        [Parameter(Mandatory = $true)]$Second
    )
    foreach ($property in @(
        'runtimeReleaseId', 'runtimeReleaseDigest', 'promotedCommitSha',
        'exactTreeSha', 'sourcePromotionId', 'repositoryIdentity',
        'publicationReference', 'protectedValidationId', 'sourcePromotionRecordDigest'
    )) {
        if ([string]$First.payload.$property -cne [string]$Second.payload.$property) {
            return $false
        }
    }
    return (ConvertTo-CanonicalJson -Value $First.payload.artifacts) -ceq
        (ConvertTo-CanonicalJson -Value $Second.payload.artifacts) -and
        (ConvertTo-CanonicalJson -Value $First.payload.sourceMembers) -ceq
        (ConvertTo-CanonicalJson -Value $Second.payload.sourceMembers)
}

function Assert-FullyInstalledRuntimeGeneration {
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)][string]$EnvelopePath,
        [switch]$AllowExpired
    )
    Assert-RuntimeManifestShape -Envelope $Manifest -AllowExpired:$AllowExpired
    try {
        $envelopeManifest = [IO.File]::ReadAllText($EnvelopePath) |
            ConvertFrom-Json -ErrorAction Stop
    } catch {
        Fail-Safe 'runtime_installed_manifest_corrupted'
    }
    Assert-RuntimeManifestShape -Envelope $envelopeManifest -AllowExpired:$AllowExpired
    if ([string]$envelopeManifest.canonicalResponseDigest -cne
        [string]$Manifest.canonicalResponseDigest) {
        Fail-Safe 'runtime_installed_manifest_binding_invalid'
    }
    Invoke-PinnedManifestVerifier -NodePath $RuntimeNode -EnvelopePath $EnvelopePath `
        -ExpectedHostEnrollmentId ([string]$Manifest.payload.hostEnrollmentId) `
        -StageRoot $ApprovedWorktree -VerifyStagedFiles $false `
        -AllowExpired:$AllowExpired
    Assert-InstalledArtifactMembership -Manifest $Manifest
    foreach ($member in @($Manifest.payload.sourceMembers)) {
        Assert-SourceMemberHash -Manifest $Manifest -FixedPath (
            ([string]$member.fixedPath).Replace('/', '\'))
    }
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $git) { Fail-Safe 'git_missing' }
    $head = [string](& $git.Source -C $ApprovedWorktree rev-parse HEAD 2>$null)
    $tree = [string](& $git.Source -C $ApprovedWorktree rev-parse HEAD^{tree} 2>$null)
    if ($LASTEXITCODE -ne 0 -or $head.ToLowerInvariant() -cne [string]$Manifest.payload.promotedCommitSha -or
        $tree.ToLowerInvariant() -cne [string]$Manifest.payload.exactTreeSha) {
        Fail-Safe 'runtime_source_checkout_invalid'
    }
}

function Get-InstalledRuntimeManifest {
    if (-not [IO.File]::Exists($RuntimeManifest)) { Fail-Safe 'runtime_manifest_missing' }
    Assert-PrivatePath -Path $RuntimeManifest -Root $ApprovedWorktree
    try {
        $manifest = [IO.File]::ReadAllText($RuntimeManifest) | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Fail-Safe 'runtime_manifest_corrupted'
    }
    Assert-RuntimeManifestShape -Envelope $manifest
    Invoke-PinnedManifestVerifier -NodePath $RuntimeNode -EnvelopePath $RuntimeManifest `
        -ExpectedHostEnrollmentId ([string]$manifest.payload.hostEnrollmentId) `
        -StageRoot $ApprovedWorktree -VerifyStagedFiles $false
    return $manifest
}

function Get-ServerRuntimeStatus {
    param([Parameter(Mandatory = $true)]$Identity)
    $path = '/api/coordination/v2/host/runtime-bootstrap/status'
    $response = Invoke-HostAuthenticatedRequest -Method 'GET' -Endpoint ([string]$Identity.endpoint) `
        -Path $path -Identity $Identity -Body ''
    $acknowledgedProperty = $response.PSObject.Properties['acknowledged']
    $preflightProperty = $response.PSObject.Properties['executionPreflightMayProceed']
    if ($null -eq $acknowledgedProperty -or $null -eq $preflightProperty) {
        Fail-Safe 'runtime_status_response_shape'
    }
    if (-not [bool]$acknowledgedProperty.Value) {
        Assert-ExactPropertySet -Value $response -Names @(
            'acknowledged', 'executionPreflightMayProceed'
        ) -FailureCode 'runtime_status_response_shape'
        if ($response.executionPreflightMayProceed -isnot [bool]) { Fail-Safe 'runtime_status_invalid' }
        return $response
    }
    Assert-ExactPropertySet -Value $response -Names @(
        'acknowledged', 'runtimeReleaseId', 'runtimeReleaseDigest', 'sourceCommitSha',
        'exactTreeSha', 'revoked', 'sourceCurrent', 'executionPreflightMayProceed'
    ) -FailureCode 'runtime_status_response_shape'
    if ([string]$response.runtimeReleaseId -notmatch '^[0-9a-fA-F-]{36}$' -or
        [string]$response.runtimeReleaseDigest -notmatch '^[0-9a-f]{64}$' -or
        [string]$response.sourceCommitSha -notmatch '^[0-9a-f]{40}$' -or
        [string]$response.exactTreeSha -notmatch '^[0-9a-f]{40}$' -or
        $response.acknowledged -isnot [bool] -or $response.revoked -isnot [bool] -or
        $response.sourceCurrent -isnot [bool] -or $response.executionPreflightMayProceed -isnot [bool]) {
        Fail-Safe 'runtime_status_invalid'
    }
    return $response
}

# BEGIN COORDINATION_RUNTIME_BOOTSTRAP_BOUNDARY
function Initialize-HolaCoordinatorRuntime {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidatePattern('^https://')]
        [string]$Endpoint
    )
    $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $mutexName = 'Local\HolaHola-CoordinatorV2-RuntimeBootstrap-' + $currentSid
    $runtimeMutex = New-Object -TypeName System.Threading.Mutex -ArgumentList @($false, $mutexName)
    $mutexAcquired = $false
    $identity = $null
    try {
        $mutexAcquired = $runtimeMutex.WaitOne(0)
        if (-not $mutexAcquired) { Fail-Safe 'runtime_bootstrap_busy' }
        Assert-EnrollmentHost
        Assert-NoReparse -Path $ApprovedWorktree
        Assert-SidAcl -Path $ApprovedWorktree
        $endpointBase = $Endpoint.TrimEnd('/')
        New-Item -ItemType Directory -Path $RuntimeBootstrapRoot -Force | Out-Null
        Assert-SidAcl -Path $RuntimeBootstrapRoot
        $identity = Get-HostBootstrapIdentity
        if ([string]$identity.endpoint -ne $endpointBase) { Fail-Safe 'runtime_endpoint_mismatch' }
        $requestState = $null
        $installedBaseline = $null
        $reuseInstalledGeneration = $false
        if ([IO.File]::Exists($RuntimeRequestPath)) {
            $requestState = Read-DpapiJson -Path $RuntimeRequestPath -FailureCode 'runtime_request_corrupted'
            Assert-ExactPropertySet -Value $requestState -Names @(
                'endpoint', 'requestKey', 'issueId', 'manifest', 'installed',
                'ackPayload', 'ackSignature'
            ) -FailureCode 'runtime_request_shape'
            if ([string]$requestState.endpoint -ne $endpointBase -or
                [string]$requestState.requestKey -notmatch '^[0-9a-fA-F-]{36}$') {
                Fail-Safe 'runtime_request_authority_corrupted'
            }
            if ([bool]$requestState.installed -and
                -not [string]::IsNullOrWhiteSpace([string]$requestState.issueId)) {
                try {
                    $savedExpiry = [DateTime]::Parse(
                        [string]$requestState.manifest.payload.expiresAt).ToUniversalTime()
                } catch {
                    Fail-Safe 'runtime_request_manifest_corrupted'
                }
                if ($savedExpiry -le [DateTime]::UtcNow) {
                    $installedBaseline = $requestState.manifest
                    # The old issue is expired, but the already-installed
                    # generation remains eligible only after full local proof.
                    Assert-FullyInstalledRuntimeGeneration -Manifest $installedBaseline `
                        -EnvelopePath $RuntimeManifest -AllowExpired
                    $requestState = [ordered]@{
                        endpoint = $endpointBase
                        requestKey = [Guid]::NewGuid().ToString()
                        issueId = ''
                        manifest = $null
                        installed = $true
                        ackPayload = $null
                        ackSignature = ''
                    }
                    $reuseInstalledGeneration = $true
                    Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
                }
            } elseif (-not [bool]$requestState.installed -and
                -not [string]::IsNullOrWhiteSpace([string]$requestState.issueId)) {
                try {
                    $savedExpiry = [DateTime]::Parse(
                        [string]$requestState.manifest.payload.expiresAt).ToUniversalTime()
                } catch {
                    Fail-Safe 'runtime_request_manifest_corrupted'
                }
                if ($savedExpiry -le [DateTime]::UtcNow) {
                    $expiredStage = Join-Path $ApprovedWorktree (
                        '.runtime-bootstrap-staging-' + [string]$requestState.issueId)
                    if ([IO.Directory]::Exists($expiredStage)) {
                        Assert-PrivatePath -Path $expiredStage -Root $ApprovedWorktree
                        Remove-Item -LiteralPath $expiredStage -Recurse -Force -ErrorAction Stop
                    }
                    # An expired issue can never authorize its staged bytes.
                    # Rotate the request key and persist it before issuing again.
                    $requestState = [ordered]@{
                        endpoint = $endpointBase
                        requestKey = [Guid]::NewGuid().ToString()
                        issueId = ''
                        manifest = $null
                        installed = $false
                        ackPayload = $null
                        ackSignature = ''
                    }
                    Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
                }
            }
        } else {
            if ([IO.File]::Exists($RuntimeAckPath)) {
                $existingAck = Read-DpapiJson -Path $RuntimeAckPath -FailureCode 'runtime_ack_corrupted'
                Assert-ExactPropertySet -Value $existingAck -Names @(
                    'runtimeReleaseId', 'manifestDigest', 'sourceCommitSha', 'exactTreeSha',
                    'status', 'credentialProtected'
                ) -FailureCode 'runtime_ack_shape'
            }
            $requestState = [ordered]@{
                endpoint = $endpointBase
                requestKey = [Guid]::NewGuid().ToString()
                issueId = ''
                manifest = $null
                installed = $false
                ackPayload = $null
                ackSignature = ''
            }
            # This is deliberately before the first network request.
            Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
        }
        if ([string]::IsNullOrWhiteSpace([string]$requestState.issueId)) {
            $issuePath = '/api/coordination/v2/host/runtime-bootstrap/issues'
            $issueBody = ([ordered]@{
                requestKey = [string]$requestState.requestKey
                protocolVersion = 1
            } | ConvertTo-Json -Compress)
            $issueResponse = Invoke-HostAuthenticatedRequest -Method 'POST' -Endpoint $endpointBase `
                -Path $issuePath -Identity $identity -Body $issueBody
            Assert-RuntimeManifestShape -Envelope $issueResponse
            if ([string]$issueResponse.payload.hostKeyFingerprint -cne [string]$identity.fingerprint) {
                Fail-Safe 'runtime_manifest_binding_invalid'
            }
            $requestState.issueId = [string]$issueResponse.payload.issueId
            $requestState.manifest = $issueResponse
            Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
            if ($reuseInstalledGeneration) {
                if (Test-RuntimeGenerationEvidenceEquivalent -First $installedBaseline -Second $issueResponse) {
                    $candidateEnvelope = Join-Path $RuntimeBootstrapRoot (
                        'runtime-bootstrap-candidate-' + [Guid]::NewGuid().ToString('N') + '.json')
                    try {
                        $candidateJson = $issueResponse | ConvertTo-Json -Depth 30 -Compress
                        $candidateBytes = [Text.Encoding]::UTF8.GetBytes($candidateJson)
                        $candidateStream = New-Object -TypeName IO.FileStream -ArgumentList @(
                            $candidateEnvelope, [IO.FileMode]::CreateNew,
                            [IO.FileAccess]::Write, [IO.FileShare]::None)
                        try {
                            $candidateStream.Write($candidateBytes, 0, $candidateBytes.Length)
                            $candidateStream.Flush($true)
                        } finally {
                            $candidateStream.Dispose()
                        }
                        Assert-NoReparse -Path $candidateEnvelope
                        Assert-SidAcl -Path $candidateEnvelope
                        Assert-FullyInstalledRuntimeGeneration -Manifest $issueResponse `
                            -EnvelopePath $candidateEnvelope
                        Write-InstalledManifestAtomic -Path $RuntimeManifest -Manifest $issueResponse
                    } finally {
                        if ([IO.File]::Exists($candidateEnvelope)) {
                            Remove-Item -LiteralPath $candidateEnvelope -Force -ErrorAction SilentlyContinue
                        }
                    }
                } else {
                    # A fresh issue naming different evidence cannot reuse the
                    # old bytes; fall through to a clean staged installation.
                    $requestState.installed = $false
                    $requestState.ackPayload = $null
                    $requestState.ackSignature = ''
                    Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
                }
            }
        }
        $manifest = $requestState.manifest
        Assert-RuntimeManifestShape -Envelope $manifest
        if ([string]$manifest.payload.hostKeyFingerprint -cne [string]$identity.fingerprint) {
            Fail-Safe 'runtime_manifest_host_binding_invalid'
        }
        $requestKeyDigest = ([Security.Cryptography.SHA256]::Create().ComputeHash(
            [Text.Encoding]::UTF8.GetBytes([string]$requestState.requestKey)) |
            ForEach-Object { $_.ToString('x2') }) -join ''
        if ($requestKeyDigest -cne [string]$manifest.payload.requestKeyDigest) {
            Fail-Safe 'runtime_manifest_request_binding_invalid'
        }
        $manifestCanonical = ConvertTo-CanonicalJson -Value $manifest.payload
        $manifestDigest = ([Security.Cryptography.SHA256]::Create().ComputeHash(
            [Text.Encoding]::UTF8.GetBytes($manifestCanonical)) |
            ForEach-Object { $_.ToString('x2') }) -join ''
        if ($manifestDigest -cne [string]$manifest.canonicalResponseDigest) {
            Fail-Safe 'runtime_manifest_digest_invalid'
        }
        $stageRoot = Join-Path $ApprovedWorktree ('.runtime-bootstrap-staging-' + [string]$requestState.issueId)
        Assert-SafePath -Path $stageRoot -Root $ApprovedWorktree | Out-Null
        if (-not [bool]$requestState.installed) {
            if ([IO.Directory]::Exists($stageRoot)) {
                Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction Stop
            }
            New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
            Assert-PrivatePath -Path $stageRoot -Root $ApprovedWorktree
            $envelopePath = Join-Path $stageRoot 'manifest-envelope.json'
            [IO.File]::WriteAllText($envelopePath, ($manifest | ConvertTo-Json -Depth 30 -Compress),
                (New-Object Text.UTF8Encoding($false)))
            Assert-NoReparse -Path $envelopePath
            # Download only the PE bootstrap artifact first.  Authenticode and
            # the signed manifest are proven before any staged JavaScript is
            # loaded or evaluated by this command.
            $nodeArtifact = Get-ManifestArtifact -Manifest $manifest -Role 'node_executable'
            Download-RuntimeArtifact -Artifact $nodeArtifact -Endpoint $endpointBase `
                -IssueId ([string]$requestState.issueId) -StageRoot $stageRoot -Identity $identity
            $stagedNode = Join-Path $stageRoot (Assert-ManifestPath -Path ([string]$nodeArtifact.fixedDestination) `
                -FailureCode 'runtime_destination_invalid')
            Assert-ApprovedSignatureAndDigest -Path $stagedNode
            $nodeForVerification = $stagedNode
            Invoke-PinnedManifestVerifier -NodePath $nodeForVerification -EnvelopePath $envelopePath `
                -ExpectedHostEnrollmentId ([string]$manifest.payload.hostEnrollmentId) `
                -StageRoot $stageRoot -VerifyStagedFiles $false
            foreach ($artifact in @($manifest.payload.artifacts)) {
                if ([string]$artifact.role -cne 'node_executable') {
                    Download-RuntimeArtifact -Artifact $artifact -Endpoint $endpointBase `
                        -IssueId ([string]$requestState.issueId) -StageRoot $stageRoot -Identity $identity
                }
            }
            Invoke-PinnedManifestVerifier -NodePath $stagedNode -EnvelopePath $envelopePath `
                -ExpectedHostEnrollmentId ([string]$manifest.payload.hostEnrollmentId) `
                -StageRoot $stageRoot -VerifyStagedFiles $true
            Install-RuntimeGenerationAtomic -StageRoot $stageRoot
            Write-InstalledManifestAtomic -Path $RuntimeManifest -Manifest $manifest
            $requestState.installed = $true
            Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
        }
        # Never sign or submit an acknowledgement until the installed
        # generation has been re-proven from the persisted signed envelope.
        Assert-FullyInstalledRuntimeGeneration -Manifest $manifest -EnvelopePath $RuntimeManifest
        if ($null -eq $requestState.ackPayload -or
            [string]::IsNullOrWhiteSpace([string]$requestState.ackSignature)) {
            Assert-PrivatePath -Path $RuntimeNode -Root $ApprovedWorktree
            Assert-PrivatePath -Path $RuntimeTsxRoot -Root $ApprovedWorktree
            $sourceEvidence = Get-RuntimeSourceEvidence -Manifest $manifest
            $nodeDigest = (Get-FileHash -LiteralPath $RuntimeNode -Algorithm SHA256).Hash.ToLowerInvariant()
            $localEvidence = [ordered]@{
                nodePath = 'runtime\node.exe'
                nodeSha256 = $nodeDigest
                sourceMembers = $sourceEvidence
                installedManifestDigest = [string]$manifest.canonicalResponseDigest
            }
            $evidenceDigest = ([Security.Cryptography.SHA256]::Create().ComputeHash(
                [Text.Encoding]::UTF8.GetBytes((ConvertTo-CanonicalJson -Value $localEvidence))) |
                ForEach-Object { $_.ToString('x2') }) -join ''
            $ackPayload = [ordered]@{
                protocolVersion = 1
                issueId = [string]$requestState.issueId
                requestKey = [string]$requestState.requestKey
                runtimeReleaseId = [string]$manifest.payload.runtimeReleaseId
                manifestDigest = [string]$manifest.canonicalResponseDigest
                localEvidenceDigest = $evidenceDigest
            }
            $ackCanonical = ConvertTo-CanonicalJson -Value $ackPayload
            $ackSignature = [Convert]::ToBase64String($identity.rsa.SignData(
                [Text.Encoding]::UTF8.GetBytes($ackCanonical),
                [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256')))
            $requestState.ackPayload = $ackPayload
            $requestState.ackSignature = $ackSignature
            # Persist the exact signed retry authority before submitting it.
            Write-DpapiJsonAtomic -Path $RuntimeRequestPath -Value $requestState
        }
        $ackPath = '/api/coordination/v2/host/runtime-bootstrap/issues/' +
            [Uri]::EscapeDataString([string]$requestState.issueId) + '/acknowledge'
        $ackBody = ([ordered]@{
            payload = $requestState.ackPayload
            signature = [string]$requestState.ackSignature
        } | ConvertTo-Json -Depth 20 -Compress)
        $ackResponse = Invoke-HostAuthenticatedRequest -Method 'POST' -Endpoint $endpointBase `
            -Path $ackPath -Identity $identity -Body $ackBody
        $confirmed = Get-RuntimeAcknowledgementResponse -Response $ackResponse
        $ackState = [ordered]@{
            runtimeReleaseId = [string]$manifest.payload.runtimeReleaseId
            manifestDigest = [string]$manifest.canonicalResponseDigest
            sourceCommitSha = [string]$manifest.payload.promotedCommitSha
            exactTreeSha = [string]$manifest.payload.exactTreeSha
            status = 'acknowledged'
            credentialProtected = $true
        }
        Write-DpapiJsonAtomic -Path $RuntimeAckPath -Value $ackState
        Remove-Item -LiteralPath $RuntimeRequestPath -Force -ErrorAction SilentlyContinue
        if ([IO.Directory]::Exists($stageRoot)) {
            Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
        return $ackState
    } catch {
        if ($_.Exception.Message -match '^hola_coordinator_') { throw }
        Fail-Safe 'runtime_bootstrap_failed'
    } finally {
        if ($null -ne $identity -and $null -ne $identity.rsa) { $identity.rsa.Dispose() }
        if ($mutexAcquired) { $runtimeMutex.ReleaseMutex() }
        $runtimeMutex.Dispose()
    }
}
# END COORDINATION_RUNTIME_BOOTSTRAP_BOUNDARY

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
    $isInvalidPayload = ($null -eq $payload) -or ($payload -is [System.Array]) -or ($payload -isnot [PSCustomObject])
    if ($isInvalidPayload) { return $false }
    if ($payload.state -isnot [string] -or $safeStates -notcontains $payload.state) {
        return $false
    }
    if ($payload.cleanupAcknowledged -isnot [bool]) { return $false }
    $propertyNames = @($payload.PSObject.Properties | ForEach-Object { $_.Name })
    return $propertyNames.Count -eq 2 `
        -and $propertyNames -contains 'state' `
        -and $propertyNames -contains 'cleanupAcknowledged'
}

function Assert-EnrollmentHost {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { Fail-Safe 'windows_required' }
    if ($PSVersionTable.PSVersion.Major -lt 5 -or
        ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -lt 1)) {
        Fail-Safe 'powershell_5_1_required'
    }
    if (-not [System.IO.File]::Exists($CoordinatorScript)) { Fail-Safe 'coordinator_script_missing' }
    if (-not [System.IO.Directory]::Exists($ApprovedWorktree)) { Fail-Safe 'approved_worktree_missing' }
    if ($null -eq ('System.Security.Cryptography.ProtectedData' -as [type])) {
        Fail-Safe 'dpapi_current_user_unavailable'
    }
    if ($null -eq $CurrentUserScope -or $CurrentUserScope.ToString() -ne 'CurrentUser') {
        Fail-Safe 'dpapi_scope'
    }
    Assert-NoReparse -Path $ApprovedWorktree
    Assert-NoReparse -Path $LauncherPath
    Assert-NoReparse -Path $CoordinatorScript
    Assert-ReadablePrivateAcl -Path $ApprovedWorktree
    Assert-ReadablePrivateAcl -Path $LauncherPath
    Assert-ReadablePrivateAcl -Path $CoordinatorScript
    Assert-ApprovedRepository
    Assert-ApprovedDigest -Path $LauncherPath
    Assert-ApprovedDigest -Path $CoordinatorScript
}

function Assert-ExecutionHost {
    Assert-EnrollmentHost
    $script:ApprovedNode = Resolve-ApprovedNode
    if (-not [System.IO.File]::Exists($ApprovedNode)) { Fail-Safe 'approved_node_missing' }
    if (-not [System.IO.File]::Exists($ApprovedTsx) -or
        -not [System.IO.Directory]::Exists($RuntimeTsxRoot)) { Fail-Safe 'approved_tsx_missing' }
    Assert-NoReparse -Path $ApprovedNode
    Assert-NoReparse -Path $RuntimeTsxRoot
    Assert-NoReparse -Path $ApprovedTsx
    Assert-ReadablePrivateAcl -Path $ApprovedNode
    Assert-SidAcl -Path $ApprovedNode
    Assert-SidAcl -Path $RuntimeTsxRoot
    Assert-ApprovedSignatureAndDigest -Path $ApprovedNode
    # The tsx closure and all non-PE source files are authorized by exact
    # signed-manifest membership and hashes, never by Authenticode.
    if (-not [IO.File]::Exists($PinnedServerPublicKey)) { Fail-Safe 'runtime_public_key_missing' }
    Assert-NoReparse -Path $PinnedServerPublicKey
    Assert-SidAcl -Path $PinnedServerPublicKey
    $manifest = Get-InstalledRuntimeManifest
    Assert-InstalledArtifactMembership -Manifest $manifest
    $ack = Read-DpapiJson -Path $RuntimeAckPath -FailureCode 'runtime_ack_missing'
    Assert-ExactPropertySet -Value $ack -Names @(
        'runtimeReleaseId', 'manifestDigest', 'sourceCommitSha', 'exactTreeSha',
        'status', 'credentialProtected'
    ) -FailureCode 'runtime_ack_shape'
    if ([string]$ack.status -cne 'acknowledged' -or $ack.credentialProtected -isnot [bool] -or
        -not $ack.credentialProtected -or
        [string]$ack.runtimeReleaseId -cne [string]$manifest.payload.runtimeReleaseId -or
        [string]$ack.manifestDigest -cne [string]$manifest.canonicalResponseDigest -or
        [string]$ack.sourceCommitSha -cne [string]$manifest.payload.promotedCommitSha -or
        [string]$ack.exactTreeSha -cne [string]$manifest.payload.exactTreeSha) {
        Fail-Safe 'runtime_ack_binding_invalid'
    }
    Assert-SourceMemberHash -Manifest $manifest -FixedPath 'scripts\hola-coordinator.ps1'
    Assert-SourceMemberHash -Manifest $manifest -FixedPath 'scripts\coordination-v2-server-signing-public.pem'
    Assert-SourceMemberHash -Manifest $manifest -FixedPath 'server\scripts\coordination-v2-cli.ts'
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $git) { Fail-Safe 'git_missing' }
    $head = [string](& $git.Source -C $ApprovedWorktree rev-parse HEAD 2>$null)
    $tree = [string](& $git.Source -C $ApprovedWorktree rev-parse HEAD^{tree} 2>$null)
    if ($LASTEXITCODE -ne 0 -or $head.ToLowerInvariant() -cne [string]$manifest.payload.promotedCommitSha -or
        $tree.ToLowerInvariant() -cne [string]$manifest.payload.exactTreeSha) {
        Fail-Safe 'runtime_source_checkout_invalid'
    }
    $identity = Get-HostBootstrapIdentity
    try {
        $status = Get-ServerRuntimeStatus -Identity $identity
        if (-not $status.acknowledged -or $status.revoked -or
            -not $status.sourceCurrent -or -not $status.executionPreflightMayProceed -or
            [string]$status.runtimeReleaseId -cne [string]$ack.runtimeReleaseId -or
            [string]$status.runtimeReleaseDigest -cne [string]$manifest.payload.runtimeReleaseDigest -or
            [string]$status.sourceCommitSha -cne [string]$ack.sourceCommitSha -or
            [string]$status.exactTreeSha -cne [string]$ack.exactTreeSha) {
            Fail-Safe 'runtime_server_status_invalid'
        }
    } finally {
        $identity.rsa.Dispose()
    }
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

    Assert-ExecutionHost
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
    Assert-EnrollmentHost
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
            $challengeProperty = $status.PSObject.Properties['challenge']
            if ($null -ne $challengeProperty -and $null -ne $challengeProperty.Value) {
                $challenge = $challengeProperty.Value
                if ($challenge -isnot [PSCustomObject] -or
                    [string]$challenge.id -notmatch '^[0-9a-fA-F-]{36}$' -or
                    [string]::IsNullOrWhiteSpace([string]$challenge.nonce) -or
                    [string]::IsNullOrWhiteSpace([string]$challenge.expiresAt)) {
                    Fail-Safe 'host_challenge_invalid'
                }
                $signature = $rsa.SignData([Text.Encoding]::UTF8.GetBytes([string]$challenge.nonce), [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
                $proof = @{ challengeId = $challenge.id; nonce = $challenge.nonce; signature = [Convert]::ToBase64String($signature) } | ConvertTo-Json -Compress
                $issued = Invoke-RestMethod -Method Post -Uri ($endpointBase + '/api/coordination/v2/host-enrollment-requests/' + $requestState.requestId + '/proof') `
                    -ContentType 'application/json' -Body $proof -UseBasicParsing
                if ([string]$issued.accessToken -notmatch '^v2h_[A-Za-z0-9_-]{32,}$') {
                    Fail-Safe 'host_credential_invalid'
                }
                $credentialProperty = $issued.PSObject.Properties['credential']
                $issuedExpiry = if ($null -ne $credentialProperty -and $null -ne $credentialProperty.Value) {
                    [string]$credentialProperty.Value.expiresAt
                } else {
                    [string]$issued.expiresAt
                }
                if ($issuedExpiry -notmatch '^\d{4}-\d{2}-\d{2}T') {
                    Fail-Safe 'host_credential_expiry_invalid'
                }
                if ([DateTime]::Parse($issuedExpiry).ToUniversalTime() -le [DateTime]::UtcNow) {
                    Fail-Safe 'host_credential_expiry_invalid'
                }
                $material = [ordered]@{
                    endpoint = $endpointBase; accessToken = [string]$issued.accessToken
                    expiresAt = $issuedExpiry
                } | ConvertTo-Json -Compress
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

# BEGIN COORDINATION_REAUTHORIZATION_BOUNDARY
function New-InternalHolaCoordinatorReauthorizationDeclaration {
    param(
        [Parameter(Mandatory = $true)][string]$RequestKey,
        [Parameter(Mandatory = $true)][string]$HostId,
        [Parameter(Mandatory = $true)][string]$Fingerprint,
        [Parameter(Mandatory = $true)][int]$Generation,
        [DateTime]$Now = [DateTime]::UtcNow
    )
    $capturedAt = $Now.ToUniversalTime()
    return [ordered]@{
        kind = 'host_credential_reauthorization'
        requestKey = $RequestKey
        issuedAt = $capturedAt.ToString('o')
        expiresAt = $capturedAt.AddHours(1).ToString('o')
        protocolVersion = 1
        hostId = $HostId
        keyFingerprint = $Fingerprint
        requestGeneration = $Generation
    }
}

function Test-InternalHolaCoordinatorLegacyTwoClockRequest {
    param(
        [Parameter(Mandatory = $true)]$State,
        [Parameter(Mandatory = $true)]
        [Security.Cryptography.RSACryptoServiceProvider]$Rsa,
        [Parameter(Mandatory = $true)][string]$HostId,
        [Parameter(Mandatory = $true)][string]$Fingerprint,
        [DateTime]$Now = [DateTime]::UtcNow
    )
    $hashAlgorithm = $null
    try {
        if (-not [string]::IsNullOrWhiteSpace([string]$State.requestId) -or
            [bool]$State.terminal -or [bool]$State.completionAmbiguous) {
            return $false
        }
        $body = [string]$State.body | ConvertFrom-Json
        if ((@(Get-PropertyNames -Value $body | Sort-Object) -join ',') -cne
            'declaration,keyFingerprint,publicKey,signature') {
            return $false
        }
        $declaration = $body.declaration
        if ((@(Get-PropertyNames -Value $declaration | Sort-Object) -join ',') -cne
            'expiresAt,hostId,issuedAt,keyFingerprint,kind,protocolVersion,requestGeneration,requestKey') {
            return $false
        }
        if ([string]$declaration.kind -cne 'host_credential_reauthorization' -or
            [string]$declaration.requestKey -cne [string]$State.requestKey -or
            [string]$declaration.hostId -cne $HostId -or
            [string]$declaration.keyFingerprint -cne $Fingerprint -or
            [string]$body.keyFingerprint -cne $Fingerprint -or
            [int]$declaration.protocolVersion -ne 1 -or
            [int]$declaration.requestGeneration -ne [int]$State.generation) {
            return $false
        }
        $canonicalDeclaration = ConvertTo-CanonicalJson -Value $declaration
        if ($canonicalDeclaration -cne (ConvertTo-CanonicalJson -Value $State.declaration)) {
            return $false
        }
        $issuedAt = [DateTime]::Parse([string]$declaration.issuedAt).ToUniversalTime()
        $expiresAt = [DateTime]::Parse([string]$declaration.expiresAt).ToUniversalTime()
        $signedLifetimeMs = ($expiresAt - $issuedAt).TotalMilliseconds
        if ($signedLifetimeMs -le 3600000 -or $signedLifetimeMs -gt 3660000 -or
            $expiresAt -ge $Now.ToUniversalTime()) {
            return $false
        }
        $publicKeyValue = [string]$body.publicKey | ConvertFrom-Json
        if ((@(Get-PropertyNames -Value $publicKeyValue | Sort-Object) -join ',') -cne 'e,kty,n' -or
            [string]$publicKeyValue.kty -cne 'RSA') {
            return $false
        }
        $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
        $publicKeyDigest = -join @($hashAlgorithm.ComputeHash(
            [Text.Encoding]::UTF8.GetBytes((ConvertTo-CanonicalJson -Value $publicKeyValue))) |
            ForEach-Object { $_.ToString('x2') })
        if ($publicKeyDigest -cne $Fingerprint -or
            (Get-RsaFingerprint -Rsa $Rsa) -cne $Fingerprint) {
            return $false
        }
        $signature = [Convert]::FromBase64String([string]$body.signature)
        return [bool]$Rsa.VerifyData(
            [Text.Encoding]::UTF8.GetBytes($canonicalDeclaration),
            [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'),
            $signature)
    } catch {
        return $false
    } finally {
        if ($null -ne $hashAlgorithm) { $hashAlgorithm.Dispose() }
    }
}

function Restore-HolaCoordinatorHostCredential {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidatePattern('^https://')]
        [string]$Endpoint
    )
    # This is deliberately a separate lifecycle.  It never invokes the
    # initializer or coordinator, and accepts no caller-supplied identity.
    $root = $RuntimeBootstrapRoot
    $materialPath = Join-Path $root 'host-material.dpapi'
    $privatePath = Join-Path $root 'host-private-key.dpapi'
    $requestPath = Join-Path $root 'host-reauthorization-request.dpapi'
    Assert-SafePath -Path $root -Root (Join-Path $env:LOCALAPPDATA 'HolaHola') | Out-Null
    Assert-NoReparse -Path $root
    Assert-SidAcl -Path $root
    if (-not [IO.File]::Exists($materialPath) -or -not [IO.File]::Exists($privatePath)) {
        Fail-Safe 'host_credential_missing'
    }
    $material = Read-DpapiJson -Path $materialPath -FailureCode 'host_credential_corrupted'
    $materialNames = @(Get-PropertyNames -Value $material)
    if ($materialNames.Count -ne 2 -or $materialNames -notcontains 'endpoint' -or
        $materialNames -notcontains 'accessToken') {
        # A completed three-field record is runtime authority, not recovery
        # input.  Recovery cannot overwrite it without a new explicit request.
        if ($materialNames.Count -eq 3) { Fail-Safe 'host_credential_reauthorization_not_required' }
        Fail-Safe 'host_credential_shape'
    }
    if ([string]$material.endpoint -notmatch '^https://') { Fail-Safe 'host_endpoint_invalid' }
    if ([string]$material.accessToken -notmatch '^v2h_[A-Za-z0-9_-]{32,}$') {
        Fail-Safe 'host_credential_invalid'
    }
    $endpointBase = $Endpoint.TrimEnd('/')
    if ([string]$material.endpoint -ne $endpointBase) { Fail-Safe 'runtime_endpoint_mismatch' }
    $privateXml = [Text.Encoding]::UTF8.GetString(
        [Security.Cryptography.ProtectedData]::Unprotect(
            [Convert]::FromBase64String([IO.File]::ReadAllText($privatePath)),
            $null, $CurrentUserScope))
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
    try {
        $rsa.FromXmlString($privateXml)
        $fingerprint = Get-RsaFingerprint -Rsa $rsa
        $hostId = [Environment]::MachineName
        $state = $null
        if ([IO.File]::Exists($requestPath)) {
            $state = Read-DpapiJson -Path $requestPath -FailureCode 'host_reauthorization_state_corrupted'
            Assert-ExactPropertySet -Value $state -Names @(
                'endpoint', 'requestKey', 'requestId', 'generation', 'hostId',
                'fingerprint', 'declaration', 'body', 'terminal', 'completionAmbiguous'
            ) -FailureCode 'host_reauthorization_state_shape'
            if ([string]$state.endpoint -ne $endpointBase -or
                [string]$state.hostId -ne $hostId -or [string]$state.fingerprint -ne $fingerprint) {
                Fail-Safe 'host_reauthorization_state_mismatch'
            }
            if (Test-InternalHolaCoordinatorLegacyTwoClockRequest -State $state -Rsa $rsa `
                -HostId $hostId -Fingerprint $fingerprint -Now ([DateTime]::UtcNow)) {
                # The legacy request can never pass the protocol's exact
                # one-hour TTL check. Preserve it as terminal before rollover.
                $state.terminal = $true
                Write-DpapiJsonAtomic -Path $requestPath -Value $state
            }
        } else {
            $requestKey = [Guid]::NewGuid().ToString()
            $declaration = New-InternalHolaCoordinatorReauthorizationDeclaration `
                -RequestKey $requestKey -HostId $hostId -Fingerprint $fingerprint -Generation 1
            $parameters = $rsa.ExportParameters($false)
            $b64url = {
                param([byte[]]$Bytes)
                ([Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_'))
            }
            $publicKey = [ordered]@{
                kty = 'RSA'; n = & $b64url $parameters.Modulus; e = & $b64url $parameters.Exponent
            }
            $canonicalDeclaration = ConvertTo-CanonicalJson -Value $declaration
            $signature = $rsa.SignData([Text.Encoding]::UTF8.GetBytes($canonicalDeclaration),
                [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
            $bodyObject = [ordered]@{
                declaration = $declaration
                publicKey = ($publicKey | ConvertTo-Json -Compress)
                keyFingerprint = $fingerprint
                signature = [Convert]::ToBase64String($signature)
            }
            $state = [ordered]@{
                endpoint = $endpointBase; requestKey = $requestKey; requestId = ''
                generation = 1; hostId = $hostId; fingerprint = $fingerprint
                terminal = $false; completionAmbiguous = $false
                declaration = $declaration
                body = ($bodyObject | ConvertTo-Json -Depth 8 -Compress)
            }
            # Persist request authority, including the exact generation, before
            # the first network call.  No decrypted material is emitted.
            Write-DpapiJsonAtomic -Path $requestPath -Value $state
        }
        if ([bool]$state.terminal) {
            $nextGeneration = [int]$state.generation + 1
            if ($nextGeneration -le 0) { Fail-Safe 'host_reauthorization_generation_invalid' }
            $requestKey = [Guid]::NewGuid().ToString()
            $declaration = New-InternalHolaCoordinatorReauthorizationDeclaration `
                -RequestKey $requestKey -HostId $hostId -Fingerprint $fingerprint `
                -Generation $nextGeneration
            $oldBody = [string]$state.body | ConvertFrom-Json
            $signature = $rsa.SignData([Text.Encoding]::UTF8.GetBytes(
                (ConvertTo-CanonicalJson -Value $declaration)),
                [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
            $bodyObject = [ordered]@{
                declaration = $declaration
                publicKey = [string]$oldBody.publicKey; keyFingerprint = $fingerprint
                signature = [Convert]::ToBase64String($signature)
            }
            $state = [ordered]@{
                endpoint = $endpointBase; requestKey = $requestKey; requestId = ''
                generation = $nextGeneration; hostId = $hostId; fingerprint = $fingerprint
                declaration = $declaration; terminal = $false; completionAmbiguous = $false
                body = ($bodyObject | ConvertTo-Json -Depth 8 -Compress)
            }
            Write-DpapiJsonAtomic -Path $requestPath -Value $state
        }
        if ([string]::IsNullOrWhiteSpace([string]$state.requestId)) {
            try {
                $request = Invoke-RestMethod -Method Post -Uri (
                $endpointBase + '/api/coordination/v2/host/reauthorization-requests') `
                -ContentType 'application/json' -Body ([string]$state.body) -UseBasicParsing `
                -MaximumRedirection 0 -ErrorAction Stop
            } catch { Fail-Safe 'host_reauthorization_transport' }
            Assert-ExactPropertySet -Value $request -Names @(
                'requestId', 'status', 'approvalUrl'
            ) -FailureCode 'host_reauthorization_response_shape'
            Assert-StrictUuid -Value ([string]$request.requestId) -FailureCode 'host_reauthorization_response_invalid'
            if ([string]$request.status -notin @('pending', 'approved')) {
                Fail-Safe 'host_reauthorization_status_invalid'
            }
            $expectedApprovalPath = '/coordination/v2/host-reauthorization-approval?requestId=' +
                [Uri]::EscapeDataString([string]$request.requestId)
            if ([string]$request.approvalUrl -cne $expectedApprovalPath) {
                Fail-Safe 'host_reauthorization_approval_url_invalid'
            }
            $approvalUrl = $endpointBase + $expectedApprovalPath
            $state.requestId = [string]$request.requestId
            Write-DpapiJsonAtomic -Path $requestPath -Value $state
            return [ordered]@{
                requestId = [string]$state.requestId; generation = [int]$state.generation
                status = [string]$request.status; approvalUrl = $approvalUrl
                fingerprint = [string]$state.fingerprint
            }
        }
        try {
            $status = Invoke-RestMethod -Method Get -Uri (
            $endpointBase + '/api/coordination/v2/host/reauthorization-requests/' +
                [Uri]::EscapeDataString([string]$state.requestId) + '/status') `
                -Headers @{ 'x-hola-reauthorization-key' = [string]$state.requestKey } -UseBasicParsing `
            -MaximumRedirection 0 -ErrorAction Stop
        } catch { Fail-Safe 'host_reauthorization_transport' }
        Assert-StrictUuid -Value ([string]$status.requestId) -FailureCode 'host_reauthorization_status_invalid'
        if ([string]$status.requestId -ne [string]$state.requestId) {
            Fail-Safe 'host_reauthorization_status_mismatch'
        }
        if ([string]$status.status -ne 'approved') {
            Assert-ExactPropertySet -Value $status -Names @('requestId', 'status') `
                -FailureCode 'host_reauthorization_status_shape'
            if ([string]$status.status -notin @('pending', 'challenge_unavailable', 'completed', 'expired', 'rejected')) {
                Fail-Safe 'host_reauthorization_status_invalid'
            }
            if ([string]$status.status -in @('completed', 'expired', 'rejected')) {
                $state.terminal = $true
                Write-DpapiJsonAtomic -Path $requestPath -Value $state
            }
            return [ordered]@{
                requestId = [string]$state.requestId; generation = [int]$state.generation
                status = [string]$status.status; fingerprint = [string]$state.fingerprint
            }
        }
        Assert-ExactPropertySet -Value $status -Names @(
            'status', 'requestId', 'requestKey', 'challenge'
        ) -FailureCode 'host_reauthorization_status_shape'
        $challenge = $status.challenge
        Assert-ExactPropertySet -Value $challenge -Names @(
            'challengeId', 'nonce', 'issuedAt', 'expiresAt', 'requestId',
            'requestKey', 'hostEnrollmentId', 'keyFingerprint', 'protocolVersion',
            'requestGeneration'
        ) -FailureCode 'host_reauthorization_challenge_shape'
        if ([string]$status.requestKey -ne [string]$state.requestKey -or
            [string]$challenge.challengeId -notmatch '^[0-9a-fA-F-]{36}$' -or
            [string]$challenge.nonce -notmatch '^[A-Za-z0-9_-]{32,}$' -or
            [string]$challenge.hostEnrollmentId -notmatch '^[0-9a-fA-F-]{36}$' -or
            [string]$challenge.keyFingerprint -notmatch '^[0-9a-f]{64}$' -or
            [string]$challenge.issuedAt -notmatch '^\d{4}-\d{2}-\d{2}T' -or
            [string]$challenge.expiresAt -notmatch '^\d{4}-\d{2}-\d{2}T' -or
            [string]$challenge.requestId -ne [string]$state.requestId -or
            [string]$challenge.requestKey -ne [string]$state.requestKey -or
            [string]$challenge.keyFingerprint -ne $fingerprint -or
            [int]$challenge.protocolVersion -ne 1 -or
            [int]$challenge.requestGeneration -ne [int]$state.generation) {
            Fail-Safe 'host_reauthorization_challenge_mismatch'
        }
        try {
            $challengeIssued = [DateTime]::Parse([string]$challenge.issuedAt).ToUniversalTime()
            $challengeExpires = [DateTime]::Parse([string]$challenge.expiresAt).ToUniversalTime()
        } catch { Fail-Safe 'host_reauthorization_challenge_invalid' }
        if ($challengeExpires -le $challengeIssued -or
            $challengeExpires -gt $challengeIssued.AddMinutes(2) -or
            $challengeExpires -le [DateTime]::UtcNow) {
            Fail-Safe 'host_reauthorization_challenge_expired'
        }
        $challengeValue = [ordered]@{
            kind = 'host_credential_reauthorization_challenge'
            requestId = [string]$challenge.requestId; requestKey = [string]$challenge.requestKey
            challengeId = [string]$challenge.challengeId; nonce = [string]$challenge.nonce
            hostEnrollmentId = [string]$challenge.hostEnrollmentId
            keyFingerprint = [string]$challenge.keyFingerprint
            protocolVersion = [int]$challenge.protocolVersion
            requestGeneration = [int]$challenge.requestGeneration
            issuedAt = [string]$challenge.issuedAt; expiresAt = [string]$challenge.expiresAt
        }
        $proofSignature = $rsa.SignData([Text.Encoding]::UTF8.GetBytes(
            (ConvertTo-CanonicalJson -Value $challengeValue)),
            [Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'))
        $proof = [ordered]@{
            requestKey = [string]$state.requestKey
            challengeId = [string]$challenge.challengeId
            nonce = [string]$challenge.nonce
            signature = [Convert]::ToBase64String($proofSignature)
        } | ConvertTo-Json -Compress
        # A lost completion response is ambiguous because the token is
        # returned once. Mark completion ambiguous before networking so a
        # retry polls the same request rather than blindly repeating proof.
        $state.completionAmbiguous = $true
        Write-DpapiJsonAtomic -Path $requestPath -Value $state
        try {
            $issued = Invoke-RestMethod -Method Post -Uri (
            $endpointBase + '/api/coordination/v2/host/reauthorization-requests/' +
            [Uri]::EscapeDataString([string]$state.requestId) + '/proof') `
            -ContentType 'application/json' -Body $proof -UseBasicParsing `
            -MaximumRedirection 0 -ErrorAction Stop
        } catch { Fail-Safe 'host_reauthorization_transport' }
        Assert-ExactPropertySet -Value $issued -Names @('accessToken', 'expiresAt') `
            -FailureCode 'host_reauthorization_credential_shape'
        if ([string]$issued.accessToken -notmatch '^v2h_[A-Za-z0-9_-]{32,}$') {
            Fail-Safe 'host_credential_invalid'
        }
        $newMaterial = [ordered]@{
            endpoint = $endpointBase; accessToken = [string]$issued.accessToken
            expiresAt = [string]$issued.expiresAt
        }
        if ([DateTime]::Parse([string]$newMaterial.expiresAt).ToUniversalTime() -le [DateTime]::UtcNow) {
            Fail-Safe 'host_credential_expiry_invalid'
        }
        Write-DpapiJsonAtomic -Path $materialPath -Value $newMaterial
        $verified = Read-DpapiJson -Path $materialPath -FailureCode 'host_credential_replacement_corrupted'
        Assert-ExactPropertySet -Value $verified -Names @('endpoint', 'accessToken', 'expiresAt') `
            -FailureCode 'host_credential_replacement_shape'
        if ([string]$verified.endpoint -ne $endpointBase -or
            [string]$verified.accessToken -ne [string]$newMaterial.accessToken -or
            [string]$verified.expiresAt -ne [string]$newMaterial.expiresAt) {
            Fail-Safe 'host_credential_replacement_mismatch'
        }
        Remove-Item -LiteralPath $requestPath -Force -ErrorAction Stop
        return [ordered]@{
            requestId = [string]$state.requestId; generation = [int]$state.generation
            status = 'completed'; expiresAt = [string]$verified.expiresAt
            fingerprint = [string]$state.fingerprint
        }
    } finally {
        if ($null -ne $rsa) { $rsa.Dispose() }
    }
}
# END COORDINATION_REAUTHORIZATION_BOUNDARY

# No import-time lifecycle execution. Operators explicitly call
# Invoke-HolaCoordinator -TaskRef <task reference>.
