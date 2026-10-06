[CmdletBinding()]
param([switch]$SkipMutationChecks)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot 'hola-coordinator.ps1')

function Assert-Diagnostic {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

# Pure synthetic error objects: no DPAPI, key, filesystem or network operations.
$sentinel = 'SYNTHETIC_SECRET_NEVER_REPORT_75319'
function New-DiagnosticFixture {
    param($Status = 409, $Body = '', [switch]$StreamOnly, [switch]$BrokenStream)
    $response = [pscustomobject]@{ StatusCode = $Status; FixtureBody = $Body }
    if ($StreamOnly) {
        $response | Add-Member ScriptMethod GetResponseStream {
            return [IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes([string]$this.FixtureBody))
        }
    }
    if ($BrokenStream) {
        $response | Add-Member ScriptMethod GetResponseStream { throw 'SYNTHETIC_SECRET_NEVER_REPORT_75319' }
    }
    return [pscustomobject]@{
        Exception = [pscustomobject]@{ Response = $response; Message = $sentinel }
        ErrorDetails = [pscustomobject]@{ Message = $(if ($StreamOnly -or $BrokenStream) { '' } else { $Body }) }
    }
}

$cases = @(
    @{ body = '{"error":{"code":"V2_HOST_REAUTH_GENERATION_CONFLICT","message":"' + $sentinel + '"}}'
       reason = 'V2_HOST_REAUTH_GENERATION_CONFLICT' },
    @{ body = '{"error":{"code":"V2_HOST_REAUTH_PENDING_CONFLICT"},"accessToken":"' + $sentinel + '"}'
       reason = 'V2_HOST_REAUTH_PENDING_CONFLICT' },
    @{ body = '{"error":{"code":"V2_HOST_ENROLLMENT_REVOKED"}}'; reason = 'V2_HOST_ENROLLMENT_REVOKED' },
    @{ body = '{"error":{"code":"V2_HOST_FOUNDER_REQUIRED"}}'; reason = 'V2_HOST_FOUNDER_REQUIRED' },
    @{ body = '{"error":{"code":"V2_HOST_DATABASE_UNAVAILABLE"}}'; reason = 'V2_HOST_DATABASE_UNAVAILABLE' },
    @{ body = '{"error":{"code":"' + $sentinel + '"}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":"v2_host_reauth_generation_conflict"}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":409}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":null}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":null}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = 'null'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '[]'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '[{"error":{"code":"V2_HOST_REAUTH_GENERATION_CONFLICT"}}]'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '<html>' + $sentinel + '</html>'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = (' ' * 4097) + '{"error":{"code":"V2_HOST_REAUTH_GENERATION_CONFLICT"}}'
       reason = 'RESPONSE_TOO_LARGE' }
)
foreach ($case in $cases) {
    foreach ($streamOnly in @($false, $true)) {
        $fixture = New-DiagnosticFixture -Body $case.body -StreamOnly:$streamOnly
        $detail = Get-HolaCoordinatorRecoveryFailureDetail -ErrorRecord $fixture
        Assert-Diagnostic ($detail -match ('reason=' + $case.reason + ';')) 'Wrong bounded reason'
        Assert-Diagnostic ($detail -match '^http_status=409;') 'HTTP status missing'
        Assert-Diagnostic ($detail.Length -le 300) 'Report exceeds Fail-Safe detail bound'
        Assert-Diagnostic ($detail -notmatch $sentinel) 'Secret reflected into diagnostics'
        Assert-Diagnostic ($detail -notmatch 'accessToken|<html>|response=|message=') 'Raw error content reflected'
    }
}
$body = '{"error":{"code":"V2_HOST_REAUTH_GENERATION_CONFLICT"}}'
foreach ($status in @('409', -1, 200, 600, $null, $true, $sentinel)) {
    $detail = Get-HolaCoordinatorRecoveryFailureDetail -ErrorRecord (New-DiagnosticFixture -Status $status -Body $body)
    Assert-Diagnostic ($detail -match '^http_status=none; reason=TRANSPORT_UNKNOWN;') 'Untrusted HTTP metadata accepted'
    Assert-Diagnostic ($detail -notmatch $sentinel) 'Invalid status reflected'
}
$detail = Get-HolaCoordinatorRecoveryFailureDetail -ErrorRecord (New-DiagnosticFixture -BrokenStream)
Assert-Diagnostic ($detail -match 'reason=DIAGNOSTIC_UNAVAILABLE;') 'Broken capture changed error behavior'
foreach ($pair in @(
    @{ status = [Net.WebExceptionStatus]::Timeout; reason = 'TRANSPORT_TIMEOUT' },
    @{ status = [Net.WebExceptionStatus]::ConnectFailure; reason = 'TRANSPORT_CONNECTIVITY' },
    @{ status = [Net.WebExceptionStatus]::TrustFailure; reason = 'TRANSPORT_TLS' }
)) {
    $exception = [Net.WebException]::new($sentinel, $null, $pair.status, $null)
    $detail = Get-HolaCoordinatorRecoveryFailureDetail -ErrorRecord ([pscustomobject]@{ Exception = $exception })
    Assert-Diagnostic ($detail -match ('reason=' + $pair.reason + ';')) 'Typed transport reason missing'
    Assert-Diagnostic ($detail -notmatch $sentinel) 'Exception message reflected'
}
Assert-Diagnostic ($null -eq (Get-HolaCoordinatorRecoveryGuidance -Code $sentinel)) 'Unknown reason was allowlisted'

# Enrollment is a distinct allowlist over the same bounded extraction.
# StreamOnly simulates the legacy Windows response-stream shape; running this
# elsewhere does NOT constitute native Windows PowerShell 5.1 verification.
$enrollmentCodes = @(
    'V2_HOST_BOOTSTRAP_REQUIRED', 'V2_HOST_BOOTSTRAP_DENIED', 'V2_HOST_BOOTSTRAP_UNAVAILABLE',
    'V2_HOST_BOOTSTRAP_CONSUMED', 'V2_HOST_FOUNDER_REQUIRED', 'V2_HOST_IDEMPOTENCY_CONFLICT',
    'V2_HOST_REQUEST_NOT_FOUND', 'V2_HOST_REQUEST_EXPIRED', 'V2_HOST_REQUEST_TERMINAL',
    'V2_HOST_CHALLENGE_INVALID', 'V2_HOST_CHALLENGE_EXPIRED', 'V2_HOST_PROOF_INVALID',
    'V2_HOST_INVALID_REQUEST', 'V2_HOST_PROTOCOL_MISMATCH', 'V2_HOST_SOURCE_PROMOTION_REQUIRED',
    'V2_HOST_DATABASE_UNAVAILABLE'
)
$enrollmentCases = @()
foreach ($code in $enrollmentCodes) {
    Assert-Diagnostic ($null -eq (Get-HolaCoordinatorEnrollmentGuidance -Code $code.ToLowerInvariant())) `
        'Enrollment guidance accepted case-insensitive reason'
    $enrollmentCases += @{
        body = '{"error":{"code":"' + $code + '","message":"' + $sentinel + '"},"requestKey":"' +
            $sentinel + '","nonce":"' + $sentinel + '","signature":"' + $sentinel +
            '","accessToken":"' + $sentinel + '","url":"https://example.invalid/' + $sentinel + '"}'
        reason = $code
    }
    $enrollmentCases += @{
        body = '{"error":{"code":"' + $code.ToLowerInvariant() + '"}}'
        reason = 'UNKNOWN_SERVER_ERROR'
    }
    $enrollmentCases += @{
        body = '{"error":{"code":"V2_HOST_' + $code.Substring(8).ToLowerInvariant() + '"}}'
        reason = 'UNKNOWN_SERVER_ERROR'
    }
}
$enrollmentCases += @(
    @{ body = '{"error":{"code":"V2_HOST_REAUTH_GENERATION_CONFLICT"}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":"V2_HOST_REAUTH_PENDING_CONFLICT"}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":"V2_HOST_BOOTSTRAP_DENIED' + $sentinel + '"}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":"' + $sentinel + '"}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":409}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":[]}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":{}}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":{"code":null}}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":null}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":[]}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{}'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = 'null'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '[]'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '[{"error":{"code":"V2_HOST_BOOTSTRAP_DENIED"}}]'; reason = 'UNKNOWN_SERVER_ERROR'
       assertion = 'Enrollment malformed root array accepted' },
    @{ body = '"V2_HOST_BOOTSTRAP_DENIED"'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '{"error":'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = '<html>' + $sentinel + '</html>'; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = ''; reason = 'UNKNOWN_SERVER_ERROR' },
    @{ body = (' ' * 4097) + $sentinel; reason = 'RESPONSE_TOO_LARGE' }
)
$boundaryBody = '{"error":{"code":"V2_HOST_BOOTSTRAP_DENIED"}}'
$enrollmentCases += @{
    body = $boundaryBody + (' ' * (4096 - $boundaryBody.Length)); reason = 'V2_HOST_BOOTSTRAP_DENIED'
}
$enrollmentCases += @{
    body = $boundaryBody + (' ' * (4097 - $boundaryBody.Length)); reason = 'RESPONSE_TOO_LARGE'
}
foreach ($case in $enrollmentCases) {
    foreach ($streamOnly in @($false, $true)) {
        $fixture = New-DiagnosticFixture -Body $case.body -StreamOnly:$streamOnly
        $detail = Get-HolaCoordinatorTransportFailureDetail -ErrorRecord $fixture
        Assert-Diagnostic ($detail -notmatch $sentinel) 'Enrollment secret reflected'
        $expected = 'http_status=409; reason=' + $case.reason + '; next=' +
            (Get-HolaCoordinatorEnrollmentGuidance -Code $case.reason)
        $assertion = 'Enrollment report not fixed and allowlisted'
        if ($case.ContainsKey('assertion')) { $assertion = $case.assertion }
        Assert-Diagnostic ($detail -ceq $expected) $assertion
        Assert-Diagnostic ($detail.Length -le 300) 'Enrollment report exceeds Fail-Safe bound'
        Assert-Diagnostic ($detail -notmatch 'requestKey|accessToken|nonce|signature|https://|<html>|response=|message=') `
            'Enrollment raw error content reflected'
        $observed = ''
        try { Fail-Safe 'enrollment_transport' -Detail $detail }
        catch { $observed = [string]$_.Exception.Message }
        Assert-Diagnostic ($observed -ceq ('hola_coordinator_enrollment_transport :: ' + $expected)) `
            'Enrollment failure code or detail changed at Fail-Safe boundary'
    }
}
foreach ($status in @([Net.HttpStatusCode]::Forbidden, [int]400, [long]599)) {
    $detail = Get-HolaCoordinatorTransportFailureDetail -ErrorRecord (
        New-DiagnosticFixture -Status $status -Body $boundaryBody)
    Assert-Diagnostic ($detail -cmatch ('^http_status=' + [string][int]$status + '; reason=V2_HOST_BOOTSTRAP_DENIED;')) `
        'Typed enrollment HTTP status missing'
}
foreach ($status in @('409', -1, 200, 600, $null, $true, 409.0, $sentinel)) {
    # Invalid status must neither parse the body nor attempt its legacy stream.
    $fixture = New-DiagnosticFixture -Status $status -Body $boundaryBody -BrokenStream
    $detail = Get-HolaCoordinatorTransportFailureDetail -ErrorRecord $fixture
    Assert-Diagnostic ($detail -cmatch '^http_status=none; reason=TRANSPORT_UNKNOWN;') `
        'Untrusted enrollment HTTP metadata accepted'
    Assert-Diagnostic ($detail -notmatch $sentinel) 'Enrollment invalid status reflected'
}
foreach ($pair in @(
    @{ status = [Net.WebExceptionStatus]::Timeout; reason = 'TRANSPORT_TIMEOUT' },
    @{ status = [Net.WebExceptionStatus]::NameResolutionFailure; reason = 'TRANSPORT_CONNECTIVITY' },
    @{ status = [Net.WebExceptionStatus]::ConnectFailure; reason = 'TRANSPORT_CONNECTIVITY' },
    @{ status = [Net.WebExceptionStatus]::TrustFailure; reason = 'TRANSPORT_TLS' },
    @{ status = [Net.WebExceptionStatus]::SecureChannelFailure; reason = 'TRANSPORT_TLS' },
    @{ status = [Net.WebExceptionStatus]::UnknownError; reason = 'TRANSPORT_UNKNOWN' }
)) {
    $exception = [Net.WebException]::new($sentinel, $null, $pair.status, $null)
    $detail = Get-HolaCoordinatorTransportFailureDetail -ErrorRecord ([pscustomobject]@{ Exception = $exception })
    Assert-Diagnostic ($detail -ceq ('http_status=none; reason=' + $pair.reason + '; next=' +
        (Get-HolaCoordinatorEnrollmentGuidance -Code $pair.reason))) 'Enrollment typed transport reason missing'
    Assert-Diagnostic ($detail -notmatch $sentinel) 'Enrollment exception message reflected'
}
$detail = Get-HolaCoordinatorTransportFailureDetail -ErrorRecord (New-DiagnosticFixture -BrokenStream)
Assert-Diagnostic ($detail -cmatch '^http_status=none; reason=DIAGNOSTIC_UNAVAILABLE;') 'Enrollment failed-stream fallback wrong'
Assert-Diagnostic ($detail -notmatch $sentinel) 'Enrollment failed-stream text reflected'
foreach ($fixture in @(
    [pscustomobject]@{},
    [pscustomobject]@{ Exception = [Exception]::new($sentinel) },
    (New-DiagnosticFixture -Body ([pscustomobject]@{ Message = $sentinel }))
)) {
    $detail = Get-HolaCoordinatorTransportFailureDetail -ErrorRecord $fixture
    Assert-Diagnostic ($detail -notmatch $sentinel) 'Malformed enrollment metadata reflected'
    Assert-Diagnostic ($detail -match 'reason=(TRANSPORT_UNKNOWN|UNKNOWN_SERVER_ERROR);') 'Malformed enrollment fallback wrong'
}
Assert-Diagnostic ($null -eq (Get-HolaCoordinatorEnrollmentGuidance -Code $sentinel)) 'Enrollment unknown reason allowlisted'
Assert-Diagnostic ($null -eq (Get-HolaCoordinatorEnrollmentGuidance -Code 'V2_HOST_REAUTH_GENERATION_CONFLICT')) `
    'Recovery-only code leaked into enrollment allowlist'

# Exercise the actual public boundary without touching recovery lifecycle state.
$original = (Get-Item Function:\Restore-InternalHolaCoordinatorHostCredential).ScriptBlock
try {
    Set-Item Function:\script:Restore-InternalHolaCoordinatorHostCredential -Value {
        param($Endpoint)
        Fail-Safe 'host_credential_reauthorization_not_required'
    }
    $observed = ''
    try { Restore-HolaCoordinatorHostCredential -Endpoint 'https://example.invalid' | Out-Null }
    catch { $observed = [string]$_.Exception.Message }
    Assert-Diagnostic ($observed -match '^hola_coordinator_host_credential_reauthorization_not_required ::') `
        'Recognized local failure code changed'
    Assert-Diagnostic ($observed -match 'still valid') 'Known local failure lacks guidance'

    Set-Item Function:\script:Restore-InternalHolaCoordinatorHostCredential -Value {
        param($Endpoint)
        throw 'SYNTHETIC_SECRET_NEVER_REPORT_75319'
    }
    $observed = ''
    try { Restore-HolaCoordinatorHostCredential -Endpoint 'https://example.invalid' | Out-Null }
    catch { $observed = [string]$_.Exception.Message }
    Assert-Diagnostic ($observed -match '^hola_coordinator_host_recovery_failed ::') 'Unexpected local error not bounded'
    Assert-Diagnostic ($observed -notmatch $sentinel) 'Local exception text reflected'

    Set-Item Function:\script:Restore-InternalHolaCoordinatorHostCredential -Value {
        param($Endpoint)
        $safe = Format-HolaCoordinatorRecoveryDetail -Reason 'V2_HOST_REAUTH_GENERATION_CONFLICT' -HttpStatus '409'
        Fail-Safe 'host_reauthorization_transport' -Detail $safe
    }
    $observed = ''
    try { Restore-HolaCoordinatorHostCredential -Endpoint 'https://example.invalid' | Out-Null }
    catch { $observed = [string]$_.Exception.Message }
    Assert-Diagnostic ($observed -match '^hola_coordinator_host_reauthorization_transport :: http_status=409;') `
        'Bounded transport failure lost its code or HTTP status'
    Assert-Diagnostic ($observed -match 'reason=V2_HOST_REAUTH_GENERATION_CONFLICT;') 'Recognized server reason lost'
} finally {
    Set-Item Function:\script:Restore-InternalHolaCoordinatorHostCredential -Value $original
}
Write-Host '[coordinator-v2] Synthetic safe enrollment and recovery diagnostic checks passed'
if (-not $SkipMutationChecks) {
    & (Join-Path $PSScriptRoot 'test-hola-coordinator-enrollment-diagnostic-mutations.ps1')
}
