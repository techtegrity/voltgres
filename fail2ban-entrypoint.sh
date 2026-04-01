#!/bin/sh
set -e

# Install fail2ban and iptables if not present
if ! command -v fail2ban-server >/dev/null 2>&1; then
    apk add --no-cache fail2ban iptables ip6tables >/dev/null 2>&1
fi

# Disable all default jails (e.g. sshd) that look for logs we don't have
echo -e "[DEFAULT]\nenabled = false" > /etc/fail2ban/jail.d/00-disable-defaults.local

# Config files are mounted read-only, so copy them to writable locations
cp /etc/fail2ban/jail.local /etc/fail2ban/jail.d/postgresql.local
cp /etc/fail2ban/filter.d/postgresql.conf /etc/fail2ban/filter.d/postgresql.local
cp /etc/fail2ban/action.d/docker-iptables.conf /etc/fail2ban/action.d/docker-iptables.local

# Configure fail2ban ports based on which PostgreSQL ports are exposed.
# When migrating ports, both old and new ports need protection.
PORTS="${FAIL2BAN_POSTGRES_PORTS:-5432}"
sed -i "s/^port = .*/port = $PORTS/" /etc/fail2ban/jail.d/postgresql.local

echo "[fail2ban] Monitoring PostgreSQL auth failures on port(s): $PORTS"
echo "[fail2ban] Ban policy: maxretry=${FAIL2BAN_MAXRETRY:-5}, bantime=${FAIL2BAN_BANTIME:-3600}s, findtime=${FAIL2BAN_FINDTIME:-600}s"

# Apply configurable ban parameters
if [ -n "$FAIL2BAN_MAXRETRY" ]; then
    sed -i "s/^maxretry = .*/maxretry = $FAIL2BAN_MAXRETRY/" /etc/fail2ban/jail.d/postgresql.local
fi
if [ -n "$FAIL2BAN_BANTIME" ]; then
    sed -i "s/^bantime = .*/bantime = $FAIL2BAN_BANTIME/" /etc/fail2ban/jail.d/postgresql.local
fi
if [ -n "$FAIL2BAN_FINDTIME" ]; then
    sed -i "s/^findtime = .*/findtime = $FAIL2BAN_FINDTIME/" /etc/fail2ban/jail.d/postgresql.local
fi

# Wait for the postgres log file to appear
echo "[fail2ban] Waiting for PostgreSQL log file..."
while [ ! -f /var/log/postgresql/postgresql.log ]; do
    sleep 2
done
echo "[fail2ban] Log file found, starting fail2ban"

exec fail2ban-server -f --logtarget=STDOUT
