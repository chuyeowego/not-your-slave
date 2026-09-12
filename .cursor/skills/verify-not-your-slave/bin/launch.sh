#!/usr/bin/env bash
# Start a not-your-slave dev server dedicated to verification: its own port, its
# own mindlog file, and (by default) a sandbox backend that needs no VM.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"

PORT="${NYS_PORT:-2999}"
RUN_DIR="${NYS_RUN_DIR:-/tmp/nys-verify/$(date +%Y%m%d-%H%M%S)}"
SANDBOX="just-bash"
SESSION="nys-verify-$PORT"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; SESSION="nys-verify-$PORT"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    --sandbox) SANDBOX="$2"; shift 2 ;;
    -h|--help)
      echo "usage: launch.sh [--port N] [--run-dir DIR] [--sandbox just-bash|real]"
      exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

TMUX="tmux"
[ -f /exec-daemon/tmux.portal.conf ] && TMUX="tmux -f /exec-daemon/tmux.portal.conf"

# eve dev owns .eve/ for the whole checkout. On shutdown it acts on the
# dev-cleanup-intent it registered and removes the shared compile output, which
# guts any other dev server still serving from it — the victim starts answering
# 500 with a missing compiled-agent-manifest.json. Separate ports and run dirs
# do not help. Refuse, rather than hand back a run whose failures are really
# the other run's teardown.
others=$($TMUX list-sessions -F '#S' 2>/dev/null | grep '^nys-verify-' | grep -vx "$SESSION" || true)
if [ -n "$others" ]; then
  echo "refusing to launch: a verification instance is already running ($(echo "$others" | tr '\n' ' '))." >&2
  echo "eve dev shares .eve/ across this checkout, so a second instance breaks both." >&2
  echo "Stop that one first:  bin/cleanup.sh --run-dir <its run dir>" >&2
  exit 1
fi

mkdir -p "$RUN_DIR"
echo "$PORT" > "$RUN_DIR/port"
echo "$SESSION" > "$RUN_DIR/tmux-session"

# eve needs Node 24; a machine can easily have an older default on PATH.
if command -v node >/dev/null && [ "$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')" -ge 24 ]; then
  NODE_BIN="$(dirname "$(command -v node)")"
else
  NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/v24.* 2>/dev/null | sort -V | tail -1)/bin"
  if [ ! -x "$NODE_BIN/node" ]; then
    echo "need Node >= 24 (eve refuses to start otherwise). Install it, e.g. \`nvm install 24\`." >&2
    exit 1
  fi
fi

# The real default backend (Vercel Sandbox / Docker / microsandbox) boots a VM or
# container per session: minutes on a cold machine, and impossible where nested
# virtualisation is unavailable. The web surface does not need real binaries, so
# verification stubs the sandbox and records that it did.
#
# Ownership is decided by the marker in the file, never by which run wrote it.
# Keying off "did this run create it" loses the scaffold the moment a relaunch
# finds one already there: every later run records skipped, no cleanup ever
# removes it, and an untracked agent/sandbox.ts sits in the tree waiting for
# someone's `git add -A`.
SCAFFOLD="$REPO_DIR/agent/sandbox.ts"
SCAFFOLD_MARKER="VERIFICATION SCAFFOLDING — written by .cursor/skills/verify-not-your-slave"
if [ "$SANDBOX" = "just-bash" ]; then
  if [ -e "$SCAFFOLD" ] && ! grep -qF "$SCAFFOLD_MARKER" "$SCAFFOLD"; then
    echo "scaffold-skipped: agent/sandbox.ts is a real config, not ours; leaving it alone" | tee "$RUN_DIR/scaffold.txt"
  else
    cat > "$SCAFFOLD" <<'EOF'
// VERIFICATION SCAFFOLDING — written by .cursor/skills/verify-not-your-slave.
// Not part of the app. `bin/cleanup.sh` deletes it. Committing it would give
// production a simulated bash with no real binaries.
import { defineSandbox } from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

export default defineSandbox({
  backend: justbash(),
});
EOF
    echo "scaffold-created" > "$RUN_DIR/scaffold.txt"
  fi
fi

# eve keeps durable session state under .eve. A session left failed by an earlier
# run swallows new messages, so verification starts from a clean slate.
rm -rf "$REPO_DIR/.eve/.workflow-data" "$REPO_DIR/.eve/dev-runtime" "$REPO_DIR/.eve/dev-server-state.v1.json"

$TMUX kill-session -t "=$SESSION" 2>/dev/null || true
$TMUX new-session -d -s "$SESSION" -c "$REPO_DIR" -- bash -l
$TMUX send-keys -t "$SESSION:0.0" \
  "export PATH=\"$NODE_BIN:\$PATH\"; cd $REPO_DIR && MINDLOG_FILE=$RUN_DIR/mindlog.jsonl npx eve dev --no-ui --port $PORT 2>&1 | tee $RUN_DIR/dev.log" C-m

printf 'waiting for http://127.0.0.1:%s ' "$PORT"
for _ in $(seq 1 120); do
  if grep -q "server listening" "$RUN_DIR/dev.log" 2>/dev/null; then
    printf '\n'
    echo "ready: http://127.0.0.1:$PORT"
    echo "run dir: $RUN_DIR"
    echo "mindlog: $RUN_DIR/mindlog.jsonl (isolated; your .data/mindlog.jsonl is untouched)"
    exit 0
  fi
  printf '.'
  sleep 1
done

printf '\n'
echo "dev server did not report ready; last log lines:" >&2
tail -20 "$RUN_DIR/dev.log" >&2 || true
exit 1
