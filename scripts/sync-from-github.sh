#!/usr/bin/env bash
set -euo pipefail

echo "Direct GitHub receive is disabled. Use the TypeScript source-control coordinator; receive is fast-forward-only." >&2
exit 78