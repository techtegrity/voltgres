#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${CYAN}${BOLD}  ⚡ Voltgres Updater${NC}"
echo ""

# Ensure swap exists on low-memory VPS (prevents OOM during Docker builds)
if [[ "$OSTYPE" == "linux-gnu"* ]] && [ "$(id -u)" -eq 0 ]; then
    if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
        total_mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
        if [ "$total_mem_mb" -lt 4096 ]; then
            echo -e "${YELLOW}Low memory detected. Creating 2GB swap file...${NC}"
            fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
            chmod 600 /swapfile
            mkswap /swapfile >/dev/null
            swapon /swapfile
            if ! grep -q '/swapfile' /etc/fstab 2>/dev/null; then
                echo '/swapfile none swap sw 0 0' >> /etc/fstab
            fi
            echo -e "${GREEN}Swap enabled.${NC}"
        fi
    fi
fi

# Must be run from the voltgres directory
if [ ! -f docker-compose.yml ]; then
    echo -e "${RED}Error: docker-compose.yml not found.${NC}"
    echo "  Run this script from your voltgres directory."
    exit 1
fi

if [ ! -f .env ]; then
    echo -e "${RED}Error: .env not found. Run install.sh first.${NC}"
    exit 1
fi

# Check for local changes
if ! git diff --quiet 2>/dev/null; then
    echo -e "${YELLOW}You have local changes. Stashing them...${NC}"
    git stash
    STASHED=true
fi

# Pull latest
echo "Pulling latest version..."
git pull --ff-only || {
    echo -e "${RED}Failed to pull. You may have diverged from the remote.${NC}"
    if [ "$STASHED" = true ]; then
        git stash pop
    fi
    exit 1
}

if [ "$STASHED" = true ]; then
    echo "Restoring local changes..."
    git stash pop || echo -e "${YELLOW}Warning: Could not restore stashed changes. Run 'git stash pop' manually.${NC}"
fi

# Ensure entrypoint scripts are executable
chmod +x pg-entrypoint.sh pgbouncer-entrypoint.sh fail2ban-entrypoint.sh 2>/dev/null || true

# Rebuild and restart
echo "Rebuilding and restarting..."
existing_domain=$(grep '^DOMAIN=' .env | cut -d= -f2-)
if [ -n "$existing_domain" ]; then
    docker compose --profile https up -d --build --force-recreate
else
    docker compose up -d --build --force-recreate
fi

echo ""
echo -e "${GREEN}${BOLD}Voltgres updated and running!${NC}"
echo ""
