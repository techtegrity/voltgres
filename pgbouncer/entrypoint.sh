#!/bin/sh
set -e

# Generate userlist.txt from environment variables
# The postgres superuser is needed so PgBouncer can run auth_query
# to look up other users' passwords dynamically.
USERLIST_FILE="/etc/pgbouncer/userlist.txt"

echo "\"${POSTGRES_USER:-postgres}\" \"${POSTGRES_PASSWORD:-voltgres}\"" > "$USERLIST_FILE"
chmod 600 "$USERLIST_FILE"

echo "[pgbouncer] Generated userlist for ${POSTGRES_USER:-postgres}"
echo "[pgbouncer] Starting PgBouncer (transaction mode, max_client_conn=200, default_pool_size=20)"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
