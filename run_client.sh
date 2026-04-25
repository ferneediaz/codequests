#!/usr/bin/env bash

set -euo pipefail

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 <number_of_sessions> [start_port]"
  echo "Example: $0 5"
  echo "Example: $0 5 5173"
  exit 1
fi

if ! [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: number_of_sessions must be a positive integer."
  exit 1
fi

SESSIONS="$1"
START_PORT="${2:-5173}"

if ! [[ "$START_PORT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: start_port must be a positive integer."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$SCRIPT_DIR/client"

if [[ ! -d "$CLIENT_DIR" ]]; then
  echo "Error: client directory not found at $CLIENT_DIR"
  exit 1
fi

if [[ ! -f "$CLIENT_DIR/package.json" ]]; then
  echo "Error: package.json not found in $CLIENT_DIR"
  exit 1
fi

echo "Starting $SESSIONS client session(s) from $CLIENT_DIR"
echo "Base port: $START_PORT"
echo

URLS=()
PIDS=()

cleanup() {
  echo
  echo "Stopping all client sessions..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait || true
  echo "All client sessions stopped."
}

trap 'cleanup; exit 0' INT TERM

for ((i = 0; i < SESSIONS; i++)); do
  PORT=$((START_PORT + i))
  URL="http://localhost:$PORT"

  (
    cd "$CLIENT_DIR"
    npm run dev -- --port "$PORT"
  ) >/dev/null 2>&1 &

  PID=$!
  echo "Session $((i + 1)) -> $URL (pid: $PID)"
  URLS+=("$URL")
  PIDS+=("$PID")
done

echo
echo "All sessions started."
echo
echo "Quick links (click to open):"
for url in "${URLS[@]}"; do
  echo "$url"
done
echo
echo "Press Ctrl+C to stop all sessions."

while true; do
  sleep 1
done
