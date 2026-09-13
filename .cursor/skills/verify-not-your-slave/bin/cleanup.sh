#!/usr/bin/env bash
# Tear down only what a launch created. Evidence under the run dir survives.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"

PORT="${NYS_PORT:-}"
RUN_DIR="${NYS_RUN_DIR:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    -h|--help) echo "usage: cleanup.sh [--port N] [--run-dir DIR]"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# The run dir records the port its launch took. Trust that over the default, or
# cleaning up one run kills whatever happens to hold port 2999 — which is the
# other instance, not ours.
[ -z "$PORT" ] && [ -n "$RUN_DIR" ] && [ -f "$RUN_DIR/port" ] && PORT="$(cat "$RUN_DIR/port")"
PORT="${PORT:-2999}"

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

# Remove the scaffold when it carries our marker, whichever run wrote it — but
# only once no verification instance is left running. A live server is executing
# with that backend, and pulling the file mid-run silently switches it back to
# the default. A real agent/sandbox.ts has no marker and is never touched.
SCAFFOLD="$REPO_DIR/agent/sandbox.ts"
remaining=$($TMUX list-sessions -F '#S' 2>/dev/null | grep -c '^nys-verify-') || remaining=0
if [ ! -f "$SCAFFOLD" ]; then
  :
elif ! grep -qF "VERIFICATION SCAFFOLDING — written by .cursor/skills/verify-not-your-slave" "$SCAFFOLD"; then
  echo "left agent/sandbox.ts alone (not ours)"
elif [ "$remaining" -gt 0 ]; then
  echo "left the scaffold in place: another verification instance is still running"
else
  rm -f "$SCAFFOLD"
  echo "removed verification scaffold agent/sandbox.ts"
fi

# .eve is deliberately left alone. It belongs to the checkout, not to this run:
# .eve/dev-runtime is the compiled snapshot a live server executes from, and
# deleting it here is what once left another instance answering 500 with a
# missing compiled-agent-manifest.json. The next launch clears the one piece
# that actually goes stale (.workflow-data) while nothing is running.

[ -n "$RUN_DIR" ] && echo "evidence kept: $RUN_DIR"
exit 0
