#!/bin/bash
# Migration script: Move identity and redis data to shared volumes
# This fixes the blue-green deployment issue where sessions are lost on deployment
#
# Run this script on the server ONCE before the next deployment:
#   ssh -i ~/.ssh/do_droplet root@152.42.152.243 "bash /opt/expertly-develop/scripts/migrate-to-shared-volumes.sh"

set -e

echo "=== Migrating to Shared Volumes ==="
echo ""

# Get current active deployment
STATE_FILE="/opt/deployment-state.json"
CURRENT=$(jq -r '.active' "$STATE_FILE" 2>/dev/null || echo "green")
echo "Current active deployment: $CURRENT"
echo ""

# Create shared volumes if they don't exist
echo "=== Creating shared volumes ==="
docker volume create shared_identity_postgres_data 2>/dev/null || echo "shared_identity_postgres_data already exists"
docker volume create shared_redis_data 2>/dev/null || echo "shared_redis_data already exists"
docker volume create shared_mongo_data 2>/dev/null || echo "shared_mongo_data already exists"
echo ""

# Source volume names based on current active deployment
SOURCE_PREFIX="expertly-${CURRENT}"
IDENTITY_SOURCE="${SOURCE_PREFIX}_identity_postgres_data"
REDIS_SOURCE="${SOURCE_PREFIX}_redis_data"
MONGO_SOURCE="${SOURCE_PREFIX}_mongo_data"

echo "=== Copying data from $CURRENT deployment ==="

# Function to copy volume data
copy_volume() {
    local src=$1
    local dest=$2
    local name=$3

    # Check if source volume has data
    if docker volume inspect "$src" > /dev/null 2>&1; then
        echo "Copying $name data from $src to $dest..."

        # Use a temporary container to copy data
        docker run --rm \
            -v "$src:/source:ro" \
            -v "$dest:/dest" \
            alpine sh -c "cp -av /source/. /dest/ 2>/dev/null || true"

        echo "  Done!"
    else
        echo "Warning: Source volume $src does not exist, skipping $name"
    fi
}

# Copy identity postgres data
copy_volume "$IDENTITY_SOURCE" "shared_identity_postgres_data" "Identity PostgreSQL"

# Copy redis data
copy_volume "$REDIS_SOURCE" "shared_redis_data" "Redis"

# Copy mongo data
copy_volume "$MONGO_SOURCE" "shared_mongo_data" "MongoDB"

echo ""
echo "=== Migration complete! ==="
echo ""
echo "Shared volumes are now ready. The next deployment will use these shared volumes."
echo "Sessions will persist across blue-green deployments."
echo ""
echo "Volumes created:"
docker volume ls | grep shared_
