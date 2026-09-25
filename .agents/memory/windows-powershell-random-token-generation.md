## Generating a random credential on Windows PowerShell (no openssl)

Windows PowerShell (both 5.1 and 7+) has no `openssl` binary by default, so
`openssl rand -base64 32` -- the usual recipe for a coordination-actor
bootstrap token or any other 32+ character random secret -- fails with
`CommandNotFoundException`. The natural-looking one-line substitute also
fails in a confusing way:

```powershell
[Convert]::ToBase64String((New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes(32))
```

`RNGCryptoServiceProvider.GetBytes(byte[] data)` fills an existing array
**in place** and returns nothing -- it is not the newer `RandomNumberGenerator.GetBytes(int count)`
static helper that returns a new array. Passing `32` (an int) where a
`byte[]` is expected silently resolves to a call that produces no output, so
`ToBase64String` then throws `Value cannot be null. Parameter name: inArray`
-- the error surfaces on the wrapping call, not the real cause.

**Why:** this is a genuine, repeatable trap for anyone provisioning a new
`COORDINATION_*_TOKEN`-style secret from a Windows PowerShell prompt, since
neither failure mode is obvious from the error text alone.

**How to apply:** pre-size the array, then fill it:

```powershell
$bytes = New-Object byte[] 32; (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

If that still misbehaves (older execution policy, restricted crypto APIs),
a zero-dependency fallback with no namespace resolution risk at all is two
concatenated GUIDs, which comfortably clears any 32-character minimum:

```powershell
[Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
```

