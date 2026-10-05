Use exact, reviewed versions for security overrides when preparing reproducible releases. Passing local checks against installed dependencies does not prove a fresh CI installation will work.

**Why:** Fresh CI rejected an existing semver-compatible locked patch after a floating override resolved to a newer patch. Refreshing the lock through the supported package tool also raised an unrelated direct dependency's declared lower bound.

**How to apply:** Refresh dependencies through the package tools, inspect both the manifest and lockfile, preserve unaffected declared ranges, and check clean-install consistency. Do not treat regenerated metadata or local build success as proof that remote CI passed.

