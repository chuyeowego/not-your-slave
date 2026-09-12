#!/usr/bin/env bash
# Read-only: is this instance worth driving, and which tier of proof can it give?
set -uo pipefail

PORT="${NYS_PORT:-2999}"
RUN_DIR="${NYS_RUN_DIR:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    -h|--help) echo "usage: doctor.sh [--port N] [--run-dir DIR]"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

BASE="http://127.0.0.1:$PORT"
fail=0
say() { printf '%-22s %s\n' "$1" "$2"; }

code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/" 2>/dev/null)
if [ "$code" = "200" ]; then say "page" "200 $BASE/"; else say "page" "FAIL (got '${code:-no response}')"; fail=1; fi

# A stray server from another checkout answers on the port too. The composer and
# the mindlog pane together identify this app.
markers=$(curl -sS "$BASE/" 2>/dev/null | grep -c 'id="composer"\|id="mindlog"')
if [ "${markers:-0}" -ge 2 ]; then say "app markers" "composer + mindlog present"; else say "app markers" "FAIL (this port is not not-your-slave)"; fail=1; fi

say "session" "$(curl -sS "$BASE/api/session" 2>/dev/null || echo unreachable)"
say "mindlog entries" "$(curl -sS "$BASE/api/mindlog?limit=500" 2>/dev/null | grep -o '"kind"' | wc -l | tr -d ' ')"

if [ -n "$RUN_DIR" ] && [ -f "$RUN_DIR/dev.log" ]; then
  backend=$(grep -o 'on backend "[^"]*"' "$RUN_DIR/dev.log" | tail -1 | sed 's/.*"\(.*\)"/\1/')
  say "sandbox backend" "${backend:-not opened yet}"
  if grep -q 'Sandbox provisioning failed' "$RUN_DIR/dev.log"; then
    say "sandbox" "FAIL — provisioning failed; relaunch with --sandbox just-bash"
    fail=1
  fi
fi

if [ -n "${AI_GATEWAY_API_KEY:-}${VERCEL_OIDC_TOKEN:-}" ] || grep -qs 'AI_GATEWAY_API_KEY\|VERCEL_OIDC_TOKEN' "$(dirname "${BASH_SOURCE[0]}")/../../../../.env.local"; then
  say "tier" "B — model credential present: agent replies are verifiable"
else
  say "tier" "A — no model credential: everything up to the model call only"
fi

[ "$fail" = 0 ] && echo "doctor: ok" || echo "doctor: NOT ok"
exit "$fail"
