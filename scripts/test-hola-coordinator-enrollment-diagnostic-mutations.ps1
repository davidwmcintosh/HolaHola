# Synthetic-only mutation proof. This is not Windows policy, DPAPI, enrollment,
# publication, or native Windows verification. Only private temporary copies run.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Replace-DiagnosticMutationOnce {
    param([string]$Text, [string]$Needle, [string]$Replacement)
    $first = $Text.IndexOf($Needle, [StringComparison]::Ordinal)
    if ($first -lt 0 -or $Text.IndexOf($Needle, $first + $Needle.Length, [StringComparison]::Ordinal) -ge 0) {
        throw 'Diagnostic mutation anchor missing or ambiguous'
    }
    return $Text.Substring(0, $first) + $Replacement + $Text.Substring($first + $Needle.Length)
}

$sourcePath = Join-Path $PSScriptRoot 'hola-coordinator.ps1'
$fixturePath = Join-Path $PSScriptRoot 'test-hola-coordinator-recovery-diagnostics.ps1'
$source = [IO.File]::ReadAllText($sourcePath)
$fixture = [IO.File]::ReadAllText($fixturePath)
$wrapper = 'return (Get-InternalHolaCoordinatorHttpFailureDetail -ErrorRecord $ErrorRecord -Context Enrollment)'
$guidanceStart = $source.IndexOf('function Get-HolaCoordinatorEnrollmentGuidance', [StringComparison]::Ordinal)
$guidanceEnd = $source.IndexOf('function Resolve-ApprovedNode', $guidanceStart, [StringComparison]::Ordinal)
if ($guidanceStart -lt 0 -or $guidanceEnd -le $guidanceStart) { throw 'Enrollment guidance boundary missing' }
$guidance = $source.Substring($guidanceStart, $guidanceEnd - $guidanceStart)
$caseInsensitiveGuidance = Replace-DiagnosticMutationOnce -Text $guidance `
    -Needle '[StringComparer]::Ordinal)' -Replacement '[StringComparer]::OrdinalIgnoreCase)'
# Use the exact source spelling; a changed guard must invalidate the proof.
$arrayGuard = '$body.TrimStart().StartsWith(''{'', [StringComparison]::Ordinal)'
$parsedLine = '$parsed = ConvertFrom-Json -InputObject $body -ErrorAction Stop'
# Removing only the delimiter guard does not admit an array on an engine that
# preserves its array type. Model the actual unsafe behavior in the private
# mutant: permit the array and unwrap its sole object before the type check.
$rootArraySource = Replace-DiagnosticMutationOnce -Text $source -Needle $arrayGuard `
    -Replacement ('(' + $arrayGuard + ' -or ($Context -ceq ''Enrollment'' -and $body.TrimStart().StartsWith(''['', [StringComparison]::Ordinal)))')
$rootArraySource = Replace-DiagnosticMutationOnce -Text $rootArraySource -Needle $parsedLine `
    -Replacement ($parsedLine + "`n                " +
        'if ($parsed -is [Array] -and $parsed.Count -eq 1) { $parsed = $parsed[0] }')
$mutations = @(
    @{
        name = 'raw-response'
        source = (Replace-DiagnosticMutationOnce -Text $source -Needle $wrapper `
            -Replacement ('return (' + $wrapper.Substring(7) + ' + [string]$ErrorRecord.ErrorDetails.Message)'))
        failure = 'Enrollment secret reflected'
    },
    @{
        name = 'raw-exception'
        source = (Replace-DiagnosticMutationOnce -Text $source -Needle $wrapper `
            -Replacement ('return (' + $wrapper.Substring(7) + ' + [string]$ErrorRecord.Exception.Message)'))
        failure = 'Enrollment secret reflected'
    },
    @{
        name = 'case-insensitive-guidance'
        source = $source.Substring(0, $guidanceStart) + $caseInsensitiveGuidance + $source.Substring($guidanceEnd)
        failure = 'Enrollment guidance accepted case-insensitive reason'
    },
    @{
        name = 'root-array'
        source = $rootArraySource
        failure = 'Enrollment malformed root array accepted'
    },
    @{ name = 'unmodified'; source = $source; failure = $null }
)
$root = Join-Path ([IO.Path]::GetTempPath()) ('hola-diagnostic-mutations-' + [Guid]::NewGuid().ToString('N'))
$engine = (Get-Process -Id $PID).Path
try {
    foreach ($mutation in $mutations) {
        $directory = Join-Path $root $mutation.name
        [void][IO.Directory]::CreateDirectory($directory)
        [IO.File]::WriteAllText((Join-Path $directory 'hola-coordinator.ps1'), $mutation.source)
        $copy = Join-Path $directory 'test-hola-coordinator-recovery-diagnostics.ps1'
        [IO.File]::WriteAllText($copy, $fixture)
        # Explicit standard modules keep children independent of ambient module
        # discovery (which can scan the whole Nix store in Linux workspaces).
        # These are built-in modules on Windows PowerShell 5.1 as well.
        $bootstrap = '$PSModuleAutoLoadingPreference = ''None''; ' +
            'foreach ($module in @(''Utility'', ''Management'')) { ' +
            'Import-Module ([IO.Path]::Combine($PSHOME, ''Modules'', ''Microsoft.PowerShell.'' + $module, ''Microsoft.PowerShell.'' + $module + ''.psd1'')) }; '
        # Exercise preserved singleton arrays on every engine, in addition to
        # its real parser. This shim applies only inside synthetic child tests.
        $preservedArrayParser = 'function ConvertFrom-Json { [CmdletBinding()] param([string]$InputObject); ' +
            '$decoded = Microsoft.PowerShell.Utility\ConvertFrom-Json -InputObject $InputObject -ErrorAction Stop; ' +
            'if ($InputObject.TrimStart().StartsWith(''['', [StringComparison]::Ordinal)) { ' +
            'Write-Output -NoEnumerate @($decoded) } else { $decoded } }; '
        $modes = @('native-parser')
        if ($mutation.name -ceq 'root-array' -or $mutation.name -ceq 'unmodified') {
            $modes += 'preserved-array-parser'
        }
        # No policy override, profile, credential, runtime, or network operation.
        # Temporarily permit native stderr so Windows PowerShell's NativeCommandError
        # does not preempt inspection of the child's intended assertion failure.
        foreach ($mode in $modes) {
            $command = $bootstrap
            if ($mode -ceq 'preserved-array-parser') { $command += $preservedArrayParser }
            $command += '& ''' + $copy.Replace("'", "''") + ''' -SkipMutationChecks'
            $ErrorActionPreference = 'Continue'
            try {
                $output = (& $engine -NoLogo -NoProfile -NonInteractive -Command $command 2>&1 | Out-String)
                $exitCode = $LASTEXITCODE
            } finally { $ErrorActionPreference = 'Stop' }
            if ($null -eq $mutation.failure) {
                if ($exitCode -ne 0 -or -not $output.Contains('Synthetic safe enrollment and recovery diagnostic checks passed')) {
                    throw ('Unmodified synthetic diagnostic fixture failed: ' + $mode)
                }
            } elseif ($exitCode -eq 0 -or -not $output.Contains($mutation.failure)) {
                throw ('Diagnostic mutation did not fail its intended assertion: ' + $mutation.name + '/' + $mode)
            }
            Write-Host ('[coordinator-v2] Synthetic mutation proof passed: ' + $mutation.name + '/' + $mode)
        }
    }
} finally {
    if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
if ([IO.File]::ReadAllText($sourcePath) -cne $source -or [IO.File]::ReadAllText($fixturePath) -cne $fixture) {
    throw 'Original diagnostic source or fixture changed during mutation proof'
}
