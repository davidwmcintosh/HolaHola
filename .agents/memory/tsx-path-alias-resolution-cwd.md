---
name: tsx path alias resolution depends on spawn cwd
description: Explicit tsconfig selection preserves temporary-cwd isolation while resolving project TypeScript path aliases.
---

## The quirk

By default, tsx discovers tsconfig from the spawned process's cwd, not the location of the source file being executed. A driver stored in the real checkout but run from a temporary directory can therefore fail to resolve project aliases such as @shared/schema.

**Why:** a module-loading failure can stop a hermetic test before its actual safety guard runs. Checking only for a nonzero exit can then falsely certify that guard.

**How to apply:** pass an absolute path to the real project's tsconfig with tsx --tsconfig when a subprocess must retain a temporary cwd. This preserves project alias resolution without changing its filesystem isolation.

Keeping cwd at the checkout and selecting a temporary workspace through an environment variable is valid only if the test does not require cwd itself to be temporary. Do not use that alternative when a containment guard deliberately requires cwd to match the configured temporary workspace.

Negative-path subprocess checks must require both a nonzero exit and the intended refusal message. An import failure or launch timeout is not evidence that the safety guard executed.

## Required sandbox cwd exception

When a hermetic driver explicitly requires its working directory to be the temporary sandbox, do not move it back into the checkout merely to repair alias resolution. Keep the isolation boundary and pass an absolute TSX_TSCONFIG_PATH pointing at the real checkout's TypeScript configuration. Invoke the checkout's installed tsx executable rather than asking npx to resolve a package from the sandbox.

**Why:** sandbox enforcement can depend on cwd matching the configured workspace exactly; changing cwd to fix imports would weaken that protection.

**How to apply:** use the explicit configuration path for TSX subprocesses that must run outside the checkout, including nested subprocesses that import project modules.
