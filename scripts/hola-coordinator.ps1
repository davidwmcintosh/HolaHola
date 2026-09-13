[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('preflight', 'prepare')]
    [string]$Mode
)

# M8 is intentionally boundary scaffolding, not an executable lifecycle.
# All policy, reservation, retry, and state-machine decisions remain in the
# server; M9 transport activation is intentionally absent.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ApprovedWorktree = 'C:\Users\David\HolaHola-antigravity'
$ApprovedNode = 'C:\Program Files\nodejs\node.exe'
$PreflightScript = 'C:\Users\David\HolaHola-antigravity\server\scripts\coordination-windows-preflight.ts'
$PrepareScript = 'C:\Users\David\HolaHola-antigravity\server\scripts\coordination-windows-prepare.ts'
$CurrentUserScope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser

function Fail-Safe {
    param([Parameter(Mandatory = $true)][string]$Code)
    $safeCode = ($Code -replace '[^a-zA-Z0-9_-]', '_').Substring(0, [Math]::Min(80, $Code.Length))
    throw ('hola_coordinator_' + $safeCode)
}

function Assert-Host {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { Fail-Safe 'windows_required' }
    if ($PSVersionTable.PSVersion.Major -lt 5 -or
        ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -lt 1)) {
        Fail-Safe 'powershell_5_1_required'
    }
    if (-not [System.IO.File]::Exists($ApprovedNode)) { Fail-Safe 'approved_node_missing' }
    if (-not [System.IO.Directory]::Exists($ApprovedWorktree)) { Fail-Safe 'approved_worktree_missing' }
    if ($null -eq ('System.Security.Cryptography.ProtectedData' -as [type])) {
        Fail-Safe 'dpapi_current_user_unavailable'
    }
    Assert-NoReparse -Path $ApprovedWorktree
    Assert-ReadablePrivateAcl -Path $ApprovedWorktree
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

function Move-AtomicSameVolume {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    # Both paths are coordinator-owned and must be on the same volume;
    # Move-Item is therefore the Windows atomic rename boundary.
    Assert-NoReparse -Path $Source
    Assert-NoReparse -Path (Split-Path -LiteralPath $Destination -Parent)
    Move-Item -LiteralPath $Source -Destination $Destination -Force -ErrorAction Stop
}

function Invoke-ApprovedCoordinator {
    param([Parameter(Mandatory = $true)][string]$ScriptPath)
    Assert-NoReparse -Path $ApprovedNode
    Assert-NoReparse -Path $ScriptPath
    Assert-ReadablePrivateAcl -Path $ApprovedNode
    Assert-ReadablePrivateAcl -Path $ScriptPath
    # No credentials, plaintext, ciphertext, provider values, or user paths
    # are accepted as arguments. The server receives its reservation through
    # the coordinator's authenticated transport.
    $arguments = @('--import', $ScriptPath, '--mode', $Mode)
    & $ApprovedNode @arguments
    if ($LASTEXITCODE -ne 0) { Fail-Safe 'coordinator_failed' }
}

Assert-Host
if ($Mode -eq 'preflight') {
    Invoke-ApprovedCoordinator -ScriptPath $PreflightScript
} elseif ($Mode -eq 'prepare') {
    Invoke-ApprovedCoordinator -ScriptPath $PrepareScript
} else {
    Fail-Safe 'mode'
}
