[CmdletBinding()]
param()

# M9 is an operator boundary only. Server-issued identifiers and Windows
# authority are deliberately not accepted here; those arrive through the
# authenticated coordinator transport in a later milestone.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ApprovedWorktree = 'C:\Users\David\HolaHola-antigravity'
$ApprovedNode = 'C:\Program Files\nodejs\node.exe'
$ApprovedTsx = 'C:\Users\David\HolaHola-antigravity\node_modules\tsx\dist\cli.mjs'
$CoordinatorScript = 'C:\Users\David\HolaHola-antigravity\server\scripts\coordination-v2-cli.ts'
$CurrentUserScope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser

function Fail-Safe {
    param([Parameter(Mandatory = $true)][string]$Code)
    $safeCode = ($Code -replace '[^a-zA-Z0-9_-]', '_')
    $safeCode = $safeCode.Substring(0, [Math]::Min(80, $safeCode.Length))
    throw ('hola_coordinator_' + $safeCode)
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
        'invalid_request'
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
}

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
    $childOutput = @(& $ApprovedNode @arguments 2>$null)
    $observedChildExit = [int64]$LASTEXITCODE
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

# No import-time lifecycle execution. Operators explicitly call
# Invoke-HolaCoordinator -TaskRef <task reference>.
