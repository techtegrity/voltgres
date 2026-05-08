# Installing Voltgres on a VPS

## Prerequisites

- A VPS running Ubuntu 22.04+ / Debian 12+ (any Linux with Docker works)
- Docker and Docker Compose installed
- A domain name (optional, for automatic HTTPS)

### Install Docker (if not already installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-org/voltgres.git
cd voltgres

# 2. Run the installer
./install.sh
```

The installer will ask for:
- **Domain** (leave blank for localhost)
- **PostgreSQL password** (auto-generated if you press Enter)

It generates the `.env`, builds the containers, and starts everything.

### 3. Complete Setup in Browser

Open the URL shown by the installer. On first visit you'll see the **setup wizard** — create your admin account (name, email, password).

### 4. Connect to PostgreSQL

After logging in, configure the connection to the bundled PostgreSQL:
- **Host:** `postgres`
- **Port:** `5432`
- **Username:** `postgres`
- **Password:** (the password shown by the installer)

## How HTTPS Works

If you provided a domain during install, Voltgres uses **Caddy** to automatically provision a Let's Encrypt certificate. No nginx, no certbot commands — it just works.

Requirements:
1. Your domain's A record must point to the VPS IP
2. Ports 80 and 443 must be open on the VPS firewall

That's it. Caddy handles certificate issuance and renewal automatically.

## Manual Setup (without install.sh)

If you prefer to configure manually:

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d --build
```

## Security

Voltgres includes several layers of security for the bundled PostgreSQL out of the box.

### Host firewall (ufw)

**fail2ban is not a perimeter firewall** — it only watches Postgres credential brute-force on `POSTGRES_PORT`. It doesn't protect SSH, PgBouncer, or close ports you didn't intend to expose (like `:3000` direct to the web UI when running with HTTPS). Run a host firewall in front of fail2ban.

The installer prints suggested `ufw` rules tailored to your install, but here's the recipe (allow SSH **first**, or you'll lock yourself out):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp                       # Caddy HTTP→HTTPS redirect (HTTPS installs only)
sudo ufw allow 443 comment 'HTTPS'          # TCP+UDP for HTTP/3 (HTTPS installs only)
sudo ufw allow 3000/tcp                     # web UI (only if no DOMAIN set)
sudo ufw allow 54320/tcp comment 'PostgreSQL'   # substitute your POSTGRES_PORT
sudo ufw allow 6432/tcp comment 'PgBouncer'
sudo ufw enable
```

When `DOMAIN` is set, do **not** open `3000` — all web traffic should go through Caddy on `443`. The `:3000` mapping exists for the no-domain (HTTP-only) install path.

For tighter lockdown, restrict Postgres/PgBouncer to known source IPs:

```bash
sudo ufw allow from 203.0.113.5 to any port 54320 proto tcp
sudo ufw allow from 203.0.113.5 to any port 6432 proto tcp
```

Other firewalls (Hetzner Cloud Firewall, nftables, firewalld, AWS Security Groups) work the same way — apply the same allowlist at whichever layer you use.

### fail2ban (automatic IP banning)

A fail2ban sidecar container monitors PostgreSQL logs and automatically bans IPs after repeated failed authentication attempts. This is the primary defense against brute-force attacks.

Defaults (configurable via `.env`):

| Variable | Default | Description |
|---|---|---|
| `FAIL2BAN_MAXRETRY` | `5` | Failed attempts before banning |
| `FAIL2BAN_BANTIME` | `3600` | Ban duration in seconds (1 hour) |
| `FAIL2BAN_FINDTIME` | `600` | Time window for counting failures (10 min) |

Private networks (127.x, 10.x, 172.16.x, 192.168.x) are never banned.

```bash
# Check fail2ban status and banned IPs
docker exec voltgres-fail2ban fail2ban-client status postgresql

# Manually unban an IP
docker exec voltgres-fail2ban fail2ban-client set postgresql unbanip 1.2.3.4
```

### TLS enforcement

All external PostgreSQL connections require TLS. Non-encrypted connections are rejected via `hostssl`-only rules in `pg_hba.conf`. Your apps should connect with `sslmode=require` (or `no-verify` for self-signed certs).

### Non-standard port

New installations default to port `54320` instead of the standard `5432`. This eliminates the vast majority of automated scans which only target default ports.

### Migrating to a non-standard port

If you're running on the default port (5432) and want to switch, you can migrate your apps gradually without downtime:

**Step 1:** Set the new port in `.env`:
```bash
POSTGRES_PORT=54320
```

**Step 2:** Start with both ports open (old 5432 + new 54320):
```bash
docker compose -f docker-compose.yml -f docker-compose.port-migration.yml up -d
```

**Step 3:** Update your apps one by one to use port `54320`. No other connection changes needed — same host, same credentials, same `sslmode=require`.

**Step 4:** Once all apps are migrated, drop the legacy port:
```bash
docker compose up -d
```

fail2ban automatically protects both ports during the migration period.

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | (required) | Random secret for auth tokens |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Full URL where Voltgres is accessible |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Same as above (used client-side) |
| `DOMAIN` | (empty) | Domain for auto HTTPS (e.g. `db.example.com`) |
| `ALLOW_REGISTRATION` | `false` | Allow public account registration |
| `POSTGRES_USER` | `postgres` | Bundled PostgreSQL superuser |
| `POSTGRES_PASSWORD` | `voltgres` | Bundled PostgreSQL password |
| `POSTGRES_DB` | `postgres` | Default database name |
| `POSTGRES_PORT` | `54320` | Host port for PostgreSQL |
| `PGBOUNCER_PORT` | `6432` | Host port for PgBouncer |
| `VOLTGRES_PORT` | `3000` | Host port for the web UI (when no domain is set) |
| `FAIL2BAN_MAXRETRY` | `5` | Failed auth attempts before ban |
| `FAIL2BAN_BANTIME` | `3600` | Ban duration in seconds |
| `FAIL2BAN_FINDTIME` | `600` | Failure counting window in seconds |
| `GOOGLE_CLIENT_ID` | (empty) | Google OAuth client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | (empty) | Google OAuth secret (optional) |

## Managing

```bash
# View logs
docker compose logs -f voltgres

# View fail2ban logs
docker compose logs -f fail2ban

# Check banned IPs
docker exec voltgres-fail2ban fail2ban-client status postgresql

# Restart
docker compose restart

# Stop
docker compose down

# Update to latest version
./update.sh

# Back up the SQLite config database
docker cp voltgres:/app/data/voltgres.db ./voltgres-backup.db
```

## Connecting to the Bundled PostgreSQL from Outside

The bundled PostgreSQL is exposed on the port configured via `POSTGRES_PORT` (default: `54320`).

```bash
psql "host=your-vps-ip port=54320 user=postgres sslmode=require"
```

TLS is required for all external connections. Use `sslmode=require` in your connection strings.

To restrict external access entirely, remove the `ports` mapping from the `postgres` service in `docker-compose.yml`.
