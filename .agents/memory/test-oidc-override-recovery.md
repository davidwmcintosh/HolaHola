---
name: Test OIDC override recovery
description: How to restore normal development sign-in after browser-test mock OIDC affects the running app.
---

Browser-test authentication can temporarily make the running development app
use Replit's mock OIDC issuer. A manual browser sign-in then redirects through
the test issuer and returns to the app unauthenticated.

**Why:** Test claims are context-scoped, while the running app's issuer
configuration can outlive the test browser interaction. Treating the resulting
redirect loop as a user-account issue sends diagnosis in the wrong direction.

**How to apply:** Before asking a person to retry a manual sign-in after
browser-auth testing, restart the existing application workflow. Verify only
the redirect issuer host (not cookies, tokens, or full auth URLs) is back to
the normal Replit issuer, then have the person reload the preview.