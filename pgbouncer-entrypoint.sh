#!/bin/sh
set -e

TLS_DIR="/etc/pgbouncer/tls"
CADDY_CERT_BASE="/caddy-data/caddy/certificates/acme-v02.api.letsencrypt.org-directory"

mkdir -p "$TLS_DIR"

# ── Let's Encrypt certs from Caddy ──────────────────────────────────
# Returns 0 if certs were copied (new or updated), 1 otherwise.
copy_le_certs() {
    if [ -z "$DOMAIN" ]; then
        return 1
    fi

    LE_CERT="$CADDY_CERT_BASE/$DOMAIN/$DOMAIN.crt"
    LE_KEY="$CADDY_CERT_BASE/$DOMAIN/$DOMAIN.key"

    if [ ! -f "$LE_CERT" ] || [ ! -f "$LE_KEY" ]; then
        return 1
    fi

    # Skip if cert hasn't changed
    if [ -f "$TLS_DIR/client.crt" ]; then
        OLD_SUM=$(md5sum "$TLS_DIR/client.crt" 2>/dev/null | cut -d' ' -f1)
        NEW_SUM=$(md5sum "$LE_CERT" 2>/dev/null | cut -d' ' -f1)
        if [ "$OLD_SUM" = "$NEW_SUM" ]; then
            return 1
        fi
    fi

    cp "$LE_CERT" "$TLS_DIR/client.crt"
    cp "$LE_KEY"  "$TLS_DIR/client.key"
    chown postgres:postgres "$TLS_DIR/client.crt" "$TLS_DIR/client.key"
    chmod 600 "$TLS_DIR/client.key"
    chmod 644 "$TLS_DIR/client.crt"
    echo "[pgbouncer-tls] Installed Let's Encrypt certificate for $DOMAIN"
    return 0
}

# ── Self-signed fallback ────────────────────────────────────────────
generate_self_signed() {
    if [ -f "$TLS_DIR/client.crt" ] && [ -f "$TLS_DIR/client.key" ]; then
        return
    fi

    if ! command -v openssl >/dev/null 2>&1; then
        apk add --no-cache openssl >/dev/null 2>&1
    fi

    CN="${DOMAIN:-voltgres-pgbouncer}"
    echo "[pgbouncer-tls] Generating self-signed certificate (CN=$CN)..."
    openssl req -new -x509 -days 3650 -nodes \
        -out "$TLS_DIR/client.crt" \
        -keyout "$TLS_DIR/client.key" \
        -subj "/CN=$CN"

    chown postgres:postgres "$TLS_DIR/client.crt" "$TLS_DIR/client.key"
    chmod 600 "$TLS_DIR/client.key"
    chmod 644 "$TLS_DIR/client.crt"
    echo "[pgbouncer-tls] Self-signed certificate generated"
}

# ── Background watcher for cert renewals ────────────────────────────
start_cert_watcher() {
    if [ -z "$DOMAIN" ]; then
        return
    fi

    (
        # Fast checks: every 30s for the first 10 minutes
        i=0
        while [ "$i" -lt 20 ]; do
            sleep 30
            if copy_le_certs; then
                # SIGHUP tells PgBouncer to reload config + TLS certs
                kill -HUP 1 2>/dev/null || true
                echo "[pgbouncer-tls] Reloaded PgBouncer TLS with Let's Encrypt cert"
            fi
            i=$((i + 1))
        done

        # Daily checks for cert renewals
        while true; do
            sleep 86400
            if copy_le_certs; then
                kill -HUP 1 2>/dev/null || true
                echo "[pgbouncer-tls] Reloaded PgBouncer TLS with renewed Let's Encrypt cert"
            fi
        done
    ) &
}

# ── Main ────────────────────────────────────────────────────────────
copy_le_certs || generate_self_signed

start_cert_watcher

exec /entrypoint.sh "$@"
