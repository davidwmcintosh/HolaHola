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
    # Keep safe stdout from the CLI, but never surface a child native stderr.
    & $ApprovedNode @arguments 2>$null
    $childExit = $LASTEXITCODE
    # Preserve native status for callers without emitting it as a pipeline
    # value (which would contaminate the CLI's safe stdout contract).
    $global:LASTEXITCODE = $childExit
    [Environment]::ExitCode = $childExit
}

# No import-time lifecycle execution. Operators explicitly call
# Invoke-HolaCoordinator -TaskRef <task reference>.
