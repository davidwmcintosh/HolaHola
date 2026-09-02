#!/usr/bin/env bash
# Runs once when the Codespace is first created (devcontainer.json's
# postCreateCommand). Installs deps and gets .env in place; does NOT create a
# Neon branch automatically -- that's a deliberate manual step below, so a
# forgotten or resumed Codespace never silently spawns duplicate branches.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "[post-create] npm ci"
npm ci

if [ ! -f .env ]; then
  echo "[post-create] Copying .env.template -> .env (fill in values below)"
  cp .env.template .env
else
  echo "[post-create] .env already present, leaving it alone"
fi

cat <<'EOF'

[post-create] Done. Two manual steps before "npm run dev":

1. Secrets: either set these as Codespaces secrets (repo Settings ->
   Secrets and variables -> Codespaces, so they're injected automatically
   next time) or fill them into .env directly. See .env.template for the
   full list and what each one is for.

2. Database: this environment must NOT default to the shared production
   database. Create an isolated Neon branch and point NEON_SHARED_DATABASE_URL
   / DATABASE_URL at the *pooled* connection string it prints:

     npm run db:branch -- create <codespace-or-session-name>

   See .agents/skills/neon-branch/SKILL.md. Delete the branch when this
   Codespace is deleted:

     npm run db:branch -- delete <codespace-or-session-name>

Then: npm run dev  (serves on port 5000, auto-forwarded)
EOF
