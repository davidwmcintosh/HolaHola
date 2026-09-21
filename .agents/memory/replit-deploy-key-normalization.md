---
name: Replit deploy-key normalization
description: Replit secret storage can collapse armored private keys to one line, requiring exact-format runtime normalization before cryptographic use.
---

For repository-scoped GitHub deploy keys stored in Replit Secrets, treat the
armored private key as potentially single-line even when it was pasted with
line breaks. Reconstruct the matching header, base64 body, and footer only in
a mode-0600 temporary file before OpenSSH or Git uses it; delete that file at
exit.

**Why:** A valid key stored this way fails OpenSSH's direct private-key parser,
which can look like a malformed credential even though the matching GitHub
Deploy key is correctly installed. Normalizing the temporary representation
restores authentication without exposing or changing the secret.

**How to apply:** Keep the public `ssh-ed25519`/similar line only in GitHub's
repository Deploy keys. Keep the private armored key only in
`HOLAHOLA_GITHUB_DEPLOY_KEY`; never place either key in a Git URL, log, or
committed file. Any unattended Git workflow must validate and normalize the
private material before use.

This also applies to PKCS#8 PEM values used by application cryptography. Replit
may replace the original PEM newlines with spaces, leaving the exact header and
footer on one line. Normalize only a narrowly matched key format: require the
exact expected boundaries, permit only Base64 characters and whitespace in the
body, remove body whitespace, restore canonical wrapping, then let the platform
crypto parser validate the bytes and explicitly verify the asymmetric key type.

**Why:** Treating a space-collapsed PEM as an invalid key can trigger needless
key replacement, while accepting arbitrary one-line text would widen the secret
parser and create key-confusion risk.

**How to apply:** Keep format-specific normalizers narrow and fail closed. Never
log the private value. Derive and persist only the public key and fingerprint
after the normalized private key has parsed and passed its explicit type check.
