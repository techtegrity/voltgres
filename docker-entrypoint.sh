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
    # Socket is owned by a non-root group (typical: docker group)
    # Create a group with that GID if it doesn't exist, then add nextjs
    if ! getent group "$SOCK_GID" >/dev/null 2>&1; then
      addgroup -g "$SOCK_GID" dockersock 2>/dev/null || true
    fi
    SOCK_GROUP=$(getent group "$SOCK_GID" | cut -d: -f1)
    if [ -n "$SOCK_GROUP" ]; then
      addgroup nextjs "$SOCK_GROUP" 2>/dev/null || true
    fi
    echo "Docker socket: granted nextjs access via group $SOCK_GROUP (GID $SOCK_GID)"
  elif [ "$SOCK_GID" = "0" ]; then
    # Socket is owned by root:root — make it group-readable for nextjs
    chmod 666 "$DOCKER_SOCK" 2>/dev/null || true
    echo "Docker socket: set world-readable (was root:root)"
  fi

  # Verify access actually works
  if su-exec nextjs docker info >/dev/null 2>&1; then
    echo "Docker socket: verified OK"
  else
    echo "Docker socket: WARNING — nextjs still cannot access docker"
  fi
else
  echo "Docker socket: not mounted — Docker disk management disabled"
fi

# ── Database migrations ───────────────────────────────────────────
echo "Running database migrations..."
su-exec nextjs node migrate.mjs
echo "Migrations complete."

# ── Start the Next.js server as nextjs user ───────────────────────
exec su-exec nextjs node server.js
