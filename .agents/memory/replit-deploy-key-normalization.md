---
name: Replit deploy-key normalization
description: Replit secret storage can collapse an armored SSH private key to one line, requiring safe runtime normalization for unattended Git authentication.
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