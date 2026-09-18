---
name: Reconciliation service has no git auth wiring
description: source-reconciliation-service.ts's git() helper has no credential injection, unlike SourceControlService's withGithubAppAuth; its fetches depend entirely on ambient git config/credentials.
---

The reconciliation CLI path (`source-control:reconcile` → `preflight` / `candidate` / `inspect`) calls a bare `git()` helper with no auth-header injection, no repoUrl construction, and no App-token wiring — unlike the main sync service, which wraps every git call in an authenticated-header helper. `preflight` defaults to fetching from the remote literally named `origin`, resolved through whatever local `.git/config` has (SSH or HTTPS) with whatever ambient credentials happen to exist in that environment.

**Why:** discovered while trying to reconcile a real diverged-history state (local ahead by an unpushed commit, GitHub main ahead via a separately-merged branch). The local `origin` remote was configured as an SSH URL (untracked/local config, likely workspace-managed rather than app-managed) with no working SSH key or agent present, so `preflight`'s fetch would fail even after the host-key hang itself was fixed (see ssh-hostkey-pretrust.md). A GitHub deploy-key secret exists in this project and is the likely intended credential for this SSH path, but nothing in the reconciliation service currently loads it.

**How to apply:** before relying on `reconcile preflight/candidate` in a given environment, confirm a working git credential path to the target remote actually exists (SSH agent with the deploy key loaded, or pass an explicit authenticated remote). Don't assume it "just works" the way the main sync service does — the two services authenticate (or fail to) completely independently, and a clean host-key fix alone is not sufficient for this path.
