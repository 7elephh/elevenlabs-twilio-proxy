#!/usr/bin/env bash
# Lance un PostgreSQL éphémère, applique les migrations et exécute les tests BDD.
# Usage : npm run test:db   (nécessite les binaires PostgreSQL >= 15)
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
DATA_DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$DATA_DIR"
  RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA_DIR"; }
trap cleanup EXIT
"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -w start >/dev/null
export TEST_DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/postgres"
npx vitest run --config vitest.db.config.mts "$@"
