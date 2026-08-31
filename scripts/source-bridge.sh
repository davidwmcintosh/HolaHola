#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  status)
    exec npx tsx server/scripts/source-control-cli.ts status
    ;;
  *)
    echo "The legacy source bridge is retired and cannot mutate Git." >&2
    echo "Use the authenticated API or: npx tsx server/scripts/source-control-cli.ts sync --actor <label>" >&2
    exit 78
    ;;
esac