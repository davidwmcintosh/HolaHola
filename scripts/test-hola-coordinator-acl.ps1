$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# Native Windows-only fixtures. Importing the launcher does not run its lifecycle.
. (Join-Path $PSScriptRoot 'hola-coordinator.ps1')
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'ACL fixtures require native Windows'
}

$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$currentSid = $currentIdentity.User
# An unmapped SID, not a well-known group that could deny access to the runner.
$fixtureSid = New-Object System.Security.Principal.SecurityIdentifier `
    'S-1-5-21-111111111-222222222-333333333-444444444'
if ($currentSid.Value -eq $fixtureSid.Value -or
    @($currentIdentity.Groups | ForEach-Object { $_.Value }) -contains $fixtureSid.Value) {
    throw 'Synthetic ACL SID unexpectedly belongs to the runner'
}
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('hola-acl-' + [Guid]::NewGuid().ToString('N'))
$createdRoot = $false
$caseNumber = 0
$checks = 0
$originalGuard = (Get-Item Function:\Assert-SidAcl).ScriptBlock
$guardBody = $originalGuard.ToString()
$maskMatch = [regex]::Match($guardBody,
    '(?s)\$unsafeWriteMask\s*=\s*\[int\]\((?<rights>.*?)\r?\n\s*\)')
if (-not $maskMatch.Success) { throw 'Production ACL mask could not be extracted' }
$maskGroup = $maskMatch.Groups['rights']
$primitiveRights = @(
    'WriteData', 'AppendData', 'WriteExtendedAttributes', 'DeleteSubdirectoriesAndFiles',
    'WriteAttributes', 'Delete', 'ChangePermissions', 'TakeOwnership'
)

function New-AclRule {
    param($Sid, [System.Security.AccessControl.FileSystemRights]$Rights,
        [System.Security.AccessControl.AccessControlType]$Type,
        [System.Security.AccessControl.InheritanceFlags]$Inheritance = 'None',
        [System.Security.AccessControl.PropagationFlags]$Propagation = 'None')
    New-Object System.Security.AccessControl.FileSystemAccessRule `
        -ArgumentList @($Sid, $Rights, $Inheritance, $Propagation, $Type)
}

function New-AclFixture {
    param([ValidateSet('directory', 'file')][string]$Kind, $Rights,
        [System.Security.AccessControl.AccessControlType]$Type = 'Allow',
        [System.Security.AccessControl.InheritanceFlags]$Inheritance = 'None',
        [System.Security.AccessControl.PropagationFlags]$Propagation = 'None')
    $script:caseNumber++
    $path = Join-Path $testRoot ('case-' + $script:caseNumber)
    if ($Kind -eq 'directory') {
        [System.IO.Directory]::CreateDirectory($path) | Out-Null
    } else {
        [System.IO.File]::WriteAllText($path, 'disposable ACL fixture')
    }
    $acl = Get-Acl -LiteralPath $path
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($currentSid)
    foreach ($sidText in @($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544')) {
        $sid = New-Object System.Security.Principal.SecurityIdentifier $sidText
        $acl.AddAccessRule((New-AclRule -Sid $sid -Rights 'FullControl' -Type 'Allow'))
    }
    if ($null -ne $Rights) {
        $acl.AddAccessRule((New-AclRule -Sid $fixtureSid -Rights $Rights -Type $Type `
            -Inheritance $Inheritance -Propagation $Propagation))
    }
    Set-Acl -LiteralPath $path -AclObject $acl
    return $path
}

function Assert-AclOutcome {
    param([string]$Path, [string]$Expected = '', [string]$Label)
    $observed = ''
    try { Assert-SidAcl -Path $Path }
    catch { $observed = [string]$_.Exception.Message }
    if ($observed -ne $Expected) {
        # Do not print paths, identity names, SIDs, or arbitrary exception text.
        throw ('Unexpected ACL outcome: ' + $Label)
    }
    $script:checks++
}

function Set-MutantMask {
    param([string]$Expression)
    $mutant = $guardBody.Substring(0, $maskGroup.Index) + $Expression +
        $guardBody.Substring($maskGroup.Index + $maskGroup.Length)
    Set-Item Function:\script:Assert-SidAcl -Value ([scriptblock]::Create($mutant))
}

try {
    # Establish an owned, protected root before writing any test fixture.
    if (Test-Path -LiteralPath $testRoot) { throw 'ACL fixture root already exists' }
    [System.IO.Directory]::CreateDirectory($testRoot) | Out-Null
    $createdRoot = $true
    $rootAcl = New-Object System.Security.AccessControl.DirectorySecurity
    $rootAcl.SetAccessRuleProtection($true, $false)
    $rootAcl.SetOwner($currentSid)
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    foreach ($sidText in @($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544')) {
        $sid = New-Object System.Security.Principal.SecurityIdentifier $sidText
        $rootAcl.AddAccessRule((New-AclRule -Sid $sid -Rights 'FullControl' `
            -Type 'Allow' -Inheritance $inherit))
    }
    Set-Acl -LiteralPath $testRoot -AclObject $rootAcl
    Assert-AclOutcome -Path $testRoot -Label 'owned protected root'

    # Reproduce the reported checkout shape: trusted inherited FullControl
    # rules plus one explicit untrusted read/execute/synchronize rule.
    $reportedShapePath = Join-Path $testRoot 'reported-shape'
    [System.IO.Directory]::CreateDirectory($reportedShapePath) | Out-Null
    $reportedAcl = Get-Acl -LiteralPath $reportedShapePath
    $expectedInherited = @(@($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544') |
        Select-Object -Unique).Count
    if (@($reportedAcl.Access | Where-Object { $_.IsInherited }).Count -ne $expectedInherited) {
        throw 'Native fixture did not inherit the expected trusted rules'
    }
    $reportedRights = [System.Security.AccessControl.FileSystemRights]::ReadAndExecute -bor
        [System.Security.AccessControl.FileSystemRights]::Synchronize
    $reportedAcl.AddAccessRule((New-AclRule -Sid $fixtureSid -Rights $reportedRights -Type 'Allow'))
    Set-Acl -LiteralPath $reportedShapePath -AclObject $reportedAcl
    Assert-AclOutcome -Path $reportedShapePath -Label 'reported inherited-trusted/explicit-read shape'

    foreach ($kind in @('directory', 'file')) {
        Assert-AclOutcome -Path (New-AclFixture -Kind $kind -Rights $null) `
            -Label ($kind + ' trusted FullControl')
        $readExecuteSync = [System.Security.AccessControl.FileSystemRights]::ReadAndExecute -bor
            [System.Security.AccessControl.FileSystemRights]::Synchronize
        foreach ($right in @('ReadData', 'ReadExtendedAttributes', 'ReadAttributes',
            'ReadPermissions', 'ExecuteFile', 'Synchronize', 'Read', 'ReadAndExecute')) {
            Assert-AclOutcome -Path (New-AclFixture -Kind $kind -Rights $right) `
                -Label ($kind + ' read-only ' + $right)
        }
        Assert-AclOutcome -Path (New-AclFixture -Kind $kind -Rights $readExecuteSync) `
            -Label ($kind + ' actual read/execute/synchronize combination')
        foreach ($right in @($primitiveRights) + @('Write', 'Modify', 'FullControl')) {
            Assert-AclOutcome -Path (New-AclFixture -Kind $kind -Rights $right) `
                -Expected 'hola_coordinator_acl_write_unsafe' -Label ($kind + ' mutation ' + $right)
        }
        $mixed = $readExecuteSync -bor [System.Security.AccessControl.FileSystemRights]::WriteData
        Assert-AclOutcome -Path (New-AclFixture -Kind $kind -Rights $mixed) `
            -Expected 'hola_coordinator_acl_write_unsafe' -Label ($kind + ' mixed read/write')
        Assert-AclOutcome -Path (New-AclFixture -Kind $kind -Rights 'WriteData' -Type 'Deny') `
            -Expected 'hola_coordinator_acl_write_unsafe' -Label ($kind + ' conservative mutating deny')

        # Prove over-rejection is detected by executing the real guard with a
        # FullControl-contaminated mask. The unmodified read-only case passed above.
        $readPath = New-AclFixture -Kind $kind -Rights $readExecuteSync
        Set-MutantMask -Expression ('(' + $maskGroup.Value +
            ') -bor [System.Security.AccessControl.FileSystemRights]::FullControl')
        Assert-AclOutcome -Path $readPath -Expected 'hola_coordinator_acl_write_unsafe' `
            -Label ($kind + ' detects composite-mask regression')
        Set-Item Function:\script:Assert-SidAcl -Value $originalGuard

        # Prove a dropped bit is detected, separately for EVERY primitive.
        foreach ($omitted in $primitiveRights) {
            $path = New-AclFixture -Kind $kind -Rights $omitted
            $remaining = @($primitiveRights | Where-Object { $_ -ne $omitted } | ForEach-Object {
                '[System.Security.AccessControl.FileSystemRights]::' + $_
            }) -join ' -bor '
            Set-MutantMask -Expression $remaining
            Assert-AclOutcome -Path $path -Label ($kind + ' detects missing bit ' + $omitted)
            Set-Item Function:\script:Assert-SidAcl -Value $originalGuard
        }
    }

    Assert-AclOutcome -Path (New-AclFixture -Kind 'directory' -Rights 'WriteData' `
        -Inheritance 'ContainerInherit' -Propagation 'InheritOnly') `
        -Expected 'hola_coordinator_acl_write_unsafe' -Label 'conservative mutating InheritOnly'

    # Owner rejection uses a native descriptor IN MEMORY: never assign an
    # untrusted owner to a real file or directory.
    $ownerAcl = New-Object System.Security.AccessControl.DirectorySecurity
    # A resolvable non-owner SID avoids testing account-translation failure
    # instead of the owner check when PowerShell exposes the Owner property.
    $untrustedOwner = New-Object System.Security.Principal.SecurityIdentifier 'S-1-1-0'
    $ownerAcl.SetOwner($untrustedOwner)
    function Get-Acl {
        [CmdletBinding()]
        param([string]$LiteralPath)
        return $ownerAcl
    }
    try {
        Assert-AclOutcome -Path 'in-memory-native-owner-descriptor' `
            -Expected 'hola_coordinator_acl_owner_unsafe' -Label 'untrusted owner'
    } finally {
        Remove-Item Function:\Get-Acl
    }
} finally {
    Set-Item Function:\script:Assert-SidAcl -Value $originalGuard
    # Cleanup is restricted to the one fresh tree this script created.
    if ($createdRoot -and [System.IO.Directory]::Exists($testRoot)) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
Write-Host ('[coordinator-v2] Native Windows ACL checks passed: ' + $checks)
