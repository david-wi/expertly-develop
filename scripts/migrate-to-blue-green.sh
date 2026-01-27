#!/bin/bash
# One-time migration script to set up blue/green deployment
# Run this on the server to migrate from the current setup

set -e

DEPLOY_PATH="/opt/expertly-develop"
STATE_FILE="/opt/deployment-state.json"

echo "=== Blue/Green Migration Script ==="
echo ""
echo "This script will:"
echo "1. Stop current containers"
echo "2. Restart them with 'expertly-blue' project name"
echo "3. Create the deployment state file"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

cd "$DEPLOY_PATH"

echo ""
echo "=== Stopping current containers ==="
docker compose -f docker-compose.prod.yml down || true

echo ""
echo "=== Starting containers as 'blue' deployment ==="
export GIT_COMMIT=$(git rev-parse --short HEAD)
export BUILD_TIMESTAMP=$(date +%s)

COMPOSE_PROJECT_NAME="expertly-blue" \
    docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=== Creating state file ==="
cat > "$STATE_FILE" << EOF
{
    "active": "blue",
    "last_deploy": "$(date -Iseconds)",
    "migrated_from": "legacy"
}
EOF

echo ""
echo "=== Verifying containers ==="
docker ps --filter "name=expertly-blue" --format "{{.Names}}: {{.Status}}"

echo ""
echo "=== Migration complete ==="
echo "Current state:"
cat "$STATE_FILE"
echo ""
echo "Next deployment will deploy to 'green', then switch traffic."
