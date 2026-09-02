#!/usr/bin/env bash
# Local Postgres for the mindlog, so development runs the same code path as a
# deployment without talking to a cloud database on every append.
set -euo pipefail

NAME=nys-pg
VOLUME=nys-pgdata
PORT=${MINDLOG_DB_PORT:-55432}
URL="postgres://postgres:test@localhost:${PORT}/mindlog"
ENV_FILE=.env.local

running() { [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = "true" ]; }
exists()  { docker inspect "$NAME" >/dev/null 2>&1; }

# The env file decides which store the agent uses, so it tracks the container:
# no database running means the file store, not a dead connection string.
set_url() {
  touch "$ENV_FILE"
  grep -q '^DATABASE_URL=' "$ENV_FILE" || printf 'DATABASE_URL=%s\n' "$URL" >> "$ENV_FILE"
}
unset_url() {
  [ -f "$ENV_FILE" ] || return 0
  grep -v '^DATABASE_URL=' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
}

case "${1:-}" in
  up)
    if running; then echo "already running on :$PORT"; else
      exists && docker start "$NAME" >/dev/null || \
        docker run -d --name "$NAME" -v "$VOLUME:/var/lib/postgresql/data" \
          -e POSTGRES_PASSWORD=test -e POSTGRES_DB=mindlog \
          -p "$PORT:5432" postgres:17-alpine >/dev/null
      until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
      echo "postgres up on :$PORT"
    fi
    set_url
    echo "DATABASE_URL set in $ENV_FILE — the agent will use Postgres"
    ;;
  down)
    running && docker stop "$NAME" >/dev/null && echo "postgres stopped" || echo "not running"
    unset_url
    echo "DATABASE_URL removed from $ENV_FILE — the agent falls back to the file store"
    ;;
  reset)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker volume rm "$VOLUME" >/dev/null 2>&1 || true
    echo "container and data volume removed"
    "$0" up
    ;;
  psql)   exec docker exec -it "$NAME" psql -U postgres -d mindlog ;;
  status)
    running && echo "running on :$PORT" || echo "stopped"
    grep -q '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null && echo "env: Postgres" || echo "env: file store"
    docker exec "$NAME" psql -U postgres -d mindlog -tAc \
      "select count(*) || ' entries' from mindlog" 2>/dev/null || true
    ;;
  *) echo "usage: npm run db:{up|down|reset|psql|status}"; exit 1 ;;
esac
