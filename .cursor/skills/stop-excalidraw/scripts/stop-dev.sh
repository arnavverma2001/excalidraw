#!/usr/bin/env bash
# Stop Excalidraw dev processes and free repo-related ports.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f "package.json" ]] || ! grep -q '"name": "excalidraw-monorepo"' package.json 2>/dev/null; then
  echo "ERROR: Expected excalidraw monorepo at $REPO_ROOT" >&2
  exit 1
fi

collect_ports() {
  local ports=(3000 3001 3002 3016 5000 5001)
  if [[ -f .env.development ]]; then
    local line value
    while IFS= read -r line; do
      case "$line" in
        VITE_APP_PORT=*)
          value="${line#VITE_APP_PORT=}"
          [[ -n "$value" ]] && ports+=("$value")
          ;;
        VITE_APP_WS_SERVER_URL=*|VITE_APP_AI_BACKEND=*|VITE_APP_PLUS_APP=*)
          value="${line#*=}"
          if [[ "$value" =~ localhost:([0-9]+) ]]; then
            ports+=("${BASH_REMATCH[1]}")
          fi
          ;;
      esac
    done < .env.development
  fi
  printf '%s\n' "${ports[@]}" | sort -nu
}

is_repo_process() {
  local pid="$1"
  local cmd cwd
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  cwd="$(lsof -a -d cwd -p "$pid" 2>/dev/null | awk 'NR==2 {print $NF}' || true)"
  [[ -z "$cmd" ]] && return 1
  [[ "$cmd" == *"$REPO_ROOT"* || "$cwd" == "$REPO_ROOT"* ]]
}

kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || kill -9 "$pid"
  fi
}

declare -a TARGET_PIDS=()

pid_seen() {
  local pid="$1"
  local existing
  [[ ${#TARGET_PIDS[@]} -eq 0 ]] && return 1
  for existing in "${TARGET_PIDS[@]}"; do
    [[ "$existing" == "$pid" ]] && return 0
  done
  return 1
}

add_pid() {
  local pid="$1"
  [[ -z "$pid" || "$pid" == "1" ]] && return
  pid_seen "$pid" && return
  if is_repo_process "$pid"; then
    TARGET_PIDS+=("$pid")
  fi
}

# Port listeners (vite, http-server, etc.)
while IFS= read -r port; do
  for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true); do
    add_pid "$pid"
    # Include parent shell/yarn wrappers started from this repo.
    parent="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ' || true)"
    while [[ -n "$parent" && "$parent" != "1" ]]; do
      if is_repo_process "$parent"; then
        add_pid "$parent"
        parent="$(ps -p "$parent" -o ppid= 2>/dev/null | tr -d ' ' || true)"
      else
        break
      fi
    done
  done
done < <(collect_ports)

# Remaining repo dev commands (vite, yarn start, esbuild, vitest ui, preview).
while IFS= read -r pid; do
  add_pid "$pid"
done < <(pgrep -f "$REPO_ROOT" 2>/dev/null || true)

if [[ ${#TARGET_PIDS[@]} -eq 0 ]]; then
  echo "No Excalidraw dev processes found."
else
  echo "Stopping Excalidraw processes:"
  for pid in "${TARGET_PIDS[@]}"; do
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || echo unknown)"
    echo "  - pid $pid: $cmd"
    kill_tree "$pid"
  done
fi

sleep 0.5

STILL_BUSY=()
while IFS= read -r port; do
  for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true); do
    if is_repo_process "$pid"; then
      STILL_BUSY+=("port $port (pid $pid)")
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
done < <(collect_ports)

if [[ ${#STILL_BUSY[@]} -gt 0 ]]; then
  echo "ERROR: Force-killed stubborn listeners: ${STILL_BUSY[*]}" >&2
fi

REMAINING=()
while IFS= read -r port; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
      if is_repo_process "$pid"; then
        REMAINING+=("port $port (pid $pid)")
      fi
    done
  fi
done < <(collect_ports)

if [[ ${#REMAINING[@]} -gt 0 ]]; then
  echo "ERROR: Excalidraw still listening on: ${REMAINING[*]}" >&2
  exit 1
fi

echo "All Excalidraw dev ports are free."
