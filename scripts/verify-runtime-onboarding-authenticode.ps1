[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$LiteralPath
)

# Trusted tooling, not a package payload. Read-only; never executes the helper.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)

try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'windows_required'
    }
    $helper = [IO.Path]::GetFullPath($LiteralPath)
    $root = [IO.Directory]::GetParent([IO.Directory]::GetParent($helper).FullName).FullName
    $expected = @(
        'bin/holahola-onboarding.mjs', 'lib/runtime-onboarding-sdk.mjs',
        'scripts/runtime-onboarding-native-store.ps1', 'package.json',
        'README.txt', 'manifest.json'
    )
    if ($helper -cne [IO.Path]::Combine($root, 'scripts', 'runtime-onboarding-native-store.ps1')) {
        throw 'helper_path'
    }
    foreach ($relative in $expected) {
        $path = [IO.Path]::Combine($root, $relative.Replace('/', '\'))
        $current = $path
        while (-not [string]::IsNullOrWhiteSpace($current)) {
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'reparse_point'
            }
            $parent = [IO.Directory]::GetParent($current)
            if ($null -eq $parent) { break }
            $current = $parent.FullName
        }
        # Preserve actual download marks, but refuse hidden executable/data streams.
        foreach ($stream in @(Get-Item -LiteralPath $path -Stream '*' -ErrorAction Stop)) {
            if ($stream.Stream -cne ':$DATA' -and $stream.Stream -cne 'Zone.Identifier') {
                throw 'unexpected_stream'
            }
        }
    }

    Add-Type -AssemblyName System.Security
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class HolaOnboardingOfflineTrust {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct FileInfo {
        public uint cbStruct;
        [MarshalAs(UnmanagedType.LPWStr)] public string path;
        public IntPtr file;
        public IntPtr knownSubject;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct TrustData {
        public uint cbStruct;
        public IntPtr policyCallback;
        public IntPtr sipClient;
        public uint uiChoice;
        public uint revocationChecks;
        public uint unionChoice;
        public IntPtr fileInfo;
        public uint stateAction;
        public IntPtr stateData;
        public IntPtr urlReference;
        public uint providerFlags;
        public uint uiContext;
        public IntPtr signatureSettings;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProviderSigner {
        public uint cbStruct;
        public System.Runtime.InteropServices.ComTypes.FILETIME verifyAsOf;
        public uint certChainCount;
        public IntPtr certChain;
        public uint signerType;
        public IntPtr signerInfo;
        public uint error;
        public uint counterSignerCount;
        public IntPtr counterSigners;
        public IntPtr chainContext;
    }
    [DllImport("wintrust.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
    private static extern int WinVerifyTrust(IntPtr window, ref Guid action, ref TrustData data);
    [DllImport("wintrust.dll", ExactSpelling = true)]
    private static extern IntPtr WTHelperProvDataFromStateData(IntPtr state);
    [DllImport("wintrust.dll", ExactSpelling = true)]
    private static extern IntPtr WTHelperGetProvSignerFromChain(
        IntPtr provider, uint index, [MarshalAs(UnmanagedType.Bool)] bool counterSigner, uint counterIndex);

    public static int Verify(string path, out bool timestampValidated) {
        timestampValidated = false;
        var file = new FileInfo { cbStruct = (uint)Marshal.SizeOf(typeof(FileInfo)), path = path };
        IntPtr ptr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(FileInfo)));
        Marshal.StructureToPtr(file, ptr, false);
        var data = new TrustData {
            cbStruct = (uint)Marshal.SizeOf(typeof(TrustData)),
            uiChoice = 2,          // WTD_UI_NONE: never prompt to establish trust
            revocationChecks = 1,  // WTD_REVOKE_WHOLECHAIN
            unionChoice = 1,       // WTD_CHOICE_FILE: embedded file signature
            fileInfo = ptr,
            stateAction = 1,       // WTD_STATEACTION_VERIFY
            providerFlags = 0x1080 // CACHE_ONLY_URL_RETRIEVAL | REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT
        };
        Guid action = new Guid("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");
        try {
            int status = WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            if (status != 0) return status;
            IntPtr provider = WTHelperProvDataFromStateData(data.stateData);
            if (provider == IntPtr.Zero) throw new InvalidOperationException("missing_trust_provider");
            IntPtr signerPtr = WTHelperGetProvSignerFromChain(provider, 0, false, 0);
            if (signerPtr == IntPtr.Zero) throw new InvalidOperationException("missing_verified_signer");
            var signer = (ProviderSigner)Marshal.PtrToStructure(signerPtr, typeof(ProviderSigner));
            if (signer.error != 0 || signer.counterSignerCount > 1)
                throw new InvalidOperationException("invalid_verified_signer");
            if (signer.counterSignerCount == 1) {
                IntPtr counterPtr = WTHelperGetProvSignerFromChain(provider, 0, true, 0);
                if (counterPtr == IntPtr.Zero) throw new InvalidOperationException("missing_timestamp_signer");
                var counter = (ProviderSigner)Marshal.PtrToStructure(counterPtr, typeof(ProviderSigner));
                if (counter.error != 0 || counter.certChainCount == 0 || counter.chainContext == IntPtr.Zero)
                    throw new InvalidOperationException("invalid_verified_timestamp");
                timestampValidated = true;
            }
            return status;
        } finally {
            data.stateAction = 2; // WTD_STATEACTION_CLOSE, including failed verification
            WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            Marshal.DestroyStructure(ptr, typeof(FileInfo));
            Marshal.FreeHGlobal(ptr);
        }
    }
}
'@
    $bytes = [IO.File]::ReadAllBytes($helper)
    $utf8 = New-Object Text.UTF8Encoding($false, $true)
    $text = $utf8.GetString($bytes)
    $pattern = '(?m)^# SIG # Begin signature block\r?\n((?:# [A-Za-z0-9+/=]+\r?\n)+)# SIG # End signature block(?:\r?\n)?\z'
    $blocks = [regex]::Matches($text, $pattern)
    if ($blocks.Count -ne 1) { throw 'signature_block' }
    $base64 = ($blocks[0].Groups[1].Value -replace '(?m)^# ', '') -replace '\s', ''
    $cms = New-Object Security.Cryptography.Pkcs.SignedCms
    $cms.Decode([Convert]::FromBase64String($base64))
    if ($cms.SignerInfos.Count -ne 1) { throw 'signer_count' }
    # Cryptographic CMS validity plus native SIP/file digest and Windows trust.
    $cms.CheckSignature($true)
    $signer = $cms.SignerInfos[0]
    if ($signer.DigestAlgorithm.Value -ne '2.16.840.1.101.3.4.2.1') {
        throw 'sha256_signing_required'
    }
    $timestampCount = 0
    foreach ($attribute in $signer.UnsignedAttributes) {
        if ($attribute.Oid.Value -eq '1.2.840.113549.1.9.6' -or
            $attribute.Oid.Value -eq '1.3.6.1.4.1.311.3.3.1') {
            $timestampCount += $attribute.Values.Count
        }
    }
    if ($timestampCount -gt 1) { throw 'timestamp_count' }
    $timestampValidated = $false
    $status = [HolaOnboardingOfflineTrust]::Verify($helper, [ref]$timestampValidated)
    if ($status -ne 0) { throw 'offline_authenticode_invalid_or_cache_unavailable' }
    # A bad timestamp may be ignored while a currently valid signature passes.
    # Require the verified provider countersigner, not mere CMS attribute presence.
    if ($timestampValidated -ne ($timestampCount -eq 1)) { throw 'timestamp_not_validated' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $helperHash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
        $certHash = ([BitConverter]::ToString($sha.ComputeHash($signer.Certificate.RawData))).Replace('-', '').ToLowerInvariant()
    } finally { $sha.Dispose() }
    $receipt = @{
        format = 'holahola-runtime-onboarding-authenticode/v1'
        helperSha256 = $helperHash
        winVerifyTrustStatus = $status
        subject = $signer.Certificate.Subject
        certificateSha256 = $certHash
        timestampPresent = ($timestampCount -eq 1)
        certificateNotAfter = $signer.Certificate.NotAfter.ToUniversalTime().ToString('o')
    }
    [Console]::Out.Write((ConvertTo-Json -InputObject $receipt -Compress))
} catch {
    [Console]::Error.WriteLine('onboarding_windows_offline_authenticode_verification_failed')
    exit 1
}