[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('get', 'set', 'set-if-absent', 'delete')]
    [string]$Operation
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$StoreVersion = 1
$StoreRoot = [IO.Path]::Combine(
    [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData),
    'HolaHola',
    'coordination-runtime-onboarding'
)
$Entropy = [Text.Encoding]::UTF8.GetBytes('HolaHola coordination runtime onboarding DPAPI CurrentUser v1')

function Fail([string]$Code) {
    throw "runtime_onboarding_store_$Code"
}

function Assert-NoReparsePoint([string]$Path, [bool]$MustExist) {
    if (-not [IO.File]::Exists($Path) -and -not [IO.Directory]::Exists($Path)) {
        if ($MustExist) { Fail 'path_missing' }
        return
    }
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Fail 'reparse_point' }
}

function Assert-NoReparseChain([string]$Path, [bool]$MustExist) {
    $current = [IO.Path]::GetFullPath($Path)
    if ($MustExist -and -not [IO.File]::Exists($current) -and -not [IO.Directory]::Exists($current)) {
        Fail 'path_missing'
    }
    while (-not [string]::IsNullOrWhiteSpace($current)) {
        Assert-NoReparsePoint -Path $current -MustExist $false
        $parent = [IO.Directory]::GetParent($current)
        if ($null -eq $parent) { break }
        $current = $parent.FullName
    }
}

function Current-Sid {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if ($null -eq $identity -or $null -eq $identity.User) { Fail 'identity' }
    return $identity.User
}

function Set-PrivateAcl([string]$Path, [bool]$Directory) {
    $sid = Current-Sid
    if ($Directory) {
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    } else {
        $acl = New-Object Security.AccessControl.FileSecurity
        $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($sid)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule(
        $sid,
        [Security.AccessControl.FileSystemRights]::FullControl,
        $inheritance,
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
    if ($Directory) { [IO.Directory]::SetAccessControl($Path, $acl) }
    else { [IO.File]::SetAccessControl($Path, $acl) }
}

function Assert-PrivateAcl([string]$Path, [bool]$Directory) {
    $sid = Current-Sid
    if ($Directory) { $acl = [IO.Directory]::GetAccessControl($Path) }
    else { $acl = [IO.File]::GetAccessControl($Path) }
    if (-not $acl.AreAccessRulesProtected) { Fail 'acl_inheritance' }
    $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($owner -ne $sid.Value) { Fail 'acl_owner' }
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if ($rules.Count -lt 1) { Fail 'acl_empty' }
    foreach ($rule in $rules) {
        if ($rule.IdentityReference.Value -ne $sid.Value) { Fail 'acl_principal' }
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { Fail 'acl_deny' }
        if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl) {
            Fail 'acl_rights'
        }
    }
}

function Ensure-StoreRoot {
    if (-not [IO.Directory]::Exists($StoreRoot)) {
        [void][IO.Directory]::CreateDirectory($StoreRoot)
        Set-PrivateAcl -Path $StoreRoot -Directory $true
    }
    Assert-NoReparseChain -Path $StoreRoot -MustExist $true
    Assert-PrivateAcl -Path $StoreRoot -Directory $true
}

function Read-TargetValue {
    Assert-PrivateAcl -Path $target -Directory $false
    $envelope = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($target, [Text.Encoding]::UTF8))
    if ($envelope.version -ne $StoreVersion -or $envelope.protection -ne 'dpapi-current-user' -or $envelope.account -ne $account) {
        Fail 'envelope'
    }
    $cipher = [Convert]::FromBase64String([string]$envelope.ciphertext)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
        $cipher, $Entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    try {
        return [Text.Encoding]::UTF8.GetString($plain)
    } finally {
        [Array]::Clear($cipher, 0, $cipher.Length)
        [Array]::Clear($plain, 0, $plain.Length)
    }
}

try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { Fail 'windows_required' }
    Add-Type -AssemblyName System.Security -ErrorAction Stop
    $inputText = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($inputText) -or $inputText.Length -gt 2000000) { Fail 'input_size' }
    $inputObject = ConvertFrom-Json -InputObject $inputText
    if ($inputObject.operation -ne $Operation) { Fail 'operation_mismatch' }
    $account = [string]$inputObject.account
    if ($account -notmatch '^[0-9a-f]{64}$') { Fail 'scope' }
    $target = [IO.Path]::Combine($StoreRoot, ($account + '.dpapi'))
    Ensure-StoreRoot
    Assert-NoReparseChain -Path $target -MustExist ([IO.File]::Exists($target))

    if ($Operation -eq 'get') {
        if (-not [IO.File]::Exists($target)) {
            [Console]::Out.Write('{"value":null}')
            exit 0
        }
        [Console]::Out.Write((ConvertTo-Json -InputObject @{ value = (Read-TargetValue) } -Compress))
        exit 0
    }

    if ($Operation -eq 'set-if-absent' -and [IO.File]::Exists($target)) {
        [Console]::Out.Write((ConvertTo-Json -InputObject @{ value = (Read-TargetValue); created = $false } -Compress))
        exit 0
    }

    if ($Operation -eq 'delete') {
        if ([IO.File]::Exists($target)) {
            Assert-PrivateAcl -Path $target -Directory $false
            [IO.File]::Delete($target)
        }
        [Console]::Out.Write('{"ok":true}')
        exit 0
    }

    if ($null -eq $inputObject.value -or $inputObject.value -isnot [string]) { Fail 'value' }
    $plain = [Text.Encoding]::UTF8.GetBytes([string]$inputObject.value)
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
        $plain, $Entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    $envelope = ConvertTo-Json -InputObject @{
        version = $StoreVersion
        protection = 'dpapi-current-user'
        account = $account
        ciphertext = [Convert]::ToBase64String($cipher)
    } -Compress
    $temporary = [IO.Path]::Combine($StoreRoot, ([Guid]::NewGuid().ToString('N') + '.tmp'))
    try {
        [IO.File]::WriteAllText($temporary, $envelope, (New-Object Text.UTF8Encoding($false)))
        Set-PrivateAcl -Path $temporary -Directory $false
        Assert-NoReparseChain -Path $temporary -MustExist $true
        Assert-PrivateAcl -Path $temporary -Directory $false
        if ($Operation -eq 'set-if-absent') {
            try {
                [IO.File]::Move($temporary, $target)
                $created = $true
                $stored = [string]$inputObject.value
            } catch [IO.IOException] {
                if (-not [IO.File]::Exists($target)) { throw }
                Assert-NoReparseChain -Path $target -MustExist $true
                $created = $false
                $stored = Read-TargetValue
            }
        } elseif ([IO.File]::Exists($target)) {
            Assert-PrivateAcl -Path $target -Directory $false
            # Preserve a true null backup path across PowerShell's string binding.
            [IO.File]::Replace($temporary, $target, [NullString]::Value)
        } else {
            [IO.File]::Move($temporary, $target)
        }
        Assert-NoReparseChain -Path $target -MustExist $true
        Assert-PrivateAcl -Path $target -Directory $false
    } finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
        [Array]::Clear($plain, 0, $plain.Length)
        [Array]::Clear($cipher, 0, $cipher.Length)
    }
    if ($Operation -eq 'set-if-absent') {
        [Console]::Out.Write((ConvertTo-Json -InputObject @{ value = $stored; created = $created } -Compress))
    } else {
        [Console]::Out.Write('{"ok":true}')
    }
} catch {
    [Console]::Error.WriteLine('runtime_onboarding_secure_store_failed')
    exit 1
}