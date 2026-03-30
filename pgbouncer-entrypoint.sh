#!/bin/sh
set -e

# ── Generate self-signed TLS certificate for PgBouncer client connections ──
TLS_DIR="/etc/pgbouncer/tls"
mkdir -p "$TLS_DIR"

if [ ! -f "$TLS_DIR/client.crt" ] || [ ! -f "$TLS_DIR/client.key" ]; then
    # Install openssl if missing (edoburu/pgbouncer is alpine-based)
    if ! command -v openssl >/dev/null 2>&1; then
        apk add --no-cache openssl >/dev/null 2>&1
    fi

    echo "[pgbouncer-tls] Generating self-signed certificate..."
    openssl req -new -x509 -days 3650 -nodes \
        -out "$TLS_DIR/client.crt" \
        -keyout "$TLS_DIR/client.key" \
        -subj "/CN=voltgres-pgbouncer"

    echo "[pgbouncer-tls] Certificate generated"
fi

# PgBouncer drops to `postgres` user (uid 70) via its config
chown postgres:postgres "$TLS_DIR/client.crt" "$TLS_DIR/client.key"
chmod 600 "$TLS_DIR/client.key"
chmod 644 "$TLS_DIR/client.crt"

# Hand off to the original edoburu/pgbouncer entrypoint
exec /entrypoint.sh "$@"
