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
  *)
    echo "Usage: ./run.sh [current|test]"
    exit 1
    ;;
esac
