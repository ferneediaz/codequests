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

echo "Stopping $SESSIONS client session(s)"
echo "Base port: $START_PORT"
echo

TOTAL_KILLED=0

for ((i = 0; i < SESSIONS; i++)); do
  PORT=$((START_PORT + i))
  PORT_PIDS=""

  if command -v lsof >/dev/null 2>&1; then
    PORT_PIDS="$(lsof -ti tcp:"$PORT" || true)"
  else
    # Fallback for environments without lsof.
    PORT_PIDS="$(ss -lptn "sport = :$PORT" 2>/dev/null | rg -o 'pid=[0-9]+' | rg -o '[0-9]+' || true)"
  fi

  if [[ -z "$PORT_PIDS" ]]; then
    echo "Session $((i + 1)) -> port $PORT: no process found"
    continue
  fi

  # Deduplicate in case multiple sockets map to the same pid.
  UNIQUE_PIDS="$(printf '%s\n' "$PORT_PIDS" | awk 'NF && !seen[$0]++')"
  SESSION_KILLED=0

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      SESSION_KILLED=$((SESSION_KILLED + 1))
      TOTAL_KILLED=$((TOTAL_KILLED + 1))
    fi
  done <<< "$UNIQUE_PIDS"

  if [[ "$SESSION_KILLED" -gt 0 ]]; then
    echo "Session $((i + 1)) -> port $PORT: stopped $SESSION_KILLED process(es)"
  else
    echo "Session $((i + 1)) -> port $PORT: no live process found"
  fi
done

echo
echo "Done. Stopped $TOTAL_KILLED process(es) in total."
