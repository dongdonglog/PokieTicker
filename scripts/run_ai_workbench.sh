#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_LOG="$ROOT_DIR/.tmp/ai-workbench-backend.log"
BOOTSTRAP=0
IMPORT_SAMPLE=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/run_ai_workbench.sh [--bootstrap] [--import-sample]

Options:
  --bootstrap     Create venv if needed, install backend requirements, and run frontend npm install
  --import-sample Import data/imports/example_aapl.csv before starting services
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bootstrap)
      BOOTSTRAP=1
      shift
      ;;
    --import-sample)
      IMPORT_SAMPLE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"
mkdir -p "$ROOT_DIR/.tmp"

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [[ "$BOOTSTRAP" -eq 1 ]]; then
  if [[ ! -x venv/bin/python ]]; then
    python3 -m venv venv
  fi
  venv/bin/pip install -r requirements.txt
  (cd frontend && npm install)
fi

if [[ ! -x venv/bin/python ]]; then
  echo "Missing venv. Run: ./scripts/run_ai_workbench.sh --bootstrap"
  exit 1
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "Missing frontend/node_modules. Run: ./scripts/run_ai_workbench.sh --bootstrap"
  exit 1
fi

if [[ "$IMPORT_SAMPLE" -eq 1 ]]; then
  if [[ -f data/imports/example_aapl.csv ]]; then
    venv/bin/python -m backend.import_ohlc data/imports/example_aapl.csv
  else
    echo "Sample CSV not found at data/imports/example_aapl.csv"
    exit 1
  fi
fi

if ! grep -Eq '^(ANTHROPIC_API_KEY|OPENAI_COMPATIBLE_API_KEY)=' .env 2>/dev/null; then
  echo "Warning: no AI key found in .env. The app will start, but AI answers will fail until configured."
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

venv/bin/python -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000 >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo "Backend starting on http://127.0.0.1:8000"
echo "Backend log: $BACKEND_LOG"
echo "Frontend starting on http://127.0.0.1:5173"
echo "Press Ctrl+C to stop both services"

cd "$ROOT_DIR/frontend"
npm run dev -- --host 127.0.0.1
