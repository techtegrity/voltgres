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
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL |
| `VOLTGRES_PORT` | `3000` | Host port for the web UI (when no domain is set) |
| `GOOGLE_CLIENT_ID` | (empty) | Google OAuth client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | (empty) | Google OAuth secret (optional) |

## Managing

```bash
# View logs
docker compose logs -f voltgres

# Restart
docker compose restart

# Stop
docker compose down

# Update to latest version
git pull
docker compose up -d --build

# Back up the SQLite config database
docker cp voltgres:/app/data/voltgres.db ./voltgres-backup.db
```

## Connecting to the Bundled PostgreSQL from Outside

The bundled PostgreSQL is exposed on port `5432` (configurable via `POSTGRES_PORT`).

```bash
psql -h your-vps-ip -U postgres -p 5432
```

To restrict external access, remove the `ports` mapping from the `postgres` service in `docker-compose.yml`.
