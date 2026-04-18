#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-current}"

case "$MODE" in
  current)
    npm run dev:all
    ;;
  test)
    npm run test:all
    ;;
  demo)
    npm run demo:reset
    ;;
  *)
    echo "Usage: ./run.sh [current|test|demo]"
    exit 1
    ;;
esac
