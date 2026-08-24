# Local Chromium Capability Design

## Goal

Make Chromium a reliable, first-class capability for local Windows
development and preserve the same browser behavior on Replit.

## Scope

- Add one explicit setup command for installing the Playwright-managed
  Chromium browser.
- Resolve the executable in a platform-aware order:
  1. `PLAYWRIGHT_EXECUTABLE_PATH` when explicitly configured.
  2. Playwright's managed Chromium executable when it exists.
  3. A system Chromium executable (`chromium`, `chromium-browser`, or the
     Windows `where` result).
- If no executable is available, emit one actionable preflight message and
  return a clear feature error that names the setup command. The main server
  must remain available; browser-dependent flows must not produce opaque
  launch-stack errors.
- Keep the current headless/no-sandbox launch flags and in-process browser
  singleton.

## Verification

- Add focused resolver tests for managed, explicit, and unavailable paths
  without launching a browser.
- Run the existing type check and bridge-independent test suite.
- Run the setup command in the Replit workspace and verify a real Chromium
  launch where the environment supports it.
- The Windows developer runs the same setup command after pulling.

## Non-goals

- Do not install Chromium silently on every dependency install.
- Do not make the entire HolaHola server fail to start when a browser binary
  is absent.
- Do not change the unrelated object-storage, TTS-provider, or database
  warnings in this pass.