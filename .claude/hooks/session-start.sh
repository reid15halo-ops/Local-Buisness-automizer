#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

echo "[session-start] Installing Node.js dependencies..."
cd "$PROJECT_DIR"
npm install

echo "[session-start] Installing Python backend dependencies..."
if command -v pip3 &>/dev/null; then
  pip3 install -r "$PROJECT_DIR/services/backend/requirements.txt" --quiet
elif command -v pip &>/dev/null; then
  pip install -r "$PROJECT_DIR/services/backend/requirements.txt" --quiet
else
  echo "[session-start] WARNING: pip not found, skipping Python dependencies"
fi

echo "[session-start] Setup complete."
