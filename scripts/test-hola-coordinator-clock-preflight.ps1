$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# Hermetic: real PowerShell evaluation, synthetic samples and dummy file custody.
# Never invokes a native Windows host or sends a credential/request.
. (Join-Path $PSScriptRoot 'hola-coordinator.ps1')

function Assert-ClockTest {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

$names = @('Get-InternalHolaCoordinatorClockSample', 'Get-InternalHolaCoordinatorTimeService',
    'Assert-SafePath', 'Assert-NoReparse', 'Assert-SidAcl', 'Read-DpapiJson',
    'Get-InternalHolaCoordinatorRecoveryGeneration', 'Write-DpapiJsonAtomic')
$original = @{}
foreach ($name in $names) { $original[$name] = (Get-Item ('Function:\' + $name)).ScriptBlock }
$oldRoot = $RuntimeBootstrapRoot
$oldLocalAppData = $env:LOCALAPPDATA
$root = Join-Path ([IO.Path]::GetTempPath()) ('hola-clock-test-' + [Guid]::NewGuid().ToString('N'))
$script:clockCalls = 0
$script:serviceCalls = 0
$script:clockService = 'running'
$script:clockMode = 'sample'
$script:clockOffset = 1500.0
$script:clockTtl = 120000
try {
    # Production parser must load in real PowerShell, without policy changes.
    $tokens = $null; $errors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile(
        (Join-Path $PSScriptRoot 'hola-coordinator.ps1'), [ref]$tokens, [ref]$errors)
    Assert-ClockTest ($errors.Count -eq 0) 'PowerShell parser errors'

    function Get-InternalHolaCoordinatorTimeService {
        $script:serviceCalls++; return $script:clockService
    }
    function Get-InternalHolaCoordinatorClockSample {
        param([string]$Endpoint)
        $script:clockCalls++
        if ($script:clockMode -eq 'unavailable') { return $null }
        if ($script:clockMode -eq 'throws') { throw 'secret-never-display' }
        $server = 1790000000000L
        $offset = $script:clockOffset
        if ($script:clockMode -eq 'discordant' -and $script:clockCalls -eq 2) { $offset += 1000 }
        $body = [pscustomobject]@{ protocolVersion = 1; serverUnixMs = $server
            resolutionMs = 1; futureAllowanceMs = 0; contextTtlMs = $script:clockTtl }
        if ($script:clockMode -eq 'malformed') { $body.serverUnixMs = 'secret-never-display' }
        if ($script:clockMode -eq 'extra') { $body | Add-Member NoteProperty credential 'secret-never-display' }
        if ($script:clockMode -eq 'nan') { $body.serverUnixMs = [double]::NaN }
        if ($script:clockMode -eq 'fractional') { $body.serverUnixMs = $server + 0.5 }
        $start = $server + $offset - 10
        $end = $server + $offset + 10
        if ($script:clockMode -eq 'jump') { $end += 1000 }
        $elapsed = 20.0
        if ($script:clockMode -eq 'slow') { $elapsed = 2500.0; $end = $start + $elapsed }
        return [pscustomobject]@{ body = $body; startMs = [double]$start; endMs = [double]$end
            elapsedMs = $elapsed }
    }
    function Test-Report {
        param([double]$Offset, [string]$Expected, [string]$Mode = 'sample', [string]$Service = 'running')
        $script:clockOffset = $Offset; $script:clockMode = $Mode; $script:clockService = $Service
        $script:clockCalls = 0; $script:serviceCalls = 0
        $report = Get-HolaCoordinatorClockPreflight -Endpoint 'https://example.invalid'
        Assert-ClockTest ($report.clock -ceq $Expected) ('Clock classification: ' + $Expected)
        Assert-ClockTest ($script:clockCalls -eq 3 -and $script:serviceCalls -eq 1) 'Probe count exceeded bound'
        Assert-ClockTest ($report.correctionCommand -ceq 'not_run') 'Correction outcome fabricated'
        Assert-ClockTest (($report | ConvertTo-Json -Compress) -notmatch 'secret-never-display|healthy') 'Unsafe diagnostic'
        return $report
    }
    $null = Test-Report 1500 'ahead'
    $null = Test-Report -121500 'behind'
    $null = Test-Report -120000 'unknown' # interval overlaps the strict expiry edge
    $null = Test-Report 0 'unknown'       # interval overlaps zero future allowance
    $stopped = Test-Report -50 'within_window' -Service 'stopped'
    Assert-ClockTest ($stopped.timeService -ceq 'stopped') 'Small offset hid stopped service'
    $null = Test-Report -1500 'within_window'
    foreach ($mode in @('unavailable', 'throws', 'malformed', 'extra', 'nan', 'fractional', 'jump', 'slow', 'discordant')) {
        $null = Test-Report 1500 'unknown' -Mode $mode -Service 'unknown'
    }
    # TTL must come from the sampled server contract, not a magic skew limit.
    $script:clockTtl = 500
    $null = Test-Report -1500 'behind'
    $script:clockTtl = 120000

    # Original native sampler rejects a non-HTTPS URI without network or output.
    $native = & $original['Get-InternalHolaCoordinatorClockSample'] -Endpoint 'http://example.invalid'
    Assert-ClockTest ($null -eq $native) 'Non-HTTPS measurement accepted'

    [IO.Directory]::CreateDirectory($root) | Out-Null
    $env:LOCALAPPDATA = $root; $RuntimeBootstrapRoot = Join-Path $root 'HolaHola'
    [IO.Directory]::CreateDirectory($RuntimeBootstrapRoot) | Out-Null
    foreach ($file in @('host-material.dpapi', 'host-private-key.dpapi',
        'host-reauthorization-request.dpapi', 'runtime-credential.dpapi', 'journal.json')) {
        [IO.File]::WriteAllText((Join-Path $RuntimeBootstrapRoot $file), 'dummy-custody-' + $file)
    }
    function Get-Custody {
        return (@(Get-ChildItem -LiteralPath $root -Recurse -File | Sort-Object FullName |
            ForEach-Object { $_.Name + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) -join '|')
    }
    $before = Get-Custody
    function Assert-SafePath { param($Path, $Root) return $Path }
    function Assert-NoReparse { param($Path) }
    function Assert-SidAcl { param($Path) }
    function Read-DpapiJson {
        param($Path, $FailureCode)
        # Dummy credential only. No DPAPI reads in this test.
        return [pscustomobject]@{ endpoint = 'https://example.invalid'
            accessToken = 'v2h_abcdefghijklmnopqrstuvwxyz0123456789' }
    }
    function Get-InternalHolaCoordinatorRecoveryGeneration { throw 'context-must-not-run' }
    function Write-DpapiJsonAtomic { throw 'write-must-not-run' }
    foreach ($offset in @(1500, -121500)) {
        $script:clockOffset = [double]$offset; $script:clockMode = 'sample'
        $warnings = @(); $caught = ''
        try {
            Restore-HolaCoordinatorHostCredential -Endpoint 'https://example.invalid' `
                -WarningVariable warnings -WarningAction SilentlyContinue | Out-Null
        } catch { $caught = $_.Exception.Message }
        Assert-ClockTest ($caught -match '^hola_coordinator_host_recovery_clock_out_of_window ::') 'Recovery failed at wrong boundary'
        Assert-ClockTest (($warnings -join '|') -notmatch 'dummy-custody|secret-never-display|v2h_') 'Custody leaked'
        Assert-ClockTest ($before -ceq (Get-Custody)) 'Recovery altered custody'
    }
    # Unknown is advisory, never proof of health; the existing protocol remains
    # authoritative. Assert helper itself cannot create credentials or sessions.
    $script:clockMode = 'unavailable'
    $warnings = @()
    Assert-InternalHolaCoordinatorClockPreflight -Endpoint 'https://example.invalid' `
        -WarningVariable warnings -WarningAction SilentlyContinue
    Assert-ClockTest (($warnings -join '|') -match 'unknown, not healthy') 'Unknown silently healthy'
    Assert-ClockTest ($before -ceq (Get-Custody)) 'Standalone preflight altered custody'
    Write-Output 'PASS: clock intervals, service independence, bounded unknown diagnostics, protected recovery custody'
} finally {
    foreach ($name in $names) { Set-Item ('Function:\' + $name) $original[$name] }
    $RuntimeBootstrapRoot = $oldRoot; $env:LOCALAPPDATA = $oldLocalAppData
    if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
