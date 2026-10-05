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
Write-Host '[coordinator-v2] Synthetic safe recovery diagnostic checks passed'
