#!/usr/bin/env bash
# Tear down only what a launch created. Evidence under the run dir survives.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"

PORT="${NYS_PORT:-2999}"
RUN_DIR="${NYS_RUN_DIR:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    -h|--help) echo "usage: cleanup.sh [--port N] [--run-dir DIR]"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

SESSION="nys-verify-$PORT"
[ -n "$RUN_DIR" ] && [ -f "$RUN_DIR/tmux-session" ] && SESSION="$(cat "$RUN_DIR/tmux-session")"

TMUX="tmux"
[ -f /exec-daemon/tmux.portal.conf ] && TMUX="tmux -f /exec-daemon/tmux.portal.conf"

if $TMUX has-session -t "=$SESSION" 2>/dev/null; then
  $TMUX kill-session -t "=$SESSION"
  echo "killed tmux session $SESSION"
else
  echo "no tmux session $SESSION"
fi

# Never pkill by name: another checkout's dev server is not ours to kill.
pid=$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
if [ -n "${pid:-}" ]; then
  kill "$pid" 2>/dev/null && echo "stopped listener on :$PORT (pid $pid)"
fi

if [ -n "$RUN_DIR" ] && [ "$(cat "$RUN_DIR/scaffold.txt" 2>/dev/null)" = "scaffold-created" ]; then
  rm -f "$REPO_DIR/agent/sandbox.ts"
  echo "removed verification scaffold agent/sandbox.ts"
fi

rm -rf "$REPO_DIR/.eve/.workflow-data" "$REPO_DIR/.eve/dev-runtime" "$REPO_DIR/.eve/dev-server-state.v1.json"
echo "cleared dev session state"

[ -n "$RUN_DIR" ] && echo "evidence kept: $RUN_DIR"
exit 0
