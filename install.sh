#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${CYAN}${BOLD}  ⚡ Voltgres Installer${NC}"
echo -e "  ${CYAN}PostgreSQL Manager${NC}"
echo ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker is not installed.${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        read -p "Install Docker now? (Y/n): " install_docker
        if [[ ! "$install_docker" =~ ^[Nn]$ ]]; then
            echo "Installing Docker..."
            curl -fsSL https://get.docker.com | sh
            echo -e "${GREEN}Docker installed.${NC}"
            # If not root, add user to docker group and re-exec
            if [ "$(id -u)" -ne 0 ]; then
                sudo usermod -aG docker "$USER"
                echo "Applying docker group membership..."
                exec sg docker -c "$0"
            fi
        fi
    else
        echo "  Install Docker Desktop from https://docker.com/products/docker-desktop"
    fi
    exit 1
fi

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}Docker is installed but not running.${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Starting Docker..."
        sudo systemctl start docker
        sudo systemctl enable docker
        echo -e "${GREEN}Docker started and enabled on boot.${NC}"
    else
        echo "  Please start Docker Desktop and re-run this script."
        exit 1
    fi
fi

if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Docker Compose is not available. Make sure you have Docker Compose v2+.${NC}"
    exit 1
fi

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}An .env file already exists.${NC}"
    read -p "Overwrite it? (y/N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env. Starting containers..."
        # Source .env to check if DOMAIN is set
        existing_domain=$(grep '^DOMAIN=' .env | cut -d= -f2-)
        if [ -n "$existing_domain" ]; then
            docker compose --profile https up -d --build
        else
            docker compose up -d --build
        fi
        echo ""
        echo -e "${GREEN}${BOLD}Voltgres is running!${NC}"
        echo ""
        exit 0
    fi
fi

echo -e "${BOLD}Let's configure your Voltgres instance.${NC}"
echo ""

# Domain
echo -e "Enter your domain name for HTTPS (e.g. ${CYAN}db.example.com${NC})"
read -p "Leave blank for localhost (no HTTPS): " domain
echo ""

if [ -n "$domain" ]; then
    # Detect public IP
    public_ip=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || curl -4 -s --max-time 5 icanhazip.com 2>/dev/null || echo "")
    if [ -n "$public_ip" ]; then
        echo -e "${YELLOW}${BOLD}DNS Setup Required${NC}"
        echo -e "  Create an ${BOLD}A record${NC} for your domain:"
        echo ""
        echo -e "    ${CYAN}${domain}${NC}  →  ${CYAN}${public_ip}${NC}"
        echo ""
        echo -e "  Let's Encrypt needs this to issue your HTTPS certificate."
        echo -e "  Make sure the DNS record is active before continuing."
        echo ""
        read -p "Press Enter when your DNS is configured... "
        echo ""
    else
        echo -e "${YELLOW}Could not detect your server's public IP.${NC}"
        echo -e "  Make sure you create an A record pointing ${CYAN}${domain}${NC} to this server."
        echo ""
    fi
fi

# IP Whitelist (only when domain is set)
allowed_ips=""
if [ -n "$domain" ]; then
    echo -e "Restrict access to specific IP addresses (optional)."
    echo -e "  Enter comma-separated IPs or CIDRs (e.g. ${CYAN}203.0.113.5, 10.0.0.0/8${NC})"
    read -p "Leave blank for public access: " allowed_ips_input
    echo ""
    if [ -n "$allowed_ips_input" ]; then
        # Convert comma-separated to space-separated for Caddy
        allowed_ips=$(echo "$allowed_ips_input" | tr ',' ' ' | tr -s ' ')
    fi
fi

# PostgreSQL password
default_pg_pass=$(openssl rand -base64 16 | tr -d '=/+' | head -c 20)
echo -e "PostgreSQL password for the bundled database."
read -p "Press Enter for auto-generated [$default_pg_pass]: " pg_pass
pg_pass=${pg_pass:-$default_pg_pass}
echo ""

# Google OAuth (optional)
echo -e "Google OAuth (optional — enables ${CYAN}Sign in with Google${NC})"
read -p "Google Client ID (leave blank to skip): " google_client_id
google_client_secret=""
google_enabled="false"
if [ -n "$google_client_id" ]; then
    read -p "Google Client Secret: " google_client_secret
    google_enabled="true"
fi
echo ""

# Generate auth secret
auth_secret=$(openssl rand -base64 32)

# Determine URLs
if [ -n "$domain" ]; then
    app_url="https://$domain"
else
    app_url="http://localhost:3000"
fi

# Generate Caddyfile (only matters when domain is set)
if [ -n "$domain" ]; then
    if [ -n "$allowed_ips" ]; then
        cat > Caddyfile << 'CADDYEOF'
{$DOMAIN} {
	@blocked {
		not remote_ip {$ALLOWED_IPS}
	}
	respond @blocked "Access denied" 403

	reverse_proxy voltgres:3000
}
CADDYEOF
    else
        cat > Caddyfile << 'CADDYEOF'
{$DOMAIN} {
	reverse_proxy voltgres:3000
}
CADDYEOF
    fi
fi

# Write .env
cat > .env << EOF
# =================================
# Voltgres Configuration
# Generated by install.sh
# =================================

BETTER_AUTH_SECRET=$auth_secret
BETTER_AUTH_URL=$app_url
NEXT_PUBLIC_APP_URL=$app_url

# Domain for HTTPS (leave empty for localhost/HTTP only)
DOMAIN=$domain

# IP whitelist (space-separated IPs/CIDRs, empty = public)
ALLOWED_IPS=$allowed_ips

# Google OAuth (optional)
GOOGLE_CLIENT_ID=$google_client_id
GOOGLE_CLIENT_SECRET=$google_client_secret
NEXT_PUBLIC_GOOGLE_ENABLED=$google_enabled

# Bundled PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$pg_pass
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Web UI port (only used when no domain is set)
VOLTGRES_PORT=3000
EOF

echo -e "${GREEN}.env created successfully.${NC}"
echo ""

# Build and start
echo "Starting Voltgres..."
echo ""
if [ -n "$domain" ]; then
    docker compose --profile https up -d --build
else
    docker compose up -d --build
fi

echo ""
echo -e "${GREEN}${BOLD}Voltgres is running!${NC}"
echo ""
echo -e "  Open ${CYAN}${BOLD}${app_url}${NC} to complete setup."
echo ""
echo -e "  When connecting to the bundled PostgreSQL from Voltgres:"
echo -e "    Host:     ${BOLD}postgres${NC}"
echo -e "    Port:     ${BOLD}5432${NC}"
echo -e "    User:     ${BOLD}postgres${NC}"
echo -e "    Password: ${BOLD}${pg_pass}${NC}"
echo ""
echo -e "  ${YELLOW}Save these credentials somewhere safe.${NC}"
echo ""
