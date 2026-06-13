#!/usr/bin/env bash
# Ensure the workspace is ready for development in a fresh session/container.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -d node_modules ] || [ ! -d node_modules/three ]; then
  echo "[session-start] installing dependencies…"
  npm install --no-audit --no-fund >/dev/null 2>&1 || npm install
fi

echo "[session-start] ROX-Next ready. Run 'npm run dev' (server :8080 + client :5173)."
