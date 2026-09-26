---
name: Replit sandbox vs CI ambient environment gaps
description: Replit's dev sandbox has ambient tools and secrets a bare CI runner (e.g. GitHub Actions ubuntu-latest) does not; code/tests relying on them pass locally and fail only in CI.
---

Replit's nix-based dev sandbox ships tools and ambient secrets that a bare CI runner does not. Code or tests that implicitly depend on either will pass locally every time and fail only when run in the other environment. The failure is not flaky; it is a real environment-parity gap that surfaces as soon as the right code path is exercised there.

**Why:** Two confirmed instances in the same investigation. (1) `ripgrep` (`rg`) is present by default in the Replit nix sandbox but absent from GitHub's `ubuntu-latest` runner image, so a test that forces the rg-available branch of a search tool (to prove parity with its own JS fallback) only fails on GitHub. (2) `SESSION_SECRET` is always set as an ambient secret in the Replit sandbox, so a service (`coordination-inbox-service.ts`) that signs tokens with `COORDINATION_INBOX_TOKEN_SECRET || SESSION_SECRET` and requires >=32 chars never hits its own "not configured" error locally, but GitHub Actions' job env sets neither.

**How to apply:** When a test or code path only fails in GitHub Actions (or any external CI) and passes locally on Replit, suspect an ambient-tool or ambient-secret gap before suspecting flakiness or a logic bug. Fix by making the CI environment match the real contract (install the missing tool in the workflow) when the dependency is legitimate infrastructure, or by generating a disposable/run-scoped value inside the test harness itself (matching how disposable test databases are already generated) when the dependency is just a signing/config secret that a hermetic test run shouldn't need to share with the real app.

