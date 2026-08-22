---
name: GitHub npm proxy lockfiles
description: Why GitHub CI must normalize Replit npm proxy URLs in the lockfile before a clean install.
---

GitHub-hosted CI must replace Replit’s `package-firewall` npm tarball URL prefix
with the public npm registry prefix before running `npm ci`.

**Why:** The Replit proxy hostname is private to this environment. npm’s
`replace-registry-host` setting only replaces the host and retains the proxy’s
`/npm/` path, which turns a public request into an invalid
`registry.npmjs.org/npm/...` URL.

**How to apply:** Keep dependency integrity hashes and versions unchanged.
Normalize only the registry URL prefix inside the CI workspace before the
install, then explicitly verify the local test toolchain and application import
path before running tests.