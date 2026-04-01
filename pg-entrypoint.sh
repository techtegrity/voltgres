#!/bin/sh
set -e

# Install openssl if not available (postgres:16-alpine doesn't include it)
if ! command -v openssl >/dev/null 2>&1; then
    apk add --no-cache openssl >/dev/null 2>&1
fi

SSL_DIR="/var/lib/postgresql/ssl"
CADDY_CERT_BASE="/caddy-data/caddy/certificates/acme-v02.api.letsencrypt.org-directory"

mkdir -p "$SSL_DIR"

# Copy Let's Encrypt certs from Caddy's storage if available.
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

    # Check if cert has changed (compare modification times)
    if [ -f "$SSL_DIR/server.crt" ]; then
        OLD_SUM=$(md5sum "$SSL_DIR/server.crt" 2>/dev/null | cut -d' ' -f1)
        NEW_SUM=$(md5sum "$LE_CERT" 2>/dev/null | cut -d' ' -f1)
        if [ "$OLD_SUM" = "$NEW_SUM" ]; then
            return 1  # No change
        fi
    fi

    cp "$LE_CERT" "$SSL_DIR/server.crt"
    cp "$LE_KEY" "$SSL_DIR/server.key"
    chmod 600 "$SSL_DIR/server.key"
    chown postgres:postgres "$SSL_DIR/server.crt" "$SSL_DIR/server.key"
    echo "[pg-ssl] Installed Let's Encrypt certificate for $DOMAIN"
    return 0
}

# Generate self-signed certificate as fallback.
generate_self_signed() {
    if [ -f "$SSL_DIR/server.crt" ] && [ -f "$SSL_DIR/server.key" ]; then
        return  # Already have certs (from previous run)
    fi

    CN="${DOMAIN:-voltgres-postgres}"
    echo "[pg-ssl] Generating self-signed certificate (CN=$CN)..."
    openssl req -new -x509 -days 3650 -nodes \
        -out "$SSL_DIR/server.crt" \
        -keyout "$SSL_DIR/server.key" \
        -subj "/CN=$CN"
    chmod 600 "$SSL_DIR/server.key"
    chown postgres:postgres "$SSL_DIR/server.crt" "$SSL_DIR/server.key"
    echo "[pg-ssl] Self-signed certificate generated"
}

# Background watcher: checks for new LE certs and reloads PG.
# Fast checks initially (handles first boot where Caddy hasn't provisioned yet),
# then switches to daily checks for renewals.
start_cert_watcher() {
    if [ -z "$DOMAIN" ]; then
        return  # No domain, no LE certs to watch for
    fi

    (
        # Fast checks: every 30s for the first 10 minutes
        i=0
        while [ "$i" -lt 20 ]; do
            sleep 30
            if copy_le_certs; then
                # Send SIGHUP to postgres to reload SSL context
                PG_PID=$(head -1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)
                if [ -n "$PG_PID" ]; then
                    kill -HUP "$PG_PID" 2>/dev/null || true
                    echo "[pg-ssl] Reloaded PostgreSQL SSL with Let's Encrypt cert"
                fi
            fi
            i=$((i + 1))
        done

        # Daily checks for cert renewals
        while true; do
            sleep 86400
            if copy_le_certs; then
                PG_PID=$(head -1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)
                if [ -n "$PG_PID" ]; then
                    kill -HUP "$PG_PID" 2>/dev/null || true
                    echo "[pg-ssl] Reloaded PostgreSQL SSL with renewed Let's Encrypt cert"
                fi
            fi
        done
    ) &
}

# Enforce hostssl-only connections for external traffic while allowing
# unencrypted connections from trusted Docker internal networks.
enforce_hostssl() {
    PGDATA="${PGDATA:-/var/lib/postgresql/data}"
    HBA="$PGDATA/pg_hba.conf"
    if [ -f "$HBA" ]; then
        # Replace 'host' with 'hostssl' for non-local connections
        if grep -q '^host ' "$HBA"; then
            sed -i 's/^host /hostssl /g' "$HBA"
            echo "[pg-security] Enforced hostssl-only in pg_hba.conf (non-TLS connections rejected)"
        fi

        # Allow unencrypted connections from Docker internal networks (trusted)
        if ! grep -q '# voltgres-docker-internal' "$HBA"; then
            echo "" >> "$HBA"
            echo "# voltgres-docker-internal" >> "$HBA"
            echo "host all all 172.16.0.0/12 scram-sha-256" >> "$HBA"
            echo "host all all 10.0.0.0/8 scram-sha-256" >> "$HBA"
            echo "[pg-security] Allowed unencrypted access from Docker internal networks"
        fi
    fi
}

# After initial DB setup, enforce hostssl.
# docker-entrypoint.sh only creates pg_hba.conf on first init,
# so we patch it on every start to ensure it stays enforced.
start_hostssl_enforcer() {
    (
        # Wait for pg_hba.conf to exist (first init can take a few seconds)
        for _ in $(seq 1 30); do
            if [ -f "${PGDATA:-/var/lib/postgresql/data}/pg_hba.conf" ]; then
                enforce_hostssl
                return
            fi
            sleep 1
        done
    ) &
}

# --- Main ---

# Try LE certs first, fall back to self-signed
copy_le_certs || generate_self_signed

# Start background watcher for cert updates
start_cert_watcher

# Enforce hostssl on existing installations
enforce_hostssl

# Start hostssl enforcer for first-time init (when pg_hba.conf doesn't exist yet)
start_hostssl_enforcer

# Determine log directory
LOG_DIR="/var/log/postgresql"
mkdir -p "$LOG_DIR"
chown postgres:postgres "$LOG_DIR"

# Start PostgreSQL with SSL, logging, and pg_stat_statements
exec docker-entrypoint.sh "$@" \
    -c ssl=on \
    -c ssl_cert_file="$SSL_DIR/server.crt" \
    -c ssl_key_file="$SSL_DIR/server.key" \
    -c shared_preload_libraries=pg_stat_statements \
    -c log_destination=stderr \
    -c logging_collector=on \
    -c log_directory="$LOG_DIR" \
    -c log_filename='postgresql.log' \
    -c log_truncate_on_rotation=off \
    -c log_rotation_age=1d \
    -c log_rotation_size=50MB \
    -c log_connections=on \
    -c log_disconnections=on \
    -c log_line_prefix='%h %t [%p] %q%u@%d '
