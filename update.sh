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

# Ensure entrypoint script is executable
chmod +x pg-entrypoint.sh

# Rebuild and restart
echo "Rebuilding and restarting..."
existing_domain=$(grep '^DOMAIN=' .env | cut -d= -f2-)
if [ -n "$existing_domain" ]; then
    docker compose --profile https up -d --build
else
    docker compose up -d --build
fi

echo ""
echo -e "${GREEN}${BOLD}Voltgres updated and running!${NC}"
echo ""
