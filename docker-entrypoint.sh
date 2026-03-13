#!/bin/sh
set -e

echo "Voltgres starting..."

# ── Docker socket access ──────────────────────────────────────────
# Auto-detect the GID of the Docker socket and grant the nextjs user
# access so the app can show Docker disk usage and run prune commands.
DOCKER_SOCK="/var/run/docker.sock"
if [ -S "$DOCKER_SOCK" ]; then
  SOCK_GID=$(stat -c %g "$DOCKER_SOCK" 2>/dev/null || echo "")
  if [ -n "$SOCK_GID" ] && [ "$SOCK_GID" != "0" ]; then
    # Create a group with the socket's GID and add nextjs to it
    if ! getent group "$SOCK_GID" >/dev/null 2>&1; then
      addgroup --gid "$SOCK_GID" dockersock 2>/dev/null || true
    fi
    SOCK_GROUP=$(getent group "$SOCK_GID" | cut -d: -f1)
    addgroup nextjs "$SOCK_GROUP" 2>/dev/null || true
    echo "Docker socket accessible (GID $SOCK_GID)"
  fi
else
  echo "Docker socket not found — Docker disk management disabled"
fi

# ── Database migrations ───────────────────────────────────────────
echo "Running database migrations..."
su-exec nextjs node migrate.mjs
echo "Migrations complete."

# ── Start the Next.js server as nextjs user ───────────────────────
exec su-exec nextjs node server.js
